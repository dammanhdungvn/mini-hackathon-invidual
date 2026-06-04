/**
 * GET /api/trips/[id]      — get trip with days + items
 * PATCH /api/trips/[id]    — update trip metadata
 * DELETE /api/trips/[id]   — delete trip
 *
 * Auth required. Users can only access their own trips.
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'

interface RouteParams { params: { id: string } }

// ─── GET — full trip with days + items ────────────────────────────────────────

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return Response.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const { data: trip, error: tripErr } = await supabase
    .from('trips')
    .select('id, title, destination, city_code, start_date, end_date, adults, budget_tier, travel_pace, status, user_prompt, created_at, updated_at')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (tripErr || !trip) {
    return Response.json({ error: 'Trip not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  // Fetch days with their items (joined via separate queries — avoids select(*) rule)
  const { data: days, error: daysErr } = await supabase
    .from('itinerary_days')
    .select('id, trip_id, day_number, date, notes')
    .eq('trip_id', params.id)
    .order('day_number', { ascending: true })

  if (daysErr) {
    return Response.json({ error: 'Failed to retrieve trip itinerary details.', code: 'DB_ERROR' }, { status: 500 })
  }

  const dayIds = (days ?? []).map(d => d.id)

  const { data: items, error: itemsErr } = dayIds.length > 0
    ? await supabase
        .from('itinerary_items')
        .select('id, day_id, place_id, item_type, start_time, end_time, duration_mins, sequence_num, ai_tip, transit_to_next')
        .in('day_id', dayIds)
        .order('sequence_num', { ascending: true })
    : { data: [], error: null }

  if (itemsErr) {
    return Response.json({ error: 'Failed to retrieve trip activities.', code: 'DB_ERROR' }, { status: 500 })
  }

  // Fetch hotel for context
  const { data: hotels } = await supabase
    .from('trip_hotels')
    .select('id, amadeus_hotel_id, name, latitude, longitude, rating, price_per_night, currency, rank, ai_reason, is_selected')
    .eq('trip_id', params.id)
    .order('rank', { ascending: true })

  // Build nested structure — explicit item shape to avoid 'never' narrowing
  type ItemRow = { id: string; day_id: string; place_id: string | null; item_type: string; start_time: string; end_time: string; duration_mins: number | null; sequence_num: number; ai_tip: string | null; transit_to_next: unknown }
  const safeItems: ItemRow[] = (items ?? []) as ItemRow[]
  const itemsByDay = safeItems.reduce<Record<string, ItemRow[]>>((acc, item) => {
    if (!acc[item.day_id]) acc[item.day_id] = []
    acc[item.day_id]!.push(item)
    return acc
  }, {})

  const daysWithItems = (days ?? []).map(day => ({
    ...day,
    items: itemsByDay[day.id] ?? [],
  }))

  return Response.json({ trip, days: daysWithItems, hotels: hotels ?? [] })
}

// ─── PATCH — update trip metadata ────────────────────────────────────────────

const PatchTripSchema = z.object({
  title:       z.string().min(1).max(200).optional(),
  status:      z.enum(['draft', 'saved', 'archived']).optional(),
  travel_pace: z.enum(['slow', 'moderate', 'fast']).optional(),
  budget_tier: z.enum(['budget', 'mid-range', 'luxury']).optional(),
})

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return Response.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON', code: 'INVALID_BODY' }, { status: 400 })
  }

  const parsed = PatchTripSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? 'Validation error', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const { data: trip, error: updateErr } = await supabase
    .from('trips')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select('id, title, destination, status, updated_at')
    .single()

  if (updateErr || !trip) {
    return Response.json({ error: 'Trip not found or update failed', code: 'NOT_FOUND' }, { status: 404 })
  }

  return Response.json({ trip })
}

// ─── DELETE — delete trip and all child records ───────────────────────────────

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return Response.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const { error: deleteErr } = await supabase
    .from('trips')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (deleteErr) {
    return Response.json({ error: 'Failed to delete the trip.', code: 'DB_ERROR' }, { status: 500 })
  }

  return new Response(null, { status: 204 })
}
