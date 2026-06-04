import { describe, it, expect } from 'vitest'
import {
  scoreHotel,
  scorePlace,
  scoreOpeningHourFit,
  rankPlaces,
  BUDGET_TARGET,
} from './scorer'
import type { CandidatePlace } from '@/lib/types/place'
import type { TravelIntent } from '@/lib/types/trip'

// ─── Test fixtures ────────────────────────────────────────────────────────────

const mockIntent: TravelIntent = {
  destination: 'Tokyo',
  startDate: '2024-06-01',
  endDate: '2024-06-04',
  durationDays: 3,
  adults: 2,
  budgetTier: 'mid-range',
  travelPace: 'moderate',
  interests: ['temples', 'food', 'culture'],
  avoidCategories: [],
  mustVisit: [],
}

const makePlace = (overrides: Partial<CandidatePlace> = {}): CandidatePlace => ({
  placeId: 'p1',
  name: 'Test Temple',
  category: 'attraction',
  latitude: 35.6762,
  longitude: 139.6503,
  rating: 4.5,
  durationMins: 90,
  ...overrides,
})

// ─── scoreHotel ──────────────────────────────────────────────────────────────

describe('scoreHotel', () => {
  it('returns a score between 0 and 1', () => {
    const score = scoreHotel({ rating: 4.0, price_per_night: 150 }, 'mid-range')
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })

  it('scores a perfectly-priced hotel above 0.7', () => {
    const score = scoreHotel({ rating: 4.0, price_per_night: BUDGET_TARGET['mid-range'] }, 'mid-range')
    expect(score).toBeGreaterThan(0.7)
  })

  it('penalises a hotel double the target price', () => {
    const onTarget = scoreHotel({ rating: 4.0, price_per_night: 150 }, 'mid-range')
    const tooExpensive = scoreHotel({ rating: 4.0, price_per_night: 300 }, 'mid-range')
    expect(tooExpensive).toBeLessThan(onTarget)
  })

  it('uses defaults when rating and price are missing', () => {
    const score = scoreHotel({}, 'budget')
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThanOrEqual(1)
  })

  it('scores luxury hotel high for luxury budget', () => {
    const score = scoreHotel({ rating: 5.0, price_per_night: 400 }, 'luxury')
    expect(score).toBeGreaterThan(0.8)
  })
})

// ─── scorePlace ───────────────────────────────────────────────────────────────

describe('scorePlace', () => {
  it('returns a value between 0 and 1', () => {
    const score = scorePlace(makePlace(), mockIntent)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })

  it('scores a high-rated, highly-similar place above 0.7', () => {
    const score = scorePlace(makePlace({ rating: 5, similarityScore: 0.95 }), mockIntent)
    expect(score).toBeGreaterThan(0.7)
  })

  it('scores a low-rated, dissimilar place below 0.5', () => {
    const score = scorePlace(makePlace({ rating: 1.5, similarityScore: 0.1 }), mockIntent)
    expect(score).toBeLessThan(0.5)
  })

  it('nearby places score higher than distant ones with equal ratings', () => {
    const nearby = makePlace({ latitude: 35.6770, longitude: 139.6510 }) // ~100m
    const distant = makePlace({ latitude: 35.9000, longitude: 139.9000 }) // ~35km
    const nearScore = scorePlace(nearby, mockIntent, 35.6762, 139.6503)
    const farScore  = scorePlace(distant, mockIntent, 35.6762, 139.6503)
    expect(nearScore).toBeGreaterThan(farScore)
  })
})

// ─── scoreOpeningHourFit ──────────────────────────────────────────────────────

describe('scoreOpeningHourFit', () => {
  const hours = {
    mon: ['09:00', '18:00'] as [string, string],
    tue: ['09:00', '18:00'] as [string, string],
    sat: ['10:00', '17:00'] as [string, string],
    // sun: null (closed)
  }

  it('returns 1.0 when visit fully fits within opening hours', () => {
    expect(scoreOpeningHourFit(hours, 'mon', '10:00', 90)).toBe(1.0)
  })

  it('returns 0.0 when place is definitively closed on that day', () => {
    expect(scoreOpeningHourFit(hours, 'sun', '10:00', 60)).toBe(0.0)
  })

  it('returns 0.5 when hours are unknown (undefined)', () => {
    expect(scoreOpeningHourFit(undefined, 'mon', '10:00', 60)).toBe(0.5)
  })

  it('returns 0.0 when visit is entirely before opening', () => {
    expect(scoreOpeningHourFit(hours, 'mon', '07:00', 60)).toBe(0.0)
  })

  it('returns 0.0 when visit is entirely after closing', () => {
    expect(scoreOpeningHourFit(hours, 'mon', '19:00', 60)).toBe(0.0)
  })

  it('returns partial score for overlap at opening boundary', () => {
    // Visit 08:00–10:00, place opens at 09:00 → 60min overlap out of 120
    const score = scoreOpeningHourFit(hours, 'mon', '08:00', 120)
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(1)
  })
})

// ─── rankPlaces ───────────────────────────────────────────────────────────────

describe('rankPlaces', () => {
  const places: CandidatePlace[] = [
    makePlace({ placeId: 'low',  rating: 2.0, similarityScore: 0.1 }),
    makePlace({ placeId: 'high', rating: 4.8, similarityScore: 0.9 }),
    makePlace({ placeId: 'mid',  rating: 3.5, similarityScore: 0.5 }),
  ]

  it('returns places in descending score order', () => {
    const ranked = rankPlaces(places, mockIntent)
    expect(ranked[0].placeId).toBe('high')
    expect(ranked[ranked.length - 1].placeId).toBe('low')
  })

  it('respects topN limit', () => {
    const ranked = rankPlaces(places, mockIntent, undefined, undefined, 2)
    expect(ranked).toHaveLength(2)
  })

  it('returns all places when topN exceeds input length', () => {
    const ranked = rankPlaces(places, mockIntent, undefined, undefined, 100)
    expect(ranked).toHaveLength(places.length)
  })

  it('does not mutate the original array', () => {
    const original = [...places]
    rankPlaces(places, mockIntent)
    expect(places[0].placeId).toBe(original[0].placeId)
  })
})
