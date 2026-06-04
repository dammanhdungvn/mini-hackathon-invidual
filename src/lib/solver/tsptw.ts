/**
 * Greedy TSPTW Scheduler.
 * Pure TypeScript — no async, no external calls, fully deterministic.
 */

import type { CandidatePlace, OpeningHours } from '@/lib/types/place'
import type { TravelIntent, TravelPace, ScheduledItem, TransitInfo } from '@/lib/types/trip'
import { haversineKm, estimateTravelMins } from './haversine'

const DAY_SCHEDULE: Record<TravelPace, { start: string; end: string; maxPlaces: number }> = {
  slow:     { start: '09:30', end: '20:00', maxPlaces: 3 },
  moderate: { start: '09:00', end: '21:00', maxPlaces: 5 },
  fast:     { start: '08:00', end: '22:00', maxPlaces: 7 },
}

const DEFAULT_DURATION: Record<string, number> = {
  attraction: 90,
  restaurant: 60,
  hotel: 0,
  transit: 30,
}

export interface SolverOptions {
  pace: TravelPace
  startDate: string
  hotelLat?: number
  hotelLng?: number
}

export interface SolverResult {
  schedule: ScheduledItem[]
  conflicts: string[]
}

/** Build an optimised day-by-day schedule from candidate places. */
export function buildSchedule(
  candidates: CandidatePlace[],
  intent: TravelIntent,
  options: SolverOptions
): SolverResult {
  const { pace, startDate, hotelLat = 0, hotelLng = 0 } = options
  const config = DAY_SCHEDULE[pace]

  const attractions = candidates.filter(p => p.category === 'attraction')
  const restaurants = candidates.filter(p => p.category === 'restaurant')

  const allScheduled: ScheduledItem[] = []
  const conflicts: string[] = []
  const usedIds = new Set<string>()

  for (let day = 1; day <= intent.durationDays; day++) {
    const dateStr  = addDays(startDate, day - 1)
    const dayKey   = getDayKey(dateStr)
    const dayEnd   = timeToMins(config.end)

    const dayAttractions = attractions
      .filter(p => !usedIds.has(p.placeId) && isOpenOnDay(p.openingHours, dayKey))
      .slice(0, config.maxPlaces - 1)

    const dayRestaurants = restaurants
      .filter(p => !usedIds.has(p.placeId) && isOpenOnDay(p.openingHours, dayKey))
      .slice(0, 1)

    const dayPool = [...dayAttractions, ...dayRestaurants]
    const ordered = greedyOrder(dayPool, hotelLat, hotelLng)

    let currentTime = timeToMins(config.start)
    let currentLat  = hotelLat
    let currentLng  = hotelLng
    let seq = 0

    for (const place of ordered) {
      const travelMins    = estimateTravelMins(currentLat, currentLng, place.latitude, place.longitude)
      const arrivalMins   = currentTime + travelMins
      const duration      = place.durationMins || DEFAULT_DURATION[place.category] || 60

      const openMins  = getOpenMins(place.openingHours, dayKey)  ?? timeToMins('08:00')
      const closeMins = getCloseMins(place.openingHours, dayKey) ?? timeToMins('22:00')
      const effective = Math.max(arrivalMins, openMins)

      if (effective + duration > Math.min(closeMins, dayEnd)) {
        conflicts.push(place.placeId)
        continue
      }

      const transit: TransitInfo | undefined = seq > 0 ? {
        mode: travelMins <= 20 ? 'walk' : 'taxi',
        duration_mins: travelMins,
        distance_km: parseFloat(
          haversineKm(currentLat, currentLng, place.latitude, place.longitude).toFixed(2)
        ),
      } : undefined

      allScheduled.push({
        placeId:      place.placeId,
        placeName:    place.name,
        category:     place.category,
        latitude:     place.latitude,
        longitude:    place.longitude,
        startTime:    minsToTime(effective),
        endTime:      minsToTime(effective + duration),
        durationMins: duration,
        sequenceNum:  seq,
        dayNumber:    day,
        conflict:     false,
        openingHours: place.openingHours as Record<string, string[]> | undefined,
        transitToNext: transit,
      })

      usedIds.add(place.placeId)
      currentTime = effective + duration
      currentLat  = place.latitude
      currentLng  = place.longitude
      seq++
    }
  }

  return { schedule: allScheduled, conflicts }
}

// ─── Private helpers ─────────────────────────────────────────────────────────

function greedyOrder(places: CandidatePlace[], startLat: number, startLng: number): CandidatePlace[] {
  const remaining = [...places]
  const result: CandidatePlace[] = []
  let lat = startLat, lng = startLng

  while (remaining.length > 0) {
    let nearestIdx = 0, nearestDist = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(lat, lng, remaining[i].latitude, remaining[i].longitude)
      if (d < nearestDist) { nearestDist = d; nearestIdx = i }
    }
    const chosen = remaining.splice(nearestIdx, 1)[0]
    result.push(chosen)
    lat = chosen.latitude
    lng = chosen.longitude
  }
  return result
}

function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minsToTime(mins: number): string {
  return `${Math.floor(mins / 60).toString().padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}`
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function getDayKey(dateStr: string): string {
  return DAY_KEYS[new Date(dateStr).getDay()]
}

function isOpenOnDay(hours: OpeningHours | undefined, dayKey: string): boolean {
  if (!hours) return true
  return hours[dayKey] !== null && hours[dayKey] !== undefined
}

function getOpenMins(hours: OpeningHours | undefined, dayKey: string): number | null {
  if (!hours || !hours[dayKey]) return null
  return timeToMins(hours[dayKey]![0])
}

function getCloseMins(hours: OpeningHours | undefined, dayKey: string): number | null {
  if (!hours || !hours[dayKey]) return null
  return timeToMins(hours[dayKey]![1])
}
