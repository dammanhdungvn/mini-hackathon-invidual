/**
 * PATCH /api/trips/[id]/items/[itemId]  — edit a single itinerary item
 * DELETE /api/trips/[id]/items/[itemId] — remove a single itinerary item
 *                                         (does NOT delete place cache)
 *
 * Auth required. Ownership verified via trip.user_id.
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { validateItemUpdate, applyTimeEdit, removeItemAndResequence } from '@/lib/itinerary/operations'

interface RouteParams { params: { id: string; itemId: string } }

const PatchItemSchema = z.object({
  start_time:    z.string().optional(),
  duration_mins: z.number().int().positive().optional(),
  ai_tip:        z.string().max(500).optional(),
  sequence_num:  z.number().int().positive().optional(),
})

// ─── Ownership helper ────────────────────────────────────────────────────────

async function verifyTripOwnership(supabase: ReturnType<typeof import('@/lib/supabase/server').createSupabaseServerClient>, tripId: string, userId: string) {
  const { data } = await supabase
    .from('trips')
    .select('id')
    .eq('id', tripId)
    .eq('user_id', userId)
    .single()
  return !!data
}

// ─── PATCH — edit itinerary item ─────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return Response.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const owned = await verifyTripOwnership(supabase, params.id, user.id)
  if (!owned) {
    return Response.json({ error: 'Trip not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON', code: 'INVALID_BODY' }, { status: 400 })
  }

  const parsed = PatchItemSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? 'Validation error', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  // Domain validation via pure operations module
  const validationResult = validateItemUpdate(parsed.data)
  if (!validationResult.valid) {
    return Response.json({ error: validationResult.reason, code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  // Fetch current item to recalculate end_time
  const { data: current, error: fetchErr } = await supabase
    .from('itinerary_items')
    .select('id, day_id, start_time, end_time, duration_mins, sequence_num, ai_tip')
    .eq('id', params.itemId)
    .single()

  if (fetchErr || !current) {
    return Response.json({ error: 'Item not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  // Recalculate end_time if time-related fields are changing
  let updatePayload: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.start_time !== undefined || parsed.data.duration_mins !== undefined) {
    const updated = applyTimeEdit(
      {
        id: current.id,
        start_time: current.start_time,
        end_time: current.end_time,
        duration_mins: current.duration_mins ?? 60,
        sequence_num: current.sequence_num,
      },
      {
        start_time: parsed.data.start_time,
        duration_mins: parsed.data.duration_mins,
      }
    )
    updatePayload = {
      ...updatePayload,
      start_time: updated.start_time,
      end_time: updated.end_time,
      duration_mins: updated.duration_mins,
    }
  }

  const { data: updated, error: updateErr } = await supabase
    .from('itinerary_items')
    .update(updatePayload)
    .eq('id', params.itemId)
    .select('id, day_id, start_time, end_time, duration_mins, sequence_num, ai_tip')
    .single()

  if (updateErr || !updated) {
    return Response.json({ error: 'Update failed', code: 'DB_ERROR' }, { status: 500 })
  }

  return Response.json({ item: updated })
}

// ─── DELETE — remove itinerary item, resequence siblings ─────────────────────

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return Response.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const owned = await verifyTripOwnership(supabase, params.id, user.id)
  if (!owned) {
    return Response.json({ error: 'Trip not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  // Fetch the item to know its day_id
  const { data: item, error: fetchErr } = await supabase
    .from('itinerary_items')
    .select('id, day_id, sequence_num')
    .eq('id', params.itemId)
    .single()

  if (fetchErr || !item) {
    return Response.json({ error: 'Item not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  // Delete the item
  const { error: deleteErr } = await supabase
    .from('itinerary_items')
    .delete()
    .eq('id', params.itemId)

  if (deleteErr) {
    return Response.json({ error: 'Failed to delete the itinerary item.', code: 'DB_ERROR' }, { status: 500 })
  }

  // Resequence siblings in the same day
  const { data: siblings } = await supabase
    .from('itinerary_items')
    .select('id, sequence_num')
    .eq('day_id', item.day_id)
    .order('sequence_num', { ascending: true })

  if (siblings && siblings.length > 0) {
    const resequenced = removeItemAndResequence(
      siblings.map(s => ({ id: s.id, sequence_num: s.sequence_num })),
      params.itemId // already deleted, this is a no-op filter — compact from 1
    )
    // Bulk update sequence numbers
    await Promise.all(
      resequenced.map((s, index) =>
        supabase
          .from('itinerary_items')
          .update({ sequence_num: index + 1 })
          .eq('id', s.id)
      )
    )
  }

  return new Response(null, { status: 204 })
}
