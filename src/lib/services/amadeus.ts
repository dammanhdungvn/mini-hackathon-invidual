// Amadeus hotel search with OAuth2 token caching.

import { z } from 'zod'
import type { TripHotel } from '@/lib/types/trip'

const BASE = process.env.NODE_ENV === 'production'
  ? 'https://api.amadeus.com'
  : 'https://test.api.amadeus.com'

let cachedToken: string | null = null
let tokenExpiry = 0

const TokenSchema = z.object({ access_token: z.string(), expires_in: z.number() })
const HotelSchema = z.object({
  hotelId: z.string(),
  name: z.string(),
  geoCode: z.object({ latitude: z.number(), longitude: z.number() }).optional(),
  rating: z.string().optional(),
})
const HotelsResponseSchema = z.object({ data: z.array(HotelSchema).optional().default([]) })

export async function searchHotels(
  cityCode: string,
  checkIn: string,
  checkOut: string,
  adults: number = 1
): Promise<TripHotel[]> {
  const clientId     = process.env.AMADEUS_CLIENT_ID
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.warn('[amadeus] Credentials not set — using mock data')
    return getMockHotels(cityCode)
  }

  try {
    const token  = await getToken(clientId, clientSecret)
    const params = new URLSearchParams({ cityCode, checkInDate: checkIn, checkOutDate: checkOut, adults: String(adults), max: '10' })
    const res    = await fetch(`${BASE}/v2/shopping/hotel-offers?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const validated = HotelsResponseSchema.parse(await res.json())
    return validated.data.slice(0, 5).map((h, i) => ({
      id: '', trip_id: '',
      amadeus_hotel_id: h.hotelId,
      name:             h.name,
      latitude:         h.geoCode?.latitude,
      longitude:        h.geoCode?.longitude,
      rating:           h.rating ? parseFloat(h.rating) : undefined,
      price_per_night:  undefined,
      currency:         'USD',
      rank:             i + 1,
    }))
  } catch (err) {
    console.error('[amadeus] Error:', err)
    return getMockHotels(cityCode)
  }
}

async function getToken(id: string, secret: string): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken
  const res = await fetch(`${BASE}/v1/security/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
  })
  if (!res.ok) throw new Error(`Auth error: ${res.status}`)
  const data   = TokenSchema.parse(await res.json())
  cachedToken  = data.access_token
  tokenExpiry  = Date.now() + (data.expires_in - 60) * 1000
  return cachedToken
}

function getMockHotels(cityCode: string): TripHotel[] {
  return [
    { id: '', trip_id: '', amadeus_hotel_id: `h1-${cityCode}`, name: `${cityCode} Grand Hotel`, latitude: 35.6762, longitude: 139.6503, rating: 4.5, price_per_night: 180, currency: 'USD', rank: 1 },
    { id: '', trip_id: '', amadeus_hotel_id: `h2-${cityCode}`, name: `${cityCode} Boutique Stay`, latitude: 35.6812, longitude: 139.6550, rating: 4.2, price_per_night: 120, currency: 'USD', rank: 2 },
    { id: '', trip_id: '', amadeus_hotel_id: `h3-${cityCode}`, name: `${cityCode} Budget Inn`, latitude: 35.6700, longitude: 139.6450, rating: 3.8, price_per_night: 70, currency: 'USD', rank: 3 },
  ]
}
