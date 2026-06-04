/**
 * TDD tests for hotel recommendation scoring.
 * Written BEFORE implementation per TDD protocol.
 *
 * Tests cover:
 *   - scoreHotelDetailed: 4-factor scoring (quality, price, location, preference)
 *   - rankHotels: sorting, topN, determinism, non-mutation
 *   - Budget matching edge cases
 *   - Empty hotel list
 *   - Missing / invalid data handling
 */

import { describe, it, expect } from 'vitest'
import {
  scoreHotelDetailed,
  rankHotels,
  BUDGET_TARGET,
} from './scorer'
import type { TripHotel } from '@/lib/types/trip'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const makeHotel = (overrides: Partial<TripHotel> = {}): TripHotel => ({
  id: '',
  trip_id: '',
  amadeus_hotel_id: 'h1',
  name: 'Test Hotel',
  latitude: 35.6762,
  longitude: 139.6503,
  rating: 4.0,
  price_per_night: 150,
  currency: 'USD',
  rank: 1,
  ...overrides,
})

// ─── scoreHotelDetailed ───────────────────────────────────────────────────────

describe('scoreHotelDetailed', () => {
  it('returns a composite score between 0 and 1', () => {
    const result = scoreHotelDetailed(makeHotel(), 'mid-range')
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(1)
  })

  it('returns all four score breakdown factors', () => {
    const result = scoreHotelDetailed(makeHotel(), 'mid-range')
    expect(result.scoreBreakdown).toHaveProperty('quality')
    expect(result.scoreBreakdown).toHaveProperty('price')
    expect(result.scoreBreakdown).toHaveProperty('location')
    expect(result.scoreBreakdown).toHaveProperty('preference')
    // Each factor must be in 0–1
    Object.values(result.scoreBreakdown).forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    })
  })

  it('quality factor — high rating scores higher than low rating', () => {
    const high = scoreHotelDetailed(makeHotel({ rating: 5.0 }), 'mid-range')
    const low  = scoreHotelDetailed(makeHotel({ rating: 2.0 }), 'mid-range')
    expect(high.scoreBreakdown.quality).toBeGreaterThan(low.scoreBreakdown.quality)
  })

  it('quality factor — missing rating uses neutral default (not 0)', () => {
    const result = scoreHotelDetailed(makeHotel({ rating: undefined }), 'mid-range')
    expect(result.scoreBreakdown.quality).toBeGreaterThan(0)
    expect(result.scoreBreakdown.quality).toBeLessThan(1)
  })

  it('price factor — on-budget hotel scores higher than over-budget', () => {
    const target = BUDGET_TARGET['mid-range'] // 150
    const onBudget  = scoreHotelDetailed(makeHotel({ price_per_night: target }), 'mid-range')
    const overBudget = scoreHotelDetailed(makeHotel({ price_per_night: target * 3 }), 'mid-range')
    expect(onBudget.scoreBreakdown.price).toBeGreaterThan(overBudget.scoreBreakdown.price)
  })

  it('price factor — budget hotel for budget tier scores well', () => {
    const result = scoreHotelDetailed(
      makeHotel({ price_per_night: 50 }),
      'budget'
    )
    expect(result.scoreBreakdown.price).toBeGreaterThan(0.6)
  })

  it('price factor — luxury hotel for budget tier scores poorly', () => {
    const result = scoreHotelDetailed(
      makeHotel({ price_per_night: 800 }),
      'budget'
    )
    expect(result.scoreBreakdown.price).toBeLessThan(0.3)
  })

  it('location factor — hotel near centroid scores higher than distant hotel', () => {
    const nearby  = scoreHotelDetailed(
      makeHotel({ latitude: 35.6770, longitude: 139.6510 }),
      'mid-range',
      { centroidLat: 35.6762, centroidLng: 139.6503 }
    )
    const distant = scoreHotelDetailed(
      makeHotel({ latitude: 36.5000, longitude: 140.0000 }),
      'mid-range',
      { centroidLat: 35.6762, centroidLng: 139.6503 }
    )
    expect(nearby.scoreBreakdown.location).toBeGreaterThan(distant.scoreBreakdown.location)
  })

  it('location factor — unknown coordinates returns neutral 0.5', () => {
    const result = scoreHotelDetailed(
      makeHotel({ latitude: undefined, longitude: undefined }),
      'mid-range'
    )
    expect(result.scoreBreakdown.location).toBe(0.5)
  })

  it('location factor — no centroid provided returns neutral 0.5', () => {
    const result = scoreHotelDetailed(makeHotel(), 'mid-range', {})
    expect(result.scoreBreakdown.location).toBe(0.5)
  })

  it('preference factor — returns a value between 0 and 1', () => {
    const result = scoreHotelDetailed(makeHotel(), 'mid-range', {
      travelPace: 'moderate',
      interests: ['culture', 'food'],
    })
    expect(result.scoreBreakdown.preference).toBeGreaterThanOrEqual(0)
    expect(result.scoreBreakdown.preference).toBeLessThanOrEqual(1)
  })

  it('is deterministic — same input produces identical output', () => {
    const hotel = makeHotel({ rating: 4.2, price_per_night: 140 })
    const opts  = { centroidLat: 35.68, centroidLng: 139.65, travelPace: 'moderate' }
    const r1 = scoreHotelDetailed(hotel, 'mid-range', opts)
    const r2 = scoreHotelDetailed(hotel, 'mid-range', opts)
    expect(r1.score).toBe(r2.score)
    expect(r1.scoreBreakdown).toEqual(r2.scoreBreakdown)
  })

  it('does NOT mutate the input hotel object', () => {
    const hotel = makeHotel()
    const originalRank = hotel.rank
    scoreHotelDetailed(hotel, 'mid-range')
    expect(hotel.rank).toBe(originalRank)
  })

  it('handles invalid/edge data without throwing', () => {
    expect(() => scoreHotelDetailed(makeHotel({ price_per_night: 0 }), 'luxury')).not.toThrow()
    expect(() => scoreHotelDetailed(makeHotel({ rating: 0 }), 'budget')).not.toThrow()
    expect(() => scoreHotelDetailed(makeHotel({ price_per_night: 99999 }), 'budget')).not.toThrow()
  })
})

// ─── rankHotels ──────────────────────────────────────────────────────────────

describe('rankHotels', () => {
  const hotels: TripHotel[] = [
    makeHotel({ amadeus_hotel_id: 'low',  rating: 2.0, price_per_night: 500 }),
    makeHotel({ amadeus_hotel_id: 'high', rating: 4.8, price_per_night: 150 }),
    makeHotel({ amadeus_hotel_id: 'mid',  rating: 3.5, price_per_night: 160 }),
  ]

  it('returns hotels sorted by composite score — highest first', () => {
    const ranked = rankHotels(hotels, 'mid-range')
    expect(ranked[0].amadeus_hotel_id).toBe('high')
    expect(ranked[ranked.length - 1].amadeus_hotel_id).toBe('low')
  })

  it('reassigns rank property sequentially starting at 1', () => {
    const ranked = rankHotels(hotels, 'mid-range')
    ranked.forEach((h, i) => expect(h.rank).toBe(i + 1))
  })

  it('respects topN limit', () => {
    const ranked = rankHotels(hotels, 'mid-range', { topN: 2 })
    expect(ranked).toHaveLength(2)
  })

  it('returns all hotels when topN exceeds input length', () => {
    const ranked = rankHotels(hotels, 'mid-range', { topN: 100 })
    expect(ranked).toHaveLength(hotels.length)
  })

  it('returns empty array for empty input', () => {
    const ranked = rankHotels([], 'mid-range')
    expect(ranked).toHaveLength(0)
  })

  it('does NOT mutate the input array', () => {
    const original = [...hotels]
    rankHotels(hotels, 'mid-range')
    expect(hotels[0].amadeus_hotel_id).toBe(original[0].amadeus_hotel_id)
  })

  it('is deterministic — same input always produces same ranking', () => {
    const opts = { centroidLat: 35.68, centroidLng: 139.65, travelPace: 'moderate' as const }
    const r1 = rankHotels(hotels, 'mid-range', opts)
    const r2 = rankHotels(hotels, 'mid-range', opts)
    expect(r1.map(h => h.amadeus_hotel_id)).toEqual(r2.map(h => h.amadeus_hotel_id))
  })

  it('each RankedHotel has a score and scoreBreakdown', () => {
    const ranked = rankHotels(hotels, 'mid-range')
    ranked.forEach(h => {
      expect(h.score).toBeGreaterThanOrEqual(0)
      expect(h.score).toBeLessThanOrEqual(1)
      expect(h.scoreBreakdown).toBeDefined()
    })
  })

  it('budget-tier hotel ranks first for budget budget tier', () => {
    const budgetHotels: TripHotel[] = [
      makeHotel({ amadeus_hotel_id: 'cheap', rating: 3.8, price_per_night: 55 }),
      makeHotel({ amadeus_hotel_id: 'pricey', rating: 4.5, price_per_night: 350 }),
    ]
    const ranked = rankHotels(budgetHotels, 'budget')
    // Budget hotel should rank higher for budget tier despite lower rating
    expect(ranked[0].amadeus_hotel_id).toBe('cheap')
  })

  it('luxury hotel ranks first for luxury budget tier', () => {
    const luxuryHotels: TripHotel[] = [
      makeHotel({ amadeus_hotel_id: 'budget_hotel', rating: 4.2, price_per_night: 60 }),
      makeHotel({ amadeus_hotel_id: 'luxury_hotel', rating: 4.7, price_per_night: 400 }),
    ]
    const ranked = rankHotels(luxuryHotels, 'luxury')
    expect(ranked[0].amadeus_hotel_id).toBe('luxury_hotel')
  })
})
