/**
 * Google Places API service with 14-day Supabase cache.
 * ALL place data comes through this file — never fetch places anywhere else.
 */

import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { CandidatePlace, NormalizedPlace, OpeningHours } from '@/lib/types/place'

const CACHE_TTL_DAYS = 14
const PLACES_API_BASE = 'https://places.googleapis.com/v1/places'
const FIELD_MASK = [
  'places.id', 'places.displayName', 'places.location', 'places.rating',
  'places.priceLevel', 'places.regularOpeningHours', 'places.formattedAddress',
  'places.editorialSummary', 'places.primaryType',
].join(',')

const GooglePlacePeriodSchema = z.object({
  open:  z.object({ day: z.number(), hour: z.number(), minute: z.number() }).optional(),
  close: z.object({ day: z.number(), hour: z.number(), minute: z.number() }).optional(),
})

const GooglePlaceSchema = z.object({
  id:                   z.string(),
  displayName:          z.object({ text: z.string() }).optional(),
  location:             z.object({ latitude: z.number(), longitude: z.number() }).optional(),
  rating:               z.number().optional(),
  priceLevel:           z.string().optional(),
  regularOpeningHours:  z.object({ periods: z.array(GooglePlacePeriodSchema).optional() }).optional(),
  formattedAddress:     z.string().optional(),
  editorialSummary:     z.object({ text: z.string() }).optional(),
  primaryType:          z.string().optional(),
})

const GooglePlacesResponseSchema = z.object({
  places: z.array(GooglePlaceSchema).optional().default([]),
})

/** Search for places near a city by category.
 *  Checks Supabase cache first; falls back to Google Places API; falls back to mock data.
 */
export async function searchPlacesNearby(
  city: string,
  category: 'attraction' | 'restaurant',
  maxResults: number = 15
): Promise<CandidatePlace[]> {
  const supabase = createSupabaseServerClient()
  const ttlDate  = new Date(Date.now() - CACHE_TTL_DAYS * 24 * 3600 * 1000).toISOString()

  // 1. Cache check
  const { data: cached } = await supabase
    .from('places')
    .select('place_id, name, category, latitude, longitude, rating, price_level, opening_hours, address')
    .ilike('city', `%${city}%`)
    .eq('category', category)
    .gte('last_fetched', ttlDate)
    .limit(maxResults)

  if (cached && cached.length >= 5) return cached.map(toCandidatePlace)

  // 2. Live fetch
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  const isMockMode = process.env.DATA_SOURCE === 'mock' || !apiKey;

  if (isMockMode) {
    console.warn('[google-places] Mock mode enabled or API key not set — using mock data')
    if (cached && cached.length > 0) return cached.map(toCandidatePlace)
    return getMockPlaces(city, category, maxResults)
  }

  try {
    const res = await fetch(`${PLACES_API_BASE}:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: `${category === 'attraction' ? 'top tourist attractions' : 'best restaurants'} in ${city}`,
        maxResultCount: maxResults,
      }),
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const validated = GooglePlacesResponseSchema.parse(await res.json())
    const normalized = validated.places.map(p => normalizeGooglePlace(p, city, category))

    if (normalized.length > 0) {
      await supabase.from('places').upsert(
        normalized.map(p => ({ ...p, last_fetched: new Date().toISOString() }))
      )
    }

    return normalized.map(p => toCandidatePlace(p as unknown as Record<string, unknown>))
  } catch (err) {
    console.error('[google-places] API error:', err)
    if (cached && cached.length > 0) return cached.map(toCandidatePlace)
    return getMockPlaces(city, category, maxResults)
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeGooglePlace(
  raw: z.infer<typeof GooglePlaceSchema>,
  city: string,
  category: string
): NormalizedPlace {
  return {
    place_id:      raw.id,
    name:          raw.displayName?.text ?? 'Unknown Place',
    category:      category as 'attraction' | 'restaurant',
    latitude:      raw.location?.latitude ?? 0,
    longitude:     raw.location?.longitude ?? 0,
    address:       raw.formattedAddress,
    rating:        raw.rating,
    price_level:   parsePriceLevel(raw.priceLevel),
    opening_hours: parseOpeningHours(raw.regularOpeningHours?.periods),
    summary:       raw.editorialSummary?.text,
    city,
  }
}

function parsePriceLevel(level?: string): 1 | 2 | 3 | 4 | undefined {
  const map: Record<string, 1 | 2 | 3 | 4> = {
    PRICE_LEVEL_FREE: 1, PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4,
  }
  return level ? map[level] : undefined
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function parseOpeningHours(
  periods?: Array<z.infer<typeof GooglePlacePeriodSchema>>
): OpeningHours | undefined {
  if (!periods?.length) return undefined
  const hours: OpeningHours = {}
  for (const p of periods) {
    if (p.open !== undefined) {
      const day   = DAY_KEYS[p.open.day]
      const open  = `${p.open.hour.toString().padStart(2, '0')}:${p.open.minute.toString().padStart(2, '0')}`
      const close = p.close ? `${p.close.hour.toString().padStart(2, '0')}:${p.close.minute.toString().padStart(2, '0')}` : '23:59'
      hours[day]  = [open, close]
    }
  }
  return Object.keys(hours).length ? hours : undefined
}

function toCandidatePlace(row: Record<string, unknown>): CandidatePlace {
  return {
    placeId:      row.place_id as string,
    name:         row.name as string,
    category:     (row.category as 'attraction' | 'restaurant') ?? 'attraction',
    latitude:     row.latitude as number,
    longitude:    row.longitude as number,
    rating:       (row.rating as number) ?? 3.5,
    priceLevel:   row.price_level as number | undefined,
    openingHours: row.opening_hours as OpeningHours | undefined,
    durationMins: (row.category as string) === 'restaurant' ? 60 : 90,
    address:      row.address as string | undefined,
  }
}

function getMockPlaces(city: string, category: 'attraction' | 'restaurant', count: number): CandidatePlace[] {
  const base = category === 'attraction' ? [
    { name: `${city} National Museum`,      durationMins: 120, rating: 4.5 },
    { name: `${city} Old Town`,             durationMins: 90,  rating: 4.3 },
    { name: `${city} City Park`,            durationMins: 60,  rating: 4.2 },
    { name: `${city} Art Gallery`,          durationMins: 90,  rating: 4.4 },
    { name: `${city} Historical Monument`,  durationMins: 60,  rating: 4.1 },
    { name: `${city} Cultural Centre`,      durationMins: 75,  rating: 4.0 },
  ] : [
    { name: `${city} Local Kitchen`,        durationMins: 60,  rating: 4.4 },
    { name: `${city} Street Food Market`,   durationMins: 45,  rating: 4.6 },
    { name: `${city} Fine Dining`,          durationMins: 90,  rating: 4.7 },
  ]

  return base.slice(0, count).map((p, i) => ({
    placeId:      `mock-${category}-${i}`,
    name:         p.name,
    category,
    latitude:     35.6762 + i * 0.01,
    longitude:    139.6503 + i * 0.01,
    rating:       p.rating,
    durationMins: p.durationMins,
    openingHours: {
      mon: ['09:00', '18:00'], tue: ['09:00', '18:00'], wed: ['09:00', '18:00'],
      thu: ['09:00', '18:00'], fri: ['09:00', '18:00'], sat: ['10:00', '17:00'],
    } as OpeningHours,
  }))
}
