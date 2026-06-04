/**
 * POST /api/ai/regenerate-day
 *
 * Regenerates a single day's itinerary without touching other days.
 *
 * Pipeline (reusing all existing modules — no duplication):
 *   1. Load trip context + trip's intent from DB
 *   2. Retrieve validated candidate places (existing recommendations service)
 *   3. Filter out locked activities (user-pinned items remain)
 *   4. Run TSPTW solver for that day only (existing solver)
 *   5. Run narrative synthesis (existing synthesizer)
 *   6. Replace that day's items in DB (delete old, insert new)
 *
 * Rules:
 *   - LLM does NOT invent places — all from Google Places / Supabase cache
 *   - LLM does NOT touch the database — only annotates locked schedule
 *   - Uses AI provider abstraction — no direct Gemini/Qwen calls
 *
 * @module api/ai/regenerate-day
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getRecommendedAttractions, getRecommendedRestaurants } from '@/lib/services/recommendations'
import { buildSchedule } from '@/lib/solver/tsptw'
import { synthesizeNarrative } from '@/lib/ai/synthesizer'
import type { TravelIntent, BudgetTier, TravelPace } from '@/lib/types/trip'

const RequestSchema = z.object({
  tripId:     z.string().uuid(),
  dayNumber:  z.number().int().min(1),
  /** Optional: item IDs to keep (locked by user — will not be replaced) */
  lockedItemIds: z.array(z.string().uuid()).default([]),
})

export async function POST(request: NextRequest) {
  // ── Auth check ────────────────────────────────────────────────────────────
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON', code: 'INVALID_BODY' }, { status: 400 })
  }

  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? 'Validation error', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const { tripId, dayNumber, lockedItemIds } = parsed.data

  try {
    // ── Load trip context ─────────────────────────────────────────────────────
    const { data: trip, error: tripErr } = await supabase
      .from('trips')
      .select('id, user_id, destination, city_code, start_date, end_date, adults, budget_tier, travel_pace, user_prompt')
      .eq('id', tripId)
      .eq('user_id', user.id)
      .single()

    if (tripErr || !trip) {
      return Response.json({ error: 'Trip not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    // ── Find the target day ───────────────────────────────────────────────────
    const { data: targetDay, error: dayErr } = await supabase
      .from('itinerary_days')
      .select('id, day_number, date')
      .eq('trip_id', tripId)
      .eq('day_number', dayNumber)
      .single()

    if (dayErr || !targetDay) {
      return Response.json({ error: `Day ${dayNumber} not found for this trip`, code: 'NOT_FOUND' }, { status: 404 })
    }

    // Reconstruct TravelIntent from trip record (no re-parsing needed)
    const intent: TravelIntent = {
      destination:     trip.destination,
      cityCode:        trip.city_code ?? undefined,
      startDate:       trip.start_date,
      endDate:         trip.end_date,
      durationDays:    calcDays(trip.start_date, trip.end_date),
      adults:          trip.adults ?? 1,
      budgetTier:      (trip.budget_tier ?? 'mid-range') as BudgetTier,
      travelPace:      (trip.travel_pace ?? 'moderate') as TravelPace,
      interests:       [],  // Derived from user_prompt if needed
      avoidCategories: [],
      mustVisit:       [],
    }

    // ── Retrieve hotel for context (centroid) ─────────────────────────────────
    const { data: selectedHotel } = await supabase
      .from('trip_hotels')
      .select('latitude, longitude')
      .eq('trip_id', tripId)
      .eq('is_selected', true)
      .single()

    // ── Stage 2: Retrieve validated candidates ────────────────────────────────
    // Reuses existing recommendation services — no duplicate place fetching
    const [attractions, restaurants] = await Promise.all([
      getRecommendedAttractions(intent, { topN: 15 }),
      getRecommendedRestaurants(intent,  { topN: 5  }),
    ])
    const allCandidates = [...attractions, ...restaurants]

    // ── Stage 3: Run solver for this day only ─────────────────────────────────
    // Override to only schedule for a single day
    const singleDayIntent: TravelIntent = {
      ...intent,
      startDate:   targetDay.date,
      endDate:     targetDay.date,
      durationDays: 1,
    }

    const { schedule: lockedItems, conflicts } = buildSchedule(allCandidates, singleDayIntent, {
      pace:      intent.travelPace,
      startDate: targetDay.date,
      hotelLat:  selectedHotel?.latitude ?? undefined,
      hotelLng:  selectedHotel?.longitude ?? undefined,
    })

    // ── Stage 4: Narrative synthesis (AI annotates only) ─────────────────────
    // LLM receives locked schedule, may only add ai_tip — cannot invent places
    const annotated = await synthesizeNarrative(lockedItems)

    // ── Replace this day's unlocked items in DB ───────────────────────────────
    // Delete non-locked items
    const { error: deleteErr } = lockedItemIds.length > 0
      ? await supabase
          .from('itinerary_items')
          .delete()
          .eq('day_id', targetDay.id)
          .not('id', 'in', `(${lockedItemIds.join(',')})`)
      : await supabase
          .from('itinerary_items')
          .delete()
          .eq('day_id', targetDay.id)

    if (deleteErr) {
      throw new Error(`Failed to clear day items: ${deleteErr.message}`)
    }

    // Get max sequence from locked items
    const { data: lockedItems_ } = lockedItemIds.length > 0
      ? await supabase
          .from('itinerary_items')
          .select('sequence_num')
          .in('id', lockedItemIds)
          .order('sequence_num', { ascending: false })
          .limit(1)
      : { data: [] }

    const seqOffset = (lockedItems_?.[0]?.sequence_num ?? 0)

    // Insert new items
    for (const item of annotated) {
      await supabase.from('itinerary_items').insert({
        day_id:          targetDay.id,
        place_id:        item.placeId.startsWith('mock-') ? null : item.placeId,
        item_type:       item.category,
        start_time:      item.startTime,
        end_time:        item.endTime,
        duration_mins:   item.durationMins,
        sequence_num:    item.sequenceNum + seqOffset,
        ai_tip:          item.aiTip ?? null,
        transit_to_next: item.transitToNext ?? null,
      })
    }

    // Return updated day
    const { data: updatedItems } = await supabase
      .from('itinerary_items')
      .select('id, day_id, place_id, item_type, start_time, end_time, duration_mins, sequence_num, ai_tip')
      .eq('day_id', targetDay.id)
      .order('sequence_num', { ascending: true })

    return Response.json({
      day: targetDay,
      items: updatedItems ?? [],
      conflicts: conflicts.length > 0 ? conflicts : undefined,
    })
  } catch (err) {
    console.error('[regenerate-day]', err)
    return Response.json(
      { error: 'Failed to regenerate day. Please try again later.', code: 'REGENERATION_ERROR' },
      { status: 500 }
    )
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcDays(startDate: string, endDate: string): number {
  const start = new Date(startDate)
  const end   = new Date(endDate)
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1)
}
