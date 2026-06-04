/**
 * Scoring functions for ranking hotels and attractions.
 * Pure TypeScript — no external API calls, no side effects.
 *
 * Used by:
 *   - lib/services/recommendations.ts (attraction ranking)
 *   - app/api/ai/generate-itinerary/route.ts (hotel ranking)
 */

import type { CandidatePlace, OpeningHours } from '@/lib/types/place'
import type { BudgetTier, TravelIntent } from '@/lib/types/trip'
import { haversineKm } from './haversine'

// ─── Budget price targets (USD per night) ────────────────────────────────────

export const BUDGET_TARGET: Record<BudgetTier, number> = {
  budget: 60,
  'mid-range': 150,
  luxury: 400,
}

// ─── Hotel Scoring ───────────────────────────────────────────────────────────

/**
 * Score a hotel on a 0–1 scale.
 * Weighs: rating 50%, price proximity 50%.
 */
export function scoreHotel(
  hotel: { rating?: number; price_per_night?: number },
  budgetTier: BudgetTier
): number {
  const target = BUDGET_TARGET[budgetTier]
  const ratingScore = (hotel.rating ?? 3.5) / 5
  const price = hotel.price_per_night ?? target
  const ratio = price / target
  const priceScore = ratio <= 1
    ? ratio * 0.8 + 0.2
    : Math.max(0, 1 - (ratio - 1) * 0.6)
  return ratingScore * 0.5 + priceScore * 0.5
}

// ─── Place / Attraction Scoring ──────────────────────────────────────────────

/**
 * Score a place on a 0–1 scale using four factors:
 *   - rating/popularity (40%)
 *   - interest similarity from pgvector (30%)
 *   - price level match (15%)
 *   - distance from origin (15%)
 */
export function scorePlace(
  place: CandidatePlace,
  intent: TravelIntent,
  originLat?: number,
  originLng?: number
): number {
  const ratingScore   = place.rating / 5
  const interestScore = place.similarityScore ?? 0.5
  const priceScore    = scorePriceLevel(place.priceLevel, intent.budgetTier)
  const distScore     = scoreDistance(place, originLat, originLng)

  return (
    ratingScore   * 0.40 +
    interestScore * 0.30 +
    priceScore    * 0.15 +
    distScore     * 0.15
  )
}

/**
 * Score opening-hour fit for a given day/time window.
 * Returns 1.0 if the place is open during the proposed visit window,
 * 0.0 if definitively closed, 0.5 if hours are unknown.
 */
export function scoreOpeningHourFit(
  openingHours: OpeningHours | undefined,
  dayKey: string,          // 'mon' | 'tue' | ... | 'sun'
  arrivalHHMM: string,     // e.g. '10:30'
  durationMins: number
): number {
  if (!openingHours) return 0.5  // unknown — neutral

  const dayHours = openingHours[dayKey]
  if (!dayHours) return 0.0      // closed on this day

  const [openStr, closeStr] = dayHours
  const open  = timeToMins(openStr)
  const close = timeToMins(closeStr)
  const arrival  = timeToMins(arrivalHHMM)
  const departure = arrival + durationMins

  if (arrival >= open && departure <= close) return 1.0   // fully inside hours
  if (departure <= open || arrival >= close) return 0.0   // fully outside
  // Partial overlap — proportional score
  const overlap = Math.min(departure, close) - Math.max(arrival, open)
  return overlap / durationMins
}

/**
 * Return top N places sorted by composite score descending.
 * This is the main entry point for the recommendation engine.
 */
export function rankPlaces(
  places: CandidatePlace[],
  intent: TravelIntent,
  originLat?: number,
  originLng?: number,
  topN: number = 20
): CandidatePlace[] {
  return [...places]
    .map(p => ({ place: p, score: scorePlace(p, intent, originLat, originLng) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(({ place }) => place)
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function scorePriceLevel(priceLevel: number | undefined, budget: BudgetTier): number {
  if (priceLevel === undefined) return 0.6
  const ideal: Record<BudgetTier, number> = { budget: 1, 'mid-range': 2, luxury: 4 }
  const diff = Math.abs(priceLevel - ideal[budget])
  return Math.max(0, 1 - diff * 0.25)
}

function scoreDistance(
  place: CandidatePlace,
  originLat?: number,
  originLng?: number
): number {
  if (originLat === undefined || originLng === undefined) return 0.5
  const km = haversineKm(originLat, originLng, place.latitude, place.longitude)
  // Ideal: 0–2 km = 1.0, penalty beyond, floored at 0.1
  return Math.max(0.1, 1 - km * 0.04)
}

function timeToMins(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
