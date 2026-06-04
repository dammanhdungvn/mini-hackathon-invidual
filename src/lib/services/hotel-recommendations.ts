/**
 * Hotel Recommendation Engine
 *
 * Orchestrates:
 *   1. Candidate retrieval from Amadeus (via existing amadeus.ts service)
 *   2. Deterministic 4-factor ranking (via scorer.ts — no LLM)
 *   3. AI explanation via provider abstraction (LLM annotates only — no invention)
 *
 * Rules enforced here:
 *   - AI CANNOT invent hotels, prices, or ratings
 *   - All hotel entities come from Amadeus API
 *   - Ranking is deterministic: same input → same ranking
 *   - No direct @ai-sdk/* imports — uses lib/ai/provider.ts
 *
 * @module lib/services/hotel-recommendations
 */

import { generateObject } from 'ai'
import { z } from 'zod'
import { searchHotels } from './amadeus'
import { rankHotels } from '@/lib/solver/scorer'
import { getSynthesisModel } from '@/lib/ai/provider'
import { HOTEL_EXPLANATION_PROMPT } from '@/lib/ai/prompts'
import type { BudgetTier, RankedHotel } from '@/lib/types/trip'

// ─── Input schema ─────────────────────────────────────────────────────────────

export interface HotelRecommendationInput {
  cityCode: string
  checkIn: string         // 'YYYY-MM-DD'
  checkOut: string        // 'YYYY-MM-DD'
  adults: number
  budgetTier: BudgetTier
  topN?: number
  /** Itinerary centroid (average lat/lng of all activities) */
  centroidLat?: number
  centroidLng?: number
  travelPace?: string
  interests?: string[]
  /** Whether to request AI explanations (default: true) */
  withExplanations?: boolean
}

// ─── AI explanation schema ───────────────────────────────────────────────────

const ExplanationResponseSchema = z.object({
  recommendations: z.array(z.object({
    amadeus_hotel_id: z.string(),
    ai_reason: z.string().max(250),
  })),
})

// ─── Main orchestrator ────────────────────────────────────────────────────────

/**
 * Get ranked hotel recommendations for a trip.
 *
 * Pipeline:
 *   RETRIEVE → RANK → EXPLAIN (AI annotation only)
 *
 * The LLM only adds ai_reason text — it cannot change names, prices, ratings,
 * or any data field. All factual data originates from Amadeus.
 */
export async function getRecommendedHotels(
  input: HotelRecommendationInput
): Promise<RankedHotel[]> {
  const {
    cityCode, checkIn, checkOut, adults,
    budgetTier, topN = 5,
    centroidLat, centroidLng,
    travelPace, interests,
    withExplanations = true,
  } = input

  // ── STAGE 1: Retrieve hotel candidates ──────────────────────────────────────
  // Uses existing amadeus.ts — never duplicated
  const candidates = await searchHotels(cityCode, checkIn, checkOut, adults)

  if (candidates.length === 0) return []

  // ── STAGE 2: Deterministic ranking — NO LLM ─────────────────────────────────
  const ranked = rankHotels(candidates, budgetTier, {
    centroidLat,
    centroidLng,
    travelPace,
    interests,
    topN,
  })

  if (!withExplanations || ranked.length === 0) return ranked

  // ── STAGE 3: AI explanation (annotation only) ────────────────────────────────
  // LLM receives: hotel name, location, rating, price (all from Amadeus)
  // LLM may only return: ai_reason text per hotel
  // LLM CANNOT change any numeric or factual field
  const annotated = await addAIExplanations(ranked, budgetTier, interests)
  return annotated
}

// ─── AI Explanation Step ─────────────────────────────────────────────────────

async function addAIExplanations(
  ranked: RankedHotel[],
  budgetTier: BudgetTier,
  interests?: string[]
): Promise<RankedHotel[]> {
  try {
    const hotelSummaries = ranked.map(h => ({
      amadeus_hotel_id: h.amadeus_hotel_id ?? h.name,
      name:             h.name,
      rating:           h.rating,
      price_per_night:  h.price_per_night,
      currency:         h.currency,
      score:            h.score,
      scoreBreakdown:   h.scoreBreakdown,
    }))

    const { object } = await generateObject({
      model: getSynthesisModel(),
      schema: ExplanationResponseSchema,
      system: HOTEL_EXPLANATION_PROMPT,
      prompt: [
        `Budget tier: ${budgetTier}`,
        interests ? `User interests: ${interests.join(', ')}` : '',
        '',
        'Hotels to explain (do NOT invent or change any data):',
        JSON.stringify(hotelSummaries, null, 2),
      ].filter(Boolean).join('\n'),
    })

    // Merge ai_reason back onto the locked ranked hotels
    // Only ai_reason field is taken from LLM — all other fields remain from Amadeus
    const reasonMap = new Map(
      object.recommendations.map(r => [r.amadeus_hotel_id, r.ai_reason])
    )

    return ranked.map(h => ({
      ...h,
      ai_reason: reasonMap.get(h.amadeus_hotel_id ?? h.name) ?? undefined,
    }))
  } catch (err) {
    // AI explanation is non-critical — return ranked hotels without explanations
    console.error('[hotel-recommendations] AI explanation failed:', err)
    return ranked
  }
}

/**
 * Calculate the centroid (average lat/lng) of a set of coordinates.
 * Used to pass the itinerary centroid to the recommendation engine.
 */
export function calculateCentroid(
  points: Array<{ latitude?: number; longitude?: number }>
): { centroidLat: number; centroidLng: number } | undefined {
  const valid = points.filter(
    (p): p is { latitude: number; longitude: number } =>
      p.latitude !== undefined && p.longitude !== undefined
  )
  if (valid.length === 0) return undefined

  const lat = valid.reduce((sum, p) => sum + p.latitude, 0) / valid.length
  const lng = valid.reduce((sum, p) => sum + p.longitude, 0) / valid.length
  return { centroidLat: lat, centroidLng: lng }
}
