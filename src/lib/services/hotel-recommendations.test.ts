import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TripHotel } from '@/lib/types/trip'

// Mock Amadeus service — no HTTP calls in tests
vi.mock('@/lib/services/amadeus', () => {
  return { searchHotels: vi.fn() }
})

// Mock AI provider — no real LLM calls
vi.mock('@/lib/ai/provider', () => {
  return {
    getSynthesisModel: vi.fn(() => ({ id: 'mock-model' })),
  }
})

// Mock AI generateObject — returns deterministic ai_reason
vi.mock('ai', () => {
  return {
    generateObject: vi.fn().mockResolvedValue({
      object: {
        recommendations: [
          { amadeus_hotel_id: 'h1', ai_reason: 'Great location near temples' },
          { amadeus_hotel_id: 'h2', ai_reason: 'Excellent value for money' },
          { amadeus_hotel_id: 'h3', ai_reason: 'Perfect for budget travellers' },
        ],
      },
    }),
  }
})

import { searchHotels } from '@/lib/services/amadeus'
import { getRecommendedHotels } from './hotel-recommendations'

const mockHotels: TripHotel[] = [
  {
    id: '', trip_id: '',
    amadeus_hotel_id: 'h1',
    name: 'Tokyo Grand Hotel',
    latitude: 35.6762, longitude: 139.6503,
    rating: 4.5, price_per_night: 150,
    currency: 'USD', rank: 1,
  },
  {
    id: '', trip_id: '',
    amadeus_hotel_id: 'h2',
    name: 'Tokyo Boutique Stay',
    latitude: 35.6812, longitude: 139.6550,
    rating: 4.2, price_per_night: 110,
    currency: 'USD', rank: 2,
  },
  {
    id: '', trip_id: '',
    amadeus_hotel_id: 'h3',
    name: 'Tokyo Budget Inn',
    latitude: 35.6700, longitude: 139.6450,
    rating: 3.8, price_per_night: 65,
    currency: 'USD', rank: 3,
  },
]

describe('getRecommendedHotels', () => {
  beforeEach(() => {
    vi.mocked(searchHotels).mockResolvedValue(mockHotels)
  })

  it('returns an array of RankedHotels', async () => {
    const results = await getRecommendedHotels({
      cityCode: 'TYO',
      checkIn: '2024-06-01',
      checkOut: '2024-06-04',
      adults: 2,
      budgetTier: 'mid-range',
    })
    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBeGreaterThan(0)
  })

  it('results are sorted by score descending', async () => {
    const results = await getRecommendedHotels({
      cityCode: 'TYO',
      checkIn: '2024-06-01',
      checkOut: '2024-06-04',
      adults: 1,
      budgetTier: 'mid-range',
    })
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score)
    }
  })

  it('AI does NOT invent hotels — all results come from Amadeus service', async () => {
    const results = await getRecommendedHotels({
      cityCode: 'TYO',
      checkIn: '2024-06-01',
      checkOut: '2024-06-04',
      adults: 1,
      budgetTier: 'mid-range',
    })
    const sourceIds = new Set(mockHotels.map(h => h.amadeus_hotel_id))
    results.forEach(r => expect(sourceIds.has(r.amadeus_hotel_id)).toBe(true))
  })

  it('AI does NOT invent prices — prices come from Amadeus data', async () => {
    const results = await getRecommendedHotels({
      cityCode: 'TYO',
      checkIn: '2024-06-01',
      checkOut: '2024-06-04',
      adults: 1,
      budgetTier: 'mid-range',
    })
    const sourcePrices = new Set(mockHotels.map(h => h.price_per_night))
    results.forEach(r => {
      if (r.price_per_night !== undefined) {
        expect(sourcePrices.has(r.price_per_night)).toBe(true)
      }
    })
  })

  it('AI does NOT invent ratings — ratings come from Amadeus data', async () => {
    const results = await getRecommendedHotels({
      cityCode: 'TYO',
      checkIn: '2024-06-01',
      checkOut: '2024-06-04',
      adults: 1,
      budgetTier: 'mid-range',
    })
    const sourceRatings = new Set(mockHotels.map(h => h.rating))
    results.forEach(r => {
      if (r.rating !== undefined) {
        expect(sourceRatings.has(r.rating)).toBe(true)
      }
    })
  })

  it('respects topN limit', async () => {
    const results = await getRecommendedHotels({
      cityCode: 'TYO',
      checkIn: '2024-06-01',
      checkOut: '2024-06-04',
      adults: 1,
      budgetTier: 'mid-range',
      topN: 2,
    })
    expect(results.length).toBeLessThanOrEqual(2)
  })

  it('returns empty array when Amadeus returns no hotels', async () => {
    vi.mocked(searchHotels).mockResolvedValue([])
    const results = await getRecommendedHotels({
      cityCode: 'UNKNOWN',
      checkIn: '2024-06-01',
      checkOut: '2024-06-04',
      adults: 1,
      budgetTier: 'mid-range',
    })
    expect(results).toHaveLength(0)
  })

  it('calls searchHotels with the correct city code', async () => {
    await getRecommendedHotels({
      cityCode: 'TYO',
      checkIn: '2024-06-01',
      checkOut: '2024-06-04',
      adults: 2,
      budgetTier: 'budget',
    })
    expect(searchHotels).toHaveBeenCalledWith('TYO', '2024-06-01', '2024-06-04', 2)
  })

  it('each result has a scoreBreakdown with all 4 factors', async () => {
    const results = await getRecommendedHotels({
      cityCode: 'TYO',
      checkIn: '2024-06-01',
      checkOut: '2024-06-04',
      adults: 1,
      budgetTier: 'mid-range',
    })
    results.forEach(r => {
      expect(r.scoreBreakdown).toBeDefined()
      expect(r.scoreBreakdown).toHaveProperty('quality')
      expect(r.scoreBreakdown).toHaveProperty('price')
      expect(r.scoreBreakdown).toHaveProperty('location')
      expect(r.scoreBreakdown).toHaveProperty('preference')
    })
  })

  it('handles invalid external data gracefully — does not throw', async () => {
    vi.mocked(searchHotels).mockResolvedValue([
      { id: '', trip_id: '', name: 'Bad Hotel', rating: undefined, price_per_night: undefined, currency: 'USD', rank: 1 },
    ])
    await expect(getRecommendedHotels({
      cityCode: 'BAD',
      checkIn: '2024-06-01',
      checkOut: '2024-06-04',
      adults: 1,
      budgetTier: 'mid-range',
    })).resolves.not.toThrow()
  })
})
