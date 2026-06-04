// All shared types for places, hotels, and map data.
// Single source of truth — never define these shapes inline elsewhere.

export type PlaceCategory = 'attraction' | 'restaurant' | 'hotel' | 'transit'

// ─── Opening hours stored as day → [open, close] times ──────────────────────
// e.g. { "mon": ["09:00", "18:00"], "tue": ["09:00", "18:00"], "sun": null }
export type OpeningHours = Record<string, [string, string] | null>

// ─── Place Cache (mirrors public.places table) ───────────────────────────────

export interface PlaceRecord {
  place_id: string
  name: string
  category?: PlaceCategory
  latitude: number
  longitude: number
  address?: string
  rating?: number
  price_level?: 1 | 2 | 3 | 4
  opening_hours?: OpeningHours
  photos?: string[]
  summary?: string
  embedding?: number[]   // vector(1536) — omitted in most queries
  last_fetched: string   // ISO timestamptz
  city?: string
  country?: string
}

// ─── Candidate Place (used during solver stages 2–3) ────────────────────────

/** A validated, fully-hydrated place ready for the solver to schedule */
export interface CandidatePlace {
  placeId: string
  name: string
  category: PlaceCategory
  latitude: number
  longitude: number
  rating: number           // 0–5
  priceLevel?: number      // 1–4
  openingHours?: OpeningHours
  durationMins: number     // Estimated visit duration
  address?: string
  photos?: string[]
  similarityScore?: number // From pgvector cosine search (0–1)
  distanceKm?: number      // From hotel/origin (filled by scorer)
}

// ─── Google Places API raw shapes (pre-Zod validation) ──────────────────────

export interface GooglePlaceRaw {
  id: string
  displayName?: { text: string }
  location?: { latitude: number; longitude: number }
  rating?: number
  priceLevel?: string
  regularOpeningHours?: {
    periods?: Array<{
      open?: { day: number; hour: number; minute: number }
      close?: { day: number; hour: number; minute: number }
    }>
  }
  formattedAddress?: string
  photos?: Array<{ name: string }>
  editorialSummary?: { text: string }
  primaryType?: string
}

/** Normalized place — ready to upsert into Supabase places cache */
export interface NormalizedPlace extends Omit<PlaceRecord, 'embedding' | 'last_fetched'> {
  place_id: string
}

// ─── Map types ───────────────────────────────────────────────────────────────

export interface LatLng {
  lat: number
  lng: number
}

export interface MapMarker {
  id: string
  position: LatLng
  label: string
  category: PlaceCategory
  color?: string
}
