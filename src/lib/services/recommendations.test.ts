import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CandidatePlace } from '@/lib/types/place'
import type { TravelIntent } from '@/lib/types/trip'

// Mock external dependencies — no HTTP calls in tests
vi.mock('@/lib/services/google-places', () => {
  return {
    searchPlacesNearby: vi.fn(),
  }
})

vi.mock('@/lib/supabase/server', () => {
  const mockClient = {
    from: () => ({
      select: () => ({
        eq: () => ({
          gte: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    }),
  }
  return {
    createSupabaseServerClient: () => mockClient,
  }
})

import { searchPlacesNearby } from '@/lib/services/google-places'
import { getRecommendedAttractions } from './recommendations'

const mockIntent: TravelIntent = {
  destination: 'Tokyo',
  startDate: '2024-06-03',
  endDate: '2024-06-05',
  durationDays: 2,
  adults: 2,
  budgetTier: 'mid-range',
  travelPace: 'moderate',
  interests: ['temples', 'culture'],
  avoidCategories: [],
  mustVisit: [],
}

const mockCandidates: CandidatePlace[] = [
  {
    placeId: 'p-low',
    name: 'Mediocre Museum',
    category: 'attraction',
    latitude: 35.6900,
    longitude: 139.6700,
    rating: 2.0,
    durationMins: 90,
    similarityScore: 0.1,
  },
  {
    placeId: 'p-high',
    name: 'Senso-ji Temple',
    category: 'attraction',
    latitude: 35.7148,
    longitude: 139.7967,
    rating: 4.9,
    durationMins: 90,
    similarityScore: 0.95,
  },
  {
    placeId: 'p-mid',
    name: 'City Art Gallery',
    category: 'attraction',
    latitude: 35.6800,
    longitude: 139.6600,
    rating: 3.8,
    durationMins: 60,
    similarityScore: 0.6,
  },
]

describe('getRecommendedAttractions', () => {
  beforeEach(() => {
    vi.mocked(searchPlacesNearby).mockResolvedValue(mockCandidates)
  })

  it('returns an array of CandidatePlaces', async () => {
    const results = await getRecommendedAttractions(mockIntent)
    expect(Array.isArray(results)).toBe(true)
  })

  it('returns results sorted by score — highest first', async () => {
    const results = await getRecommendedAttractions(mockIntent)
    expect(results[0].placeId).toBe('p-high')
    expect(results[results.length - 1].placeId).toBe('p-low')
  })

  it('LLM does NOT create places — all results come from the places service', async () => {
    const results = await getRecommendedAttractions(mockIntent)
    const resultIds = new Set(results.map(r => r.placeId))
    const sourceIds = new Set(mockCandidates.map(c => c.placeId))
    resultIds.forEach(id => {
      expect(sourceIds.has(id)).toBe(true)
    })
  })

  it('respects the topN limit', async () => {
    const results = await getRecommendedAttractions(mockIntent, { topN: 2 })
    expect(results.length).toBeLessThanOrEqual(2)
  })

  it('returns empty array when no candidates are found', async () => {
    vi.mocked(searchPlacesNearby).mockResolvedValue([])
    const results = await getRecommendedAttractions(mockIntent)
    expect(results).toHaveLength(0)
  })

  it('filters out candidates with ratings below minRating threshold', async () => {
    const results = await getRecommendedAttractions(mockIntent, { minRating: 3.5 })
    results.forEach(r => {
      expect(r.rating).toBeGreaterThanOrEqual(3.5)
    })
  })

  it('calls searchPlacesNearby with the correct destination', async () => {
    await getRecommendedAttractions(mockIntent)
    expect(searchPlacesNearby).toHaveBeenCalledWith(
      mockIntent.destination,
      'attraction',
      expect.any(Number)
    )
  })
})
