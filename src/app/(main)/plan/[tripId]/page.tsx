/**
 * Trip planning workspace page.
 * Route: /plan/[tripId]
 *
 * Server Component — fetches initial trip data server-side.
 * Interactive itinerary editing is delegated to the 'use client' ItineraryPanel.
 *
 * Layout: Split-pane per TECH_DESIGN.md
 *   - Left panel: ItineraryPanel (chat + schedule editor)
 *   - Right panel: Map (TODO Phase 4 map components)
 */

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ItineraryPanel } from '@/components/itinerary/ItineraryPanel'

interface PageProps {
  params: { tripId: string }
}

export default async function PlanPage({ params }: PageProps) {
  // Server-side auth check
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify trip exists and belongs to this user (light query — full data loaded client-side)
  const { data: trip } = await supabase
    .from('trips')
    .select('id, title, destination')
    .eq('id', params.tripId)
    .eq('user_id', user.id)
    .single()

  if (!trip) redirect('/dashboard')

  return (
    <div className="plan-workspace">
      {/* Left panel — itinerary editor */}
      <aside className="plan-workspace__left" aria-label="Itinerary editor">
        <ItineraryPanel tripId={params.tripId} />
      </aside>

      {/* Right panel — map placeholder (Phase 4) */}
      <main className="plan-workspace__right" aria-label="Trip map">
        <div className="plan-workspace__map-placeholder">
          <div className="map-placeholder__content">
            <span className="map-placeholder__icon" aria-hidden="true">🗺️</span>
            <p className="map-placeholder__title">{trip.destination}</p>
            <p className="map-placeholder__subtitle">Interactive map coming in Phase 4</p>
          </div>
        </div>
      </main>
    </div>
  )
}

export async function generateMetadata({ params }: PageProps) {
  const supabase = createSupabaseServerClient()
  const { data: trip } = await supabase
    .from('trips')
    .select('title, destination')
    .eq('id', params.tripId)
    .single()

  return {
    title: trip ? `${trip.title ?? trip.destination} — TripGenius` : 'Trip Planner — TripGenius',
    description: trip ? `Plan your trip to ${trip.destination} with TripGenius AI` : 'AI-powered trip planning',
  }
}
