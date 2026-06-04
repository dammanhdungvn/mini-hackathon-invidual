/**
 * GET /api/hotels/search?city=TYO&checkIn=2024-06-01&checkOut=2024-06-04&adults=2&budget=mid-range
 *
 * Returns ranked hotel recommendations with AI explanations.
 * Auth required. All hotel data from Amadeus — AI only annotates.
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getRecommendedHotels } from '@/lib/services/hotel-recommendations'

const QuerySchema = z.object({
  city:     z.string().min(2).max(10),
  checkIn:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid checkIn date'),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid checkOut date'),
  adults:   z.coerce.number().int().min(1).max(10).default(1),
  budget:   z.enum(['budget', 'mid-range', 'luxury']).default('mid-range'),
  topN:     z.coerce.number().int().min(1).max(10).default(5),
  centroidLat: z.coerce.number().optional(),
  centroidLng: z.coerce.number().optional(),
  pace:     z.string().optional(),
  interests: z.string().optional(),  // comma-separated
})

export async function GET(request: NextRequest) {
  // ── Auth check ────────────────────────────────────────────────────────────
  const supabase = createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return Response.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  // ── Validate query params ─────────────────────────────────────────────────
  const params = Object.fromEntries(request.nextUrl.searchParams.entries())
  const parsed = QuerySchema.safeParse(params)
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid query', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  const { city, checkIn, checkOut, adults, budget, topN, centroidLat, centroidLng, pace, interests } = parsed.data

  try {
    const hotels = await getRecommendedHotels({
      cityCode: city,
      checkIn,
      checkOut,
      adults,
      budgetTier: budget,
      topN,
      centroidLat,
      centroidLng,
      travelPace: pace,
      interests: interests ? interests.split(',').map(s => s.trim()) : undefined,
      withExplanations: true,
    })

    return Response.json({ hotels, count: hotels.length })
  } catch (err) {
    console.error('[/api/hotels/search]', err)
    return Response.json(
      { error: 'Failed to search hotels. Please try again later.', code: 'SEARCH_ERROR' },
      { status: 500 }
    )
  }
}
