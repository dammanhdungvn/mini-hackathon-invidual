/**
 * PUT /api/trips/[id]/hotels
 *
 * Save the user's selected hotel for a trip.
 * Creates or updates trip_hotels record.
 *
 * Auth required. Users can only update their own trips.
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'

interface RouteParams {
  params: { id: string }
}

const BodySchema = z.object({
  amadeus_hotel_id: z.string().optional(),
  name:             z.string().min(1),
  latitude:         z.number().optional(),
  longitude:        z.number().optional(),
  rating:           z.number().min(0).max(5).optional(),
  price_per_night:  z.number().min(0).optional(),
  currency:         z.string().default('USD'),
  ai_reason:        z.string().max(500).optional(),
})

export async function PUT(request: NextRequest, { params }: RouteParams) {
  // ── Auth check ────────────────────────────────────────────────────────────
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const tripId = params.id

  // ── Verify trip ownership ─────────────────────────────────────────────────
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('id, user_id')
    .eq('id', tripId)
    .eq('user_id', user.id)
    .single()

  if (tripError || !trip) {
    return Response.json({ error: 'Trip not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  // ── Validate body ─────────────────────────────────────────────────────────
  let body: unknown
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON', code: 'INVALID_BODY' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid body', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  const hotelData = parsed.data

  try {
    // Mark all existing trip hotels as not selected
    await supabase
      .from('trip_hotels')
      .update({ is_selected: false })
      .eq('trip_id', tripId)

    // Upsert the selected hotel
    const { data: saved, error: saveError } = await supabase
      .from('trip_hotels')
      .upsert(
        {
          trip_id:          tripId,
          amadeus_hotel_id: hotelData.amadeus_hotel_id,
          name:             hotelData.name,
          latitude:         hotelData.latitude,
          longitude:        hotelData.longitude,
          rating:           hotelData.rating,
          price_per_night:  hotelData.price_per_night,
          currency:         hotelData.currency,
          ai_reason:        hotelData.ai_reason,
          is_selected:      true,
          rank:             1,
        },
        { onConflict: 'trip_id,amadeus_hotel_id' }
      )
      .select('id, name, rating, price_per_night, currency, ai_reason, is_selected')
      .single()

    if (saveError || !saved) {
      throw new Error(saveError?.message ?? 'Failed to save hotel')
    }

    return Response.json({ hotel: saved })
  } catch (err) {
    console.error('[/api/trips/[id]/hotels]', err)
    return Response.json(
      { error: 'Failed to save selected hotel.', code: 'SAVE_ERROR' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  // ── Auth check ────────────────────────────────────────────────────────────
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const tripId = params.id

  // ── Verify ownership ──────────────────────────────────────────────────────
  const { data: trip } = await supabase
    .from('trips')
    .select('id')
    .eq('id', tripId)
    .eq('user_id', user.id)
    .single()

  if (!trip) {
    return Response.json({ error: 'Trip not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const { data: hotels, error } = await supabase
    .from('trip_hotels')
    .select('id, amadeus_hotel_id, name, latitude, longitude, rating, price_per_night, currency, rank, ai_reason, is_selected')
    .eq('trip_id', tripId)
    .order('rank', { ascending: true })

  if (error) {
    console.error('[/api/trips/[id]/hotels GET]', error)
    return Response.json({ error: 'Failed to retrieve selected hotels.', code: 'DB_ERROR' }, { status: 500 })
  }

  return Response.json({ hotels: hotels ?? [] })
}
