// All shared types for trips, itinerary days, and items.
// Single source of truth — never define these shapes inline elsewhere.

export type BudgetTier = 'budget' | 'mid-range' | 'luxury'
export type TravelPace = 'slow' | 'moderate' | 'fast'
export type ItemType = 'attraction' | 'restaurant' | 'hotel' | 'transit'
export type TripStatus = 'draft' | 'saved' | 'archived'

// ─── Core Trip Record ────────────────────────────────────────────────────────

export interface Trip {
  id: string
  user_id: string
  title: string
  destination: string
  city_code?: string
  start_date: string   // ISO date 'YYYY-MM-DD'
  end_date: string     // ISO date 'YYYY-MM-DD'
  adults: number
  budget_tier?: BudgetTier
  travel_pace?: TravelPace
  user_prompt?: string
  status: TripStatus
  created_at: string
  updated_at: string
}

// ─── Itinerary Structure ─────────────────────────────────────────────────────

export interface ItineraryDay {
  id: string
  trip_id: string
  day_number: number
  date: string
  notes?: string
  items?: ItineraryItem[]
}

export interface ItineraryItem {
  id: string
  day_id: string
  place_id?: string
  item_type: ItemType
  start_time: string   // 'HH:MM'
  end_time: string     // 'HH:MM'
  duration_mins?: number
  sequence_num: number
  ai_tip?: string
  transit_to_next?: TransitInfo
  place?: {
    name: string
    latitude: number
    longitude: number
    rating?: number
    address?: string
    photos?: string[]
  }
}

export interface TransitInfo {
  mode: 'walk' | 'taxi' | 'transit' | 'drive'
  duration_mins: number
  distance_km?: number
}

// ─── Hotel Recommendations ───────────────────────────────────────────────────

export interface TripHotel {
  id: string
  trip_id: string
  amadeus_hotel_id?: string
  name: string
  latitude?: number
  longitude?: number
  rating?: number
  price_per_night?: number
  currency: string
  rank: number
}

// ─── AI Pipeline Types ───────────────────────────────────────────────────────

/** Stage 1 output — structured travel intent from user message */
export interface TravelIntent {
  destination: string
  cityCode?: string
  startDate: string   // 'YYYY-MM-DD'
  endDate: string     // 'YYYY-MM-DD'
  durationDays: number
  adults: number
  budgetTier: BudgetTier
  travelPace: TravelPace
  interests: string[]
  avoidCategories: string[]
  mustVisit: string[]
}

/** Stage 3 output — one item in the locked schedule (immutable after this point) */
export interface ScheduledItem {
  placeId: string
  placeName: string
  category: ItemType
  latitude: number
  longitude: number
  startTime: string   // 'HH:MM'
  endTime: string     // 'HH:MM'
  durationMins: number
  sequenceNum: number
  dayNumber: number
  conflict?: boolean
  openingHours?: Record<string, string[]>
  aiTip?: string
  transitToNext?: TransitInfo
}

/** Grouped schedule by day — input to Stage 4 synthesizer */
export interface LockedSchedule {
  intent: TravelIntent
  days: Record<number, ScheduledItem[]>
}

/** Final API response */
export interface GeneratedItinerary {
  tripId: string
  title: string
  destination: string
  days: ItineraryDay[]
  hotels: TripHotel[]
}
