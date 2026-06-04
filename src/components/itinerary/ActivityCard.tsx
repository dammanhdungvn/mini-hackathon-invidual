'use client'

/**
 * ActivityCard — displays a single itinerary item with edit controls.
 *
 * Responsibilities (client component — needs event handlers):
 *   - Display activity time, duration, name, type, AI tip
 *   - Expose edit (time / notes) and remove actions via callbacks
 *   - Show edit form inline when editing
 *
 * Rules:
 *   - No Supabase calls here — all mutations go through /api/trips/[id]/items/[itemId]
 *   - No business logic — pure presentation + local edit state
 */

import { useState } from 'react'
import type { ItineraryItem } from '@/lib/types/trip'

interface ActivityCardProps {
  item: ItineraryItem
  tripId: string
  dayId: string
  onUpdate: (itemId: string, updates: { start_time?: string; duration_mins?: number; ai_tip?: string }) => Promise<void>
  onRemove: (itemId: string) => Promise<void>
  isLoading?: boolean
}

const TYPE_ICONS: Record<string, string> = {
  attraction: '🏛️',
  restaurant:  '🍜',
  hotel:       '🏨',
  transit:     '🚌',
}

const TYPE_COLORS: Record<string, string> = {
  attraction: 'activity-card--attraction',
  restaurant:  'activity-card--restaurant',
  hotel:       'activity-card--hotel',
  transit:     'activity-card--transit',
}

export function ActivityCard({ item, onUpdate, onRemove, isLoading = false }: ActivityCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editStartTime, setEditStartTime] = useState(item.start_time)
  const [editDuration, setEditDuration] = useState(String(item.duration_mins ?? 60))
  const [editTip, setEditTip] = useState(item.ai_tip ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const placeName = item.place?.name ?? `Activity (${item.item_type})`
  const icon = TYPE_ICONS[item.item_type] ?? '📍'
  const colorClass = TYPE_COLORS[item.item_type] ?? ''

  const handleSave = async () => {
    setError(null)
    const durationNum = parseInt(editDuration, 10)
    if (isNaN(durationNum) || durationNum <= 0) {
      setError('Duration must be a positive number')
      return
    }
    setSaving(true)
    try {
      await onUpdate(item.id, {
        start_time: editStartTime !== item.start_time ? editStartTime : undefined,
        duration_mins: durationNum !== (item.duration_mins ?? 60) ? durationNum : undefined,
        ai_tip: editTip !== (item.ai_tip ?? '') ? editTip : undefined,
      })
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditStartTime(item.start_time)
    setEditDuration(String(item.duration_mins ?? 60))
    setEditTip(item.ai_tip ?? '')
    setError(null)
    setIsEditing(false)
  }

  const handleRemove = async () => {
    if (!confirm(`Remove "${placeName}" from itinerary?`)) return
    setSaving(true)
    try {
      await onRemove(item.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remove failed')
      setSaving(false)
    }
  }

  return (
    <article
      className={`activity-card ${colorClass} ${isLoading || saving ? 'activity-card--loading' : ''}`}
      id={`activity-${item.id}`}
      aria-label={`Activity: ${placeName}`}
    >
      {/* Time badge */}
      <div className="activity-card__time" aria-label={`Time: ${item.start_time} to ${item.end_time}`}>
        <span className="activity-card__start">{item.start_time}</span>
        <span className="activity-card__separator">→</span>
        <span className="activity-card__end">{item.end_time}</span>
      </div>

      {/* Main content */}
      <div className="activity-card__body">
        <div className="activity-card__header">
          <span className="activity-card__icon" aria-hidden="true">{icon}</span>
          <h4 className="activity-card__name">{placeName}</h4>
          <div className="activity-card__actions">
            {!isEditing && (
              <>
                <button
                  id={`edit-activity-${item.id}`}
                  className="activity-card__btn activity-card__btn--edit"
                  onClick={() => setIsEditing(true)}
                  disabled={isLoading || saving}
                  aria-label={`Edit ${placeName}`}
                >
                  ✏️
                </button>
                <button
                  id={`remove-activity-${item.id}`}
                  className="activity-card__btn activity-card__btn--remove"
                  onClick={handleRemove}
                  disabled={isLoading || saving}
                  aria-label={`Remove ${placeName}`}
                >
                  ✕
                </button>
              </>
            )}
          </div>
        </div>

        {/* Rating + address */}
        {item.place && (
          <div className="activity-card__meta">
            {item.place.rating !== undefined && (
              <span className="activity-card__rating" aria-label={`Rating: ${item.place.rating}`}>
                ★ {item.place.rating.toFixed(1)}
              </span>
            )}
            {item.place.address && (
              <span className="activity-card__address">{item.place.address}</span>
            )}
          </div>
        )}

        {/* AI tip (read mode) */}
        {!isEditing && item.ai_tip && (
          <p className="activity-card__tip" aria-label="AI travel tip">
            <span aria-hidden="true">💡</span> {item.ai_tip}
          </p>
        )}

        {/* Transit info */}
        {item.transit_to_next && (
          <div className="activity-card__transit" aria-label="Transit to next activity">
            <span aria-hidden="true">🚶</span>
            {item.transit_to_next.mode} · {item.transit_to_next.duration_mins} min
            {item.transit_to_next.distance_km !== undefined &&
              ` · ${item.transit_to_next.distance_km.toFixed(1)} km`}
          </div>
        )}

        {/* Action Error display in view mode */}
        {error && !isEditing && (
          <div className="activity-card__error" role="alert">
            <span aria-hidden="true">⚠️</span> {error}
            <button
              className="activity-card__error-clear"
              onClick={() => setError(null)}
              aria-label="Clear error"
            >
              ✕
            </button>
          </div>
        )}

        {/* Edit form (inline) */}
        {isEditing && (
          <form
            className="activity-card__edit-form"
            onSubmit={e => { e.preventDefault(); void handleSave() }}
            onKeyDown={e => {
              if (e.key === 'Escape') {
                handleCancel()
              }
            }}
            aria-label="Edit activity"
          >
            <div className="edit-form__row">
              <label htmlFor={`start-${item.id}`} className="edit-form__label">Start time</label>
              <input
                id={`start-${item.id}`}
                type="time"
                className="edit-form__input"
                value={editStartTime}
                onChange={e => setEditStartTime(e.target.value)}
                disabled={saving || isLoading}
                required
              />
            </div>
            <div className="edit-form__row">
              <label htmlFor={`duration-${item.id}`} className="edit-form__label">Duration (min)</label>
              <input
                id={`duration-${item.id}`}
                type="number"
                className="edit-form__input"
                value={editDuration}
                onChange={e => setEditDuration(e.target.value)}
                min="1"
                max="1440"
                disabled={saving || isLoading}
                required
              />
            </div>
            <div className="edit-form__row">
              <label htmlFor={`tip-${item.id}`} className="edit-form__label">Note</label>
              <textarea
                id={`tip-${item.id}`}
                className="edit-form__textarea"
                value={editTip}
                onChange={e => setEditTip(e.target.value)}
                maxLength={500}
                rows={2}
                disabled={saving || isLoading}
                placeholder="Add a travel note…"
              />
            </div>
            {error && <p className="edit-form__error" role="alert">{error}</p>}
            <div className="edit-form__buttons">
              <button
                type="submit"
                id={`save-activity-${item.id}`}
                className="edit-form__btn edit-form__btn--save"
                disabled={saving || isLoading}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                id={`cancel-edit-${item.id}`}
                className="edit-form__btn edit-form__btn--cancel"
                onClick={handleCancel}
                disabled={saving || isLoading}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </article>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

export function ActivityCardSkeleton() {
  return (
    <div className="activity-card activity-card--skeleton" aria-hidden="true">
      <div className="skeleton skeleton--time" />
      <div className="activity-card__body">
        <div className="skeleton skeleton--title" />
        <div className="skeleton skeleton--text" />
      </div>
    </div>
  )
}
