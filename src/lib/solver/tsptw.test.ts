import { describe, it, expect } from 'vitest'
import { buildSchedule } from './tsptw'
import type { CandidatePlace } from '@/lib/types/place'
import type { TravelIntent } from '@/lib/types/trip'

const mockIntent: TravelIntent = {
  destination: 'Tokyo',
  startDate: '2024-06-03',  // Monday
  endDate: '2024-06-05',
  durationDays: 2,
  adults: 2,
  budgetTier: 'mid-range',
  travelPace: 'moderate',
  interests: ['temples'],
  avoidCategories: [],
  mustVisit: [],
}

const mockHours = {
  mon: ['08:00', '22:00'] as [string, string],
  tue: ['08:00', '22:00'] as [string, string],
  wed: ['08:00', '22:00'] as [string, string],
  thu: ['08:00', '22:00'] as [string, string],
  fri: ['08:00', '22:00'] as [string, string],
  sat: ['08:00', '22:00'] as [string, string],
  sun: ['08:00', '22:00'] as [string, string],
}

const makeCandidate = (id: string, lat: number, lng: number, category: 'attraction' | 'restaurant' = 'attraction'): CandidatePlace => ({
  placeId: id,
  name: `Place ${id}`,
  category,
  latitude: lat,
  longitude: lng,
  rating: 4.0,
  durationMins: 60,
  openingHours: mockHours,
})

describe('buildSchedule', () => {
  it('returns empty schedule for empty input', () => {
    const result = buildSchedule([], mockIntent, { pace: 'moderate', startDate: '2024-06-03' })
    expect(result.schedule).toHaveLength(0)
    expect(result.conflicts).toHaveLength(0)
  })

  it('schedules a single place with no conflicts', () => {
    const candidates = [makeCandidate('p1', 35.6762, 139.6503)]
    const result = buildSchedule(candidates, mockIntent, {
      pace: 'moderate',
      startDate: '2024-06-03',
      hotelLat: 35.6762,   // same coords as place — zero travel time
      hotelLng: 139.6503,
    })
    expect(result.schedule).toHaveLength(1)
    expect(result.conflicts).toHaveLength(0)
    expect(result.schedule[0].placeId).toBe('p1')
  })

  it('assigns day numbers starting from 1', () => {
    const candidates = [
      makeCandidate('p1', 35.6762, 139.6503),
      makeCandidate('p2', 35.6800, 139.6600),
    ]
    const result = buildSchedule(candidates, mockIntent, { pace: 'moderate', startDate: '2024-06-03' })
    const dayNumbers = Array.from(new Set(result.schedule.map(i => i.dayNumber)))
    expect(dayNumbers.every(d => d >= 1)).toBe(true)
  })

  it('does not schedule the same place twice', () => {
    const candidates = [
      makeCandidate('p1', 35.6762, 139.6503),
      makeCandidate('p2', 35.6800, 139.6600),
      makeCandidate('p3', 35.6850, 139.6700),
    ]
    const result = buildSchedule(candidates, mockIntent, { pace: 'moderate', startDate: '2024-06-03' })
    const ids = result.schedule.map(i => i.placeId)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it('start times are in HH:MM format', () => {
    const candidates = [makeCandidate('p1', 35.6762, 139.6503)]
    const result = buildSchedule(candidates, mockIntent, { pace: 'moderate', startDate: '2024-06-03' })
    const timeRegex = /^\d{2}:\d{2}$/
    result.schedule.forEach(item => {
      expect(item.startTime).toMatch(timeRegex)
      expect(item.endTime).toMatch(timeRegex)
    })
  })

  it('sequence numbers are non-negative integers', () => {
    const candidates = [
      makeCandidate('p1', 35.6762, 139.6503),
      makeCandidate('p2', 35.6800, 139.6600),
    ]
    const result = buildSchedule(candidates, mockIntent, { pace: 'moderate', startDate: '2024-06-03' })
    result.schedule.forEach(item => {
      expect(item.sequenceNum).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(item.sequenceNum)).toBe(true)
    })
  })

  it('is deterministic — same input always produces same output', () => {
    const candidates = [
      makeCandidate('p1', 35.6762, 139.6503),
      makeCandidate('p2', 35.6800, 139.6600),
      makeCandidate('p3', 35.6850, 139.6700),
    ]
    const opts = { pace: 'moderate' as const, startDate: '2024-06-03' }
    const result1 = buildSchedule(candidates, mockIntent, opts)
    const result2 = buildSchedule(candidates, mockIntent, opts)
    expect(result1.schedule.map(i => i.placeId)).toEqual(result2.schedule.map(i => i.placeId))
  })
})
