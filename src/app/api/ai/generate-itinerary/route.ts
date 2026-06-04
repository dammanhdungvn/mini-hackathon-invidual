/**
 * POST /api/ai/generate-itinerary
 * Full 4-stage AI pipeline: Parse → Retrieve → Schedule → Narrate → Persist
 *
 * Auth required. All stages are atomic — if Stage 1 fails, nothing is persisted.
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { parseTravelIntent } from '@/lib/ai/parser'
import { synthesizeNarrative } from '@/lib/ai/synthesizer'
import { getRecommendedAttractions, getRecommendedRestaurants } from '@/lib/services/recommendations'
import { searchHotels } from '@/lib/services/amadeus'
import { buildSchedule } from '@/lib/solver/tsptw'
import { scoreHotel } from '@/lib/solver/scorer'
import type { ScheduledItem } from '@/lib/types/trip'

const RequestSchema = z.object({
  message: z.string().min(5).max(2000),
})

export async function POST(request: NextRequest) {
  // ── Auth check (always first) ────────────────────────────────────────────────
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  // ── Parse request body ───────────────────────────────────────────────────────
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'message field required (5–2000 chars)', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const { message } = parsed.data

  try {
    // ── STAGE 1: Intent Parsing ──────────────────────────────────────────────────
    const intent = await parseTravelIntent(message)

    // ── STAGE 2: Candidate Retrieval ─────────────────────────────────────────────
    const [attractions, restaurants, hotelsRaw] = await Promise.all([
      getRecommendedAttractions(intent, { topN: 20 }),
      getRecommendedRestaurants(intent,  { topN: 10 }),
      searchHotels(
        intent.cityCode ?? intent.destination.split(',')[0].trim(),
        intent.startDate,
        intent.endDate,
        intent.adults
      ),
    ])

    const allCandidates = [...attractions, ...restaurants]

    // Rank hotels by score, take top 3
    const rankedHotels = [...hotelsRaw]
      .sort((a, b) => scoreHotel(b, intent.budgetTier) - scoreHotel(a, intent.budgetTier))
      .slice(0, 3)
      .map((h, i) => ({ ...h, rank: i + 1 }))

    const primaryHotel = rankedHotels[0]

    // ── STAGE 3: Schedule Optimisation ───────────────────────────────────────────
    const { schedule: lockedItems, conflicts } = buildSchedule(allCandidates, intent, {
      pace:      intent.travelPace,
      startDate: intent.startDate,
      hotelLat:  primaryHotel?.latitude,
      hotelLng:  primaryHotel?.longitude,
    })

    if (conflicts.length > 0) {
      console.warn('[generate-itinerary] Scheduling conflicts:', conflicts)
    }

    // ── STAGE 4: Narrative Synthesis ─────────────────────────────────────────────
    const annotatedItems = await synthesizeNarrative(lockedItems)

    // ── PERSIST ──────────────────────────────────────────────────────────────────
    const title = `${intent.destination} · ${intent.durationDays} days`

    // Insert trip
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .insert({
        user_id:     user.id,
        title,
        destination: intent.destination,
        city_code:   intent.cityCode,
        start_date:  intent.startDate,
        end_date:    intent.endDate,
        adults:      intent.adults,
        budget_tier: intent.budgetTier,
        travel_pace: intent.travelPace,
        user_prompt: message,
        status:      'draft',
      })
      .select('id')
      .single()

    if (tripError || !trip) {
      throw new Error(`Failed to insert trip: ${tripError?.message}`)
    }

    // Insert hotels
    if (rankedHotels.length > 0) {
      await supabase.from('trip_hotels').insert(
        rankedHotels.map(h => ({
          trip_id:          trip.id,
          amadeus_hotel_id: h.amadeus_hotel_id,
          name:             h.name,
          latitude:         h.latitude,
          longitude:        h.longitude,
          rating:           h.rating,
          price_per_night:  h.price_per_night,
          currency:         h.currency ?? 'USD',
          rank:             h.rank,
        }))
      )
    }

    // Group items by day and insert itinerary_days + itinerary_items
    const byDay = groupByDay(annotatedItems)
    const insertedDays: Array<{ id: string; day_number: number; date: string }> = []

    for (const [dayNum, items] of Object.entries(byDay)) {
      const dayNumber = parseInt(dayNum)
      const date = addDays(intent.startDate, dayNumber - 1)

      const { data: day, error: dayError } = await supabase
        .from('itinerary_days')
        .insert({ trip_id: trip.id, day_number: dayNumber, date })
        .select('id')
        .single()

      if (dayError || !day) continue

      insertedDays.push({ id: day.id, day_number: dayNumber, date })

      // Upsert places to cache, then insert items
      for (const item of items) {
        // Insert itinerary item (place_id may not exist in cache if it's a mock)
        await supabase.from('itinerary_items').insert({
          day_id:       day.id,
          place_id:     item.placeId.startsWith('mock-') ? null : item.placeId,
          item_type:    item.category,
          start_time:   item.startTime,
          end_time:     item.endTime,
          duration_mins: item.durationMins,
          sequence_num:  item.sequenceNum,
          ai_tip:        item.aiTip ?? null,
          transit_to_next: item.transitToNext ?? null,
        })
      }
    }

    return Response.json({
      tripId:      trip.id,
      title,
      destination: intent.destination,
      durationDays: intent.durationDays,
      hotels:      rankedHotels,
      days:        insertedDays,
      conflicts:   conflicts.length > 0 ? conflicts : undefined,
    })
  } catch (err) {
    console.error('[generate-itinerary]', err)
    const isParsingError = err instanceof Error && (
      err.name === 'ZodError' || 
      err.message.includes('JSON') || 
      err.message.includes('schema') || 
      err.message.includes('generateObject') ||
      err.message.includes('validation')
    )
    const messageText = isParsingError
      ? 'I couldn\'t extract a valid destination, duration, or dates from your request. Please specify where you want to go, for how long (or dates), and what you want to do.'
      : 'Failed to generate itinerary. Please try a different prompt or try again later.'
    return Response.json(
      { error: messageText, code: isParsingError ? 'PARSING_FAILED' : 'GENERATION_ERROR' },
      { status: isParsingError ? 400 : 500 }
    )
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function groupByDay(items: ScheduledItem[]): Record<number, ScheduledItem[]> {
  return items.reduce<Record<number, ScheduledItem[]>>((acc, item) => {
    if (!acc[item.dayNumber]) acc[item.dayNumber] = []
    acc[item.dayNumber].push(item)
    return acc
  }, {})
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}
