'use client'

/**
 * DayColumn — displays a single day of the itinerary with its activities.
 *
 * Responsibilities:
 *   - Show day header (date, day number)
 *   - List ActivityCards in sequence order
 *   - Show hotel context if hotel is near this day
 *   - Provide "Regenerate this day" action
 */

import { ActivityCard, ActivityCardSkeleton } from './ActivityCard'
import type { ItineraryDay, TripHotel } from '@/lib/types/trip'

interface DayColumnProps {
  day: ItineraryDay
  tripId: string
  hotel?: TripHotel
  onUpdateItem: (itemId: string, updates: { start_time?: string; duration_mins?: number; ai_tip?: string }) => Promise<void>
  onRemoveItem: (dayId: string, itemId: string) => Promise<void>
  onRegenerateDay: (dayNumber: number) => Promise<void>
  isRegenerating?: boolean
  isLoading?: boolean
}

export function DayColumn({
  day,
  tripId,
  hotel,
  onUpdateItem,
  onRemoveItem,
  onRegenerateDay,
  isRegenerating = false,
  isLoading = false,
}: DayColumnProps) {
  const items = day.items ?? []
  const formattedDate = formatDate(day.date)
  const dayLabel = `Day ${day.day_number}`

  return (
    <section
      className="day-column"
      id={`day-${day.day_number}`}
      aria-label={`${dayLabel}: ${formattedDate}`}
    >
      {/* Day header */}
      <div className="day-column__header">
        <div className="day-column__title-group">
          <span className="day-column__number" aria-hidden="true">{day.day_number}</span>
          <div>
            <h3 className="day-column__label">{dayLabel}</h3>
            <time className="day-column__date" dateTime={day.date}>{formattedDate}</time>
          </div>
        </div>

        {/* Regenerate button */}
        <button
          id={`regenerate-day-${day.day_number}`}
          className={`day-column__regen-btn ${isRegenerating ? 'day-column__regen-btn--loading' : ''}`}
          onClick={() => onRegenerateDay(day.day_number)}
          disabled={isRegenerating || isLoading}
          aria-label={`Regenerate Day ${day.day_number}`}
          title="Get a fresh AI-generated schedule for this day"
        >
          {isRegenerating ? '⟳ Regenerating…' : '✨ Regenerate Day'}
        </button>
      </div>

      {/* Hotel context badge */}
      {hotel && (
        <div className="day-column__hotel-badge" aria-label="Your hotel for this trip">
          <span aria-hidden="true">🏨</span>
          <span className="day-column__hotel-name">{hotel.name}</span>
          {hotel.price_per_night !== undefined && (
            <span className="day-column__hotel-price">
              {hotel.currency} {hotel.price_per_night.toFixed(0)}/night
            </span>
          )}
        </div>
      )}

      {/* Notes */}
      {day.notes && (
        <p className="day-column__notes">{day.notes}</p>
      )}

      {/* Activity list */}
      <ol className="day-column__items" aria-label={`Activities for ${dayLabel}`}>
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <li key={i}><ActivityCardSkeleton /></li>
          ))
        ) : items.length === 0 ? (
          <li className="day-column__empty">
            <span aria-hidden="true">📭</span>
            <p>No activities scheduled. Try regenerating this day.</p>
          </li>
        ) : (
          items
            .sort((a, b) => a.sequence_num - b.sequence_num)
            .map(item => (
              <li key={item.id} className="day-column__item">
                <ActivityCard
                  item={item}
                  tripId={tripId}
                  dayId={day.id}
                  onUpdate={onUpdateItem}
                  onRemove={(itemId) => onRemoveItem(day.id, itemId)}
                  isLoading={isRegenerating || isLoading}
                />
              </li>
            ))
        )}
      </ol>
    </section>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function DayColumnSkeleton() {
  return (
    <div className="day-column day-column--skeleton" aria-hidden="true">
      <div className="day-column__header">
        <div className="skeleton skeleton--number" />
        <div>
          <div className="skeleton skeleton--title" />
          <div className="skeleton skeleton--text skeleton--short" />
        </div>
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <ActivityCardSkeleton key={i} />
      ))}
    </div>
  )
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatDate(isoDate: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(new Date(isoDate + 'T12:00:00'))
  } catch {
    return isoDate
  }
}
