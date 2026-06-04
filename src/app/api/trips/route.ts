// GET/POST /api/trips — list trips and create new trip

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const CreateTripSchema = z.object({
  title:       z.string().min(1).max(200),
  destination: z.string().min(1),
  start_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults:      z.number().int().min(1).default(1),
  budget_tier: z.enum(['budget', 'mid-range', 'luxury']).optional(),
  travel_pace: z.enum(['slow', 'moderate', 'fast']).optional(),
})

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return Response.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const { data: trips, error: dbError } = await supabase
    .from('trips')
    .select('id, title, destination, start_date, end_date, status, budget_tier, travel_pace, adults, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (dbError) {
    return Response.json({ error: 'Failed to retrieve trips. Please try again later.', code: 'DB_ERROR' }, { status: 500 })
  }

  return Response.json({ trips })
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return Response.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON', code: 'INVALID_BODY' }, { status: 400 })
  }

  const parsed = CreateTripSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message, code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const { data: trip, error: dbError } = await supabase
    .from('trips')
    .insert({ ...parsed.data, user_id: user.id, status: 'draft' })
    .select('id, title, destination, start_date, end_date, status')
    .single()

  if (dbError) {
    return Response.json({ error: 'Failed to create trip. Please try again.', code: 'DB_ERROR' }, { status: 500 })
  }

  return Response.json({ trip }, { status: 201 })
}
