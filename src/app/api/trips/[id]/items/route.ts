/**
 * PATCH /api/trips/[id]/items — bulk reorder itinerary items after drag-and-drop
 *
 * Body: { items: [{ id: string; sequence_num: number; day_id?: string }] }
 *
 * Auth required. Items must belong to this trip.
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'

interface RouteParams { params: { id: string } }

const BulkReorderSchema = z.object({
  items: z.array(z.object({
    id:           z.string().uuid(),
    sequence_num: z.number().int().min(1),
    day_id:       z.string().uuid().optional(),  // optional — for cross-day moves
  })).min(1).max(100),
})

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return Response.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  // Verify ownership
  const { data: trip } = await supabase
    .from('trips')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!trip) {
    return Response.json({ error: 'Trip not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON', code: 'INVALID_BODY' }, { status: 400 })
  }

  const parsed = BulkReorderSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? 'Validation error', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  // Batch update each item's sequence_num (and optionally day_id for cross-day moves)
  const results = await Promise.allSettled(
    parsed.data.items.map(item => {
      const updateData: Record<string, unknown> = { sequence_num: item.sequence_num }
      if (item.day_id) updateData.day_id = item.day_id
      return supabase
        .from('itinerary_items')
        .update(updateData)
        .eq('id', item.id)
    })
  )

  const failed = results.filter(r => r.status === 'rejected')
  if (failed.length > 0) {
    return Response.json({ error: 'Partial update failure', code: 'DB_ERROR' }, { status: 500 })
  }

  return Response.json({ updated: parsed.data.items.length })
}
