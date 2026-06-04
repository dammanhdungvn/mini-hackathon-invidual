/**
 * Scoring functions for ranking hotels and attractions.
 * Pure TypeScript — no external API calls, no side effects.
 *
 * Used by:
 *   - lib/services/recommendations.ts (attraction ranking)
 *   - app/api/ai/generate-itinerary/route.ts (hotel ranking)
 */

import type { CandidatePlace, OpeningHours } from '@/lib/types/place'
import type { BudgetTier, TravelIntent, TripHotel, RankedHotel } from '@/lib/types/trip'
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

/**
 * Score a hotel using 4 independent factors — deterministic, no LLM involvement.
 *
 * Factors and weights:
 *   - quality   (30%): star rating + popularity proxy
 *   - price     (30%): budget tier match + price/value ratio
 *   - location  (25%): distance to itinerary centroid + nearby attractions bonus
 *   - preference (15%): travel style alignment + interest keyword match
 *
 * Returns a RankedHotel with composite score and per-factor breakdown.
 */
export function scoreHotelDetailed(
  hotel: TripHotel,
  budgetTier: BudgetTier,
  options: {
    centroidLat?: number
    centroidLng?: number
    travelPace?: string
    interests?: string[]
  } = {}
): RankedHotel {
  const quality    = scoreHotelQuality(hotel)
  const price      = scoreHotelPrice(hotel, budgetTier)
  const location   = scoreHotelLocation(hotel, options.centroidLat, options.centroidLng)
  const preference = scoreHotelPreference(hotel, options.travelPace, options.interests)

  const composite = (
    quality    * 0.30 +
    price      * 0.30 +
    location   * 0.25 +
    preference * 0.15
  )

  return {
    ...hotel,
    score: parseFloat(composite.toFixed(4)),
    scoreBreakdown: { location, price, quality, preference },
  }
}

/**
 * Rank a list of hotels by composite score descending.
 * Returns top N, deterministic — same input always produces same output.
 * Does NOT involve the LLM.
 */
export function rankHotels(
  hotels: TripHotel[],
  budgetTier: BudgetTier,
  options: {
    centroidLat?: number
    centroidLng?: number
    travelPace?: string
    interests?: string[]
    topN?: number
  } = {}
): RankedHotel[] {
  const { topN = 5, ...scoringOpts } = options
  return [...hotels]
    .map(h => scoreHotelDetailed(h, budgetTier, scoringOpts))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map((h, i) => ({ ...h, rank: i + 1 }))
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

// ─── Hotel detailed scoring helpers ─────────────────────────────────────────

function scoreHotelQuality(hotel: TripHotel): number {
  // Normalise rating (0–5) to 0–1. Missing rating defaults to 3.5.
  return (hotel.rating ?? 3.5) / 5
}

function scoreHotelPrice(hotel: TripHotel, budget: BudgetTier): number {
  const target = BUDGET_TARGET[budget]
  const price  = hotel.price_per_night ?? target
  const ratio  = price / target
  // Under-budget preferred; massive overspend penalised heavily
  if (ratio <= 0.5) return 0.75   // very cheap — good value but not luxury
  if (ratio <= 1.0) return 0.9 + (ratio - 0.5) * 0.2   // sweet spot
  return Math.max(0, 1 - (ratio - 1) * 0.8)             // over-budget penalty
}

function scoreHotelLocation(
  hotel: TripHotel,
  centroidLat?: number,
  centroidLng?: number
): number {
  if (
    centroidLat === undefined || centroidLng === undefined ||
    hotel.latitude === undefined || hotel.longitude === undefined
  ) return 0.5  // unknown coordinates — neutral

  const km = haversineKm(centroidLat, centroidLng, hotel.latitude, hotel.longitude)
  // <1 km from itinerary centre = perfect; degrades linearly; floor 0.05
  return Math.max(0.05, 1 - km * 0.06)
}

function scoreHotelPreference(
  hotel: TripHotel,
  travelPace?: string,
  interests?: string[]
): number {
  // Pace alignment: luxury hotels align with slow pace, budget with fast
  let paceScore = 0.5
  if (travelPace === 'slow' && (hotel.price_per_night ?? 0) >= BUDGET_TARGET['mid-range']) paceScore = 0.8
  if (travelPace === 'fast' && (hotel.price_per_night ?? 0) <= BUDGET_TARGET['budget'] * 1.5) paceScore = 0.75

  // Interest keyword match against hotel name (proxy for category)
  let interestScore = 0.5
  if (interests && interests.length > 0) {
    const nameLower = hotel.name.toLowerCase()
    const keywords = ['boutique', 'resort', 'garden', 'beach', 'city', 'heritage', 'art', 'design']
    const hotelKeywords = keywords.filter(k => nameLower.includes(k))
    const matchedInterests = interests.filter(i =>
      hotelKeywords.some(k => i.toLowerCase().includes(k)) ||
      nameLower.includes(i.toLowerCase())
    )
    interestScore = matchedInterests.length > 0 ? Math.min(1, 0.5 + matchedInterests.length * 0.2) : 0.5
  }

  return (paceScore + interestScore) / 2
}
