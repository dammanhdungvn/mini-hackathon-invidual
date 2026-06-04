/**
 * Attraction Recommendation Engine
 *
 * Orchestrates candidate retrieval + scoring WITHOUT involving the LLM.
 * The LLM never creates or ranks places — it only explains the validated results.
 *
 * Pipeline:
 *   1. Fetch candidates from Google Places (via Supabase cache)
 *   2. Rank using scorer.ts (rating + interest match + price + distance)
 *   3. Filter by minimum rating and opening-hour fit
 *   4. Return sorted CandidatePlace[]
 *
 * Called from:
 *   app/api/ai/generate-itinerary/route.ts (Stage 2)
 */

import { searchPlacesNearby } from './google-places'
import { rankPlaces, scoreOpeningHourFit } from '@/lib/solver/scorer'
import type { CandidatePlace } from '@/lib/types/place'
import type { TravelIntent } from '@/lib/types/trip'

export interface RecommendationOptions {
  /** Maximum number of results to return (default: 15) */
  topN?: number
  /** Minimum rating threshold (default: 0 — no filter) */
  minRating?: number
  /** Hotel/origin coordinates to score distance from */
  originLat?: number
  originLng?: number
  /**
   * Day key for opening-hour fit scoring ('mon'|'tue'|...|'sun').
   * When provided, places that are closed score lower (not removed).
   */
  dayKey?: string
  /** Proposed arrival time in HH:MM for opening-hour fit check */
  arrivalTime?: string
}

/**
 * Returns the top-ranked attraction candidates for a given travel intent.
 *
 * LLM RULES (enforced here):
 *   ✅ All candidates come from Google Places API or Supabase cache
 *   ✅ Ranking is done by scorer.ts — pure math, no LLM involvement
 *   ❌ LLM does NOT create place names
 *   ❌ LLM does NOT influence ranking order
 */
export async function getRecommendedAttractions(
  intent: TravelIntent,
  options: RecommendationOptions = {}
): Promise<CandidatePlace[]> {
  const {
    topN      = 15,
    minRating = 0,
    originLat,
    originLng,
    dayKey,
    arrivalTime,
  } = options

  // ── Stage 1: Retrieve candidates (from cache or Google Places API) ──────────
  const fetchCount = topN * 3  // Fetch 3× to have headroom after filtering
  const candidates = await searchPlacesNearby(
    intent.destination,
    'attraction',
    fetchCount
  )

  if (candidates.length === 0) return []

  // ── Stage 2: Apply minimum rating filter ─────────────────────────────────────
  const filtered = minRating > 0
    ? candidates.filter(p => p.rating >= minRating)
    : candidates

  // ── Stage 3: Augment with opening-hour fit score (if day context provided) ───
  const augmented: CandidatePlace[] = filtered.map(place => {
    if (!dayKey || !arrivalTime) return place

    const fitScore = scoreOpeningHourFit(
      place.openingHours,
      dayKey,
      arrivalTime,
      place.durationMins
    )

    // Blend the fit score into similarityScore so rankPlaces picks it up
    const blendedSimilarity = (place.similarityScore ?? 0.5) * 0.7 + fitScore * 0.3

    return { ...place, similarityScore: blendedSimilarity }
  })

  // ── Stage 4: Rank by composite score (rating + interest + price + distance) ──
  return rankPlaces(augmented, intent, originLat, originLng, topN)
}

/**
 * Returns the top-ranked restaurant candidates for a given travel intent.
 * Uses the same pipeline as getRecommendedAttractions.
 */
export async function getRecommendedRestaurants(
  intent: TravelIntent,
  options: RecommendationOptions = {}
): Promise<CandidatePlace[]> {
  const { topN = 5, minRating = 0, originLat, originLng } = options

  const candidates = await searchPlacesNearby(intent.destination, 'restaurant', topN * 2)
  if (candidates.length === 0) return []

  const filtered = minRating > 0 ? candidates.filter(p => p.rating >= minRating) : candidates
  return rankPlaces(filtered, intent, originLat, originLng, topN)
}
