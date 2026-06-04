'use client'

/**
 * HotelCard — displays a single ranked hotel recommendation.
 *
 * Shows: name, rating, price, score breakdown, AI reason, select action.
 * All data comes from props — no data fetching inside this component.
 * Follows: Server Component by default rule — 'use client' required for onClick.
 */

import type { RankedHotel } from '@/lib/types/trip'

interface HotelCardProps {
  hotel: RankedHotel
  isSelected?: boolean
  onSelect?: (hotel: RankedHotel) => void
  loading?: boolean
}

export function HotelCard({ hotel, isSelected = false, onSelect, loading = false }: HotelCardProps) {
  const { name, rating, price_per_night, currency, ai_reason, score, scoreBreakdown } = hotel

  const handleSelect = () => {
    if (!loading && onSelect) onSelect(hotel)
  }

  return (
    <article
      className={`hotel-card ${isSelected ? 'hotel-card--selected' : ''} ${loading ? 'hotel-card--loading' : ''}`}
      aria-label={`Hotel: ${name}`}
    >
      {/* Rank badge */}
      <div className="hotel-card__rank" aria-label={`Rank ${hotel.rank}`}>
        #{hotel.rank}
      </div>

      {/* Header */}
      <div className="hotel-card__header">
        <h3 className="hotel-card__name">{name}</h3>
        <div className="hotel-card__meta">
          {rating !== undefined && (
            <span className="hotel-card__rating" aria-label={`Rating: ${rating} out of 5`}>
              ★ {rating.toFixed(1)}
            </span>
          )}
          {price_per_night !== undefined && (
            <span className="hotel-card__price" aria-label={`Price: ${price_per_night} ${currency} per night`}>
              {currency} {price_per_night.toFixed(0)}<span className="hotel-card__price-unit">/night</span>
            </span>
          )}
        </div>
      </div>

      {/* Score breakdown */}
      {scoreBreakdown && (
        <div className="hotel-card__scores" aria-label="Score breakdown">
          <ScoreBar label="Quality"    value={scoreBreakdown.quality}    />
          <ScoreBar label="Price fit"  value={scoreBreakdown.price}      />
          <ScoreBar label="Location"   value={scoreBreakdown.location}   />
          <ScoreBar label="Match"      value={scoreBreakdown.preference} />
        </div>
      )}

      {/* AI explanation */}
      {ai_reason && (
        <p className="hotel-card__reason" aria-label="Why recommended">
          <span className="hotel-card__reason-icon" aria-hidden="true">✨</span>
          {ai_reason}
        </p>
      )}

      {/* Composite score */}
      {score !== undefined && (
        <div className="hotel-card__composite" aria-label={`Composite match score: ${Math.round(score * 100)}%`}>
          <span className="hotel-card__composite-label">Match</span>
          <span className="hotel-card__composite-value">{Math.round(score * 100)}%</span>
        </div>
      )}

      {/* Select button */}
      {onSelect && (
        <button
          id={`select-hotel-${hotel.amadeus_hotel_id ?? hotel.rank}`}
          className={`hotel-card__select-btn ${isSelected ? 'hotel-card__select-btn--active' : ''}`}
          onClick={handleSelect}
          disabled={loading}
          aria-pressed={isSelected}
          aria-label={isSelected ? `${name} selected` : `Select ${name}`}
        >
          {isSelected ? '✓ Selected' : 'Select Hotel'}
        </button>
      )}
    </article>
  )
}

// ─── Sub-component ────────────────────────────────────────────────────────────

interface ScoreBarProps {
  label: string
  value: number  // 0–1
}

function ScoreBar({ label, value }: ScoreBarProps) {
  const pct = Math.round(value * 100)
  return (
    <div className="score-bar" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${label}: ${pct}%`}>
      <span className="score-bar__label">{label}</span>
      <div className="score-bar__track" aria-hidden="true">
        <div
          className="score-bar__fill"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="score-bar__value">{pct}%</span>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

export function HotelCardSkeleton() {
  return (
    <div className="hotel-card hotel-card--skeleton" aria-hidden="true">
      <div className="skeleton skeleton--title" />
      <div className="skeleton skeleton--text" />
      <div className="skeleton skeleton--text skeleton--short" />
      <div className="skeleton skeleton--bar" />
      <div className="skeleton skeleton--bar" />
    </div>
  )
}
