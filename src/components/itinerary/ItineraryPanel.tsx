'use client'

/**
 * ItineraryPanel — top-level interactive itinerary editor.
 *
 * Responsibilities:
 *   - Fetch trip data from /api/trips/[id]
 *   - Orchestrate all edit/remove/reorder/regenerate API calls
 *   - Manage optimistic UI state (update local state before API confirms)
 *   - Render DayColumns
 *
 * Rules:
 *   - All Supabase mutations go through /api/ — never directly from component
 *   - Optimistic updates: update local state first, rollback on error
 */

import { useCallback, useEffect, useState } from 'react'
import { DayColumn, DayColumnSkeleton } from './DayColumn'
import type { ItineraryDay, TripHotel, ItineraryItem } from '@/lib/types/trip'

interface ItineraryPanelProps {
  tripId: string
}

interface TripData {
  trip: { id: string; title: string; destination: string; start_date: string; end_date: string }
  days: ItineraryDay[]
  hotels: TripHotel[]
}

export function ItineraryPanel({ tripId }: ItineraryPanelProps) {
  const [data, setData] = useState<TripData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [regeneratingDay, setRegeneratingDay] = useState<number | null>(null)

  // ── Load trip data ────────────────────────────────────────────────────────

  const loadTrip = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/trips/${tripId}`)
      if (!res.ok) throw new Error(`Failed to load trip: ${res.statusText}`)
      const json = await res.json() as TripData
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trip')
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => { void loadTrip() }, [loadTrip])

  // ── Update single item ────────────────────────────────────────────────────

  const handleUpdateItem = useCallback(async (
    itemId: string,
    updates: { start_time?: string; duration_mins?: number; ai_tip?: string }
  ) => {
    // Optimistic update
    setData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        days: prev.days.map(day => ({
          ...day,
          items: (day.items ?? []).map(item =>
            item.id === itemId
              ? { ...item, ...updates }
              : item
          ),
        })),
      }
    })

    const res = await fetch(`/api/trips/${tripId}/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })

    if (!res.ok) {
      // Rollback: reload from server
      await loadTrip()
      const errData = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(errData.error ?? 'Update failed')
    }
  }, [tripId, loadTrip])

  // ── Remove single item ────────────────────────────────────────────────────

  const handleRemoveItem = useCallback(async (dayId: string, itemId: string) => {
    // Optimistic update
    setData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        days: prev.days.map(day =>
          day.id === dayId
            ? {
                ...day,
                items: (day.items ?? [])
                  .filter(i => i.id !== itemId)
                  .map((i, index) => ({ ...i, sequence_num: index + 1 })),
              }
            : day
        ),
      }
    })

    const res = await fetch(`/api/trips/${tripId}/items/${itemId}`, { method: 'DELETE' })

    if (!res.ok && res.status !== 204) {
      await loadTrip()  // rollback
      const errData = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(errData.error ?? 'Remove failed')
    }
  }, [tripId, loadTrip])

  // ── Regenerate single day ─────────────────────────────────────────────────

  const handleRegenerateDay = useCallback(async (dayNumber: number) => {
    setRegeneratingDay(dayNumber)
    try {
      const res = await fetch('/api/ai/regenerate-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, dayNumber, lockedItemIds: [] }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(errData.error ?? 'Regeneration failed')
      }

      const { items: newItems }: { day: ItineraryDay; items: ItineraryItem[] } = await res.json()

      setData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          days: prev.days.map(day =>
            day.day_number === dayNumber
              ? { ...day, items: newItems }
              : day
          ),
        }
      })
    } finally {
      setRegeneratingDay(null)
    }
  }, [tripId])

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="itinerary-panel" aria-busy="true" aria-label="Loading itinerary">
        {Array.from({ length: 3 }).map((_, i) => <DayColumnSkeleton key={i} />)}
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="itinerary-panel itinerary-panel--error" role="alert">
        <p>⚠️ {error ?? 'Failed to load itinerary'}</p>
        <button id="retry-load-trip" onClick={() => void loadTrip()}>Retry</button>
      </div>
    )
  }

  const selectedHotel = data.hotels.find(h => h.is_selected) ?? data.hotels[0]

  return (
    <section className="itinerary-panel" aria-label={`Itinerary for ${data.trip.destination}`}>
      {/* Trip header */}
      <header className="itinerary-panel__header">
        <h2 className="itinerary-panel__title">{data.trip.title ?? data.trip.destination}</h2>
        <p className="itinerary-panel__dates">
          {formatDateRange(data.trip.start_date, data.trip.end_date)}
        </p>
      </header>

      {/* Days */}
      <div className="itinerary-panel__days">
        {data.days.length === 0 ? (
          <div className="itinerary-panel__empty">
            <p>No itinerary generated yet. Use the chat to create your plan.</p>
          </div>
        ) : (
          data.days
            .sort((a, b) => a.day_number - b.day_number)
            .map(day => (
              <DayColumn
                key={day.id}
                day={day}
                tripId={tripId}
                hotel={selectedHotel}
                onUpdateItem={handleUpdateItem}
                onRemoveItem={handleRemoveItem}
                onRegenerateDay={handleRegenerateDay}
                isRegenerating={regeneratingDay === day.day_number}
              />
            ))
        )}
      </div>
    </section>
  )
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatDateRange(startDate: string, endDate: string): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return `${fmt.format(new Date(startDate + 'T12:00:00'))} – ${fmt.format(new Date(endDate + 'T12:00:00'))}`
  } catch {
    return `${startDate} – ${endDate}`
  }
}
