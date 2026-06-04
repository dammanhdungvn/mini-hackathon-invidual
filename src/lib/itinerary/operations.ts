/**
 * Pure utility functions for itinerary editing operations.
 * No external calls, no side effects — easy to unit test.
 *
 * Responsibilities:
 *   - Reorder items after a drag-and-drop or removal
 *   - Validate edit payloads (time format, duration)
 *   - Recalculate sequence numbers after removal
 *   - Calculate a new end_time from start_time + duration
 *
 * @module lib/itinerary/operations
 */

export interface ItemTimeSlot {
  id: string
  start_time: string    // 'HH:MM'
  end_time: string      // 'HH:MM'
  duration_mins: number
  sequence_num: number
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

/** Parse 'HH:MM' → total minutes from midnight */
export function hhmmToMins(hhmm: string): number {
  const parts = hhmm.split(':')
  if (parts.length !== 2) throw new Error(`Invalid time format: ${hhmm}`)
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    throw new Error(`Invalid time value: ${hhmm}`)
  }
  return h * 60 + m
}

/** Total minutes from midnight → 'HH:MM' */
export function minsToHHMM(totalMins: number): string {
  const clamped = Math.max(0, Math.min(totalMins, 23 * 60 + 59))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Calculate end_time string from start_time + duration in minutes */
export function calcEndTime(startHHMM: string, durationMins: number): string {
  return minsToHHMM(hhmmToMins(startHHMM) + durationMins)
}

/** Check whether a time string is valid 'HH:MM' format */
export function isValidTime(hhmm: string): boolean {
  try {
    hhmmToMins(hhmm)
    return true
  } catch {
    return false
  }
}

/** Check whether start < end (times don't wrap midnight for simplicity) */
export function isTimeRangeValid(startHHMM: string, endHHMM: string): boolean {
  try {
    return hhmmToMins(startHHMM) < hhmmToMins(endHHMM)
  } catch {
    return false
  }
}

// ─── Sequence operations ──────────────────────────────────────────────────────

/**
 * Remove an item from a list and compact sequence numbers starting at 1.
 * Returns new array without the removed item, sequences renumbered.
 * Does NOT mutate the input.
 */
export function removeItemAndResequence<T extends { id: string; sequence_num: number }>(
  items: T[],
  itemId: string
): T[] {
  return items
    .filter(item => item.id !== itemId)
    .sort((a, b) => a.sequence_num - b.sequence_num)
    .map((item, index) => ({ ...item, sequence_num: index + 1 }))
}

/**
 * Reorder items list: move item at fromIndex to toIndex.
 * Compact sequence numbers starting at 1.
 * Does NOT mutate the input.
 */
export function reorderItems<T extends { sequence_num: number }>(
  items: T[],
  fromIndex: number,
  toIndex: number
): T[] {
  if (fromIndex === toIndex) return [...items]
  const sorted = [...items].sort((a, b) => a.sequence_num - b.sequence_num)
  const [moved] = sorted.splice(fromIndex, 1)
  sorted.splice(toIndex, 0, moved)
  return sorted.map((item, index) => ({ ...item, sequence_num: index + 1 }))
}

/**
 * Apply a time edit to a single item (change start_time + duration → recalc end_time).
 * Returns the updated item. Does NOT mutate the input.
 * Throws if the resulting time range is invalid.
 */
export function applyTimeEdit<T extends ItemTimeSlot>(
  item: T,
  updates: { start_time?: string; duration_mins?: number }
): T {
  const newStart    = updates.start_time    ?? item.start_time
  const newDuration = updates.duration_mins ?? item.duration_mins

  if (!isValidTime(newStart)) {
    throw new Error(`Invalid start_time: ${newStart}`)
  }
  if (newDuration <= 0) {
    throw new Error(`duration_mins must be positive, got: ${newDuration}`)
  }
  if (newDuration > 24 * 60) {
    throw new Error(`duration_mins exceeds 24 hours: ${newDuration}`)
  }

  const newEnd = calcEndTime(newStart, newDuration)
  return { ...item, start_time: newStart, end_time: newEnd, duration_mins: newDuration }
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface ItineraryItemUpdatePayload {
  start_time?: string
  duration_mins?: number
  ai_tip?: string
  sequence_num?: number
}

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string }

/** Validate a user-provided item update payload before applying it. */
export function validateItemUpdate(payload: ItineraryItemUpdatePayload): ValidationResult {
  if (payload.start_time !== undefined && !isValidTime(payload.start_time)) {
    return { valid: false, reason: `Invalid start_time format: ${payload.start_time}` }
  }
  if (payload.duration_mins !== undefined) {
    if (!Number.isInteger(payload.duration_mins)) {
      return { valid: false, reason: 'duration_mins must be an integer' }
    }
    if (payload.duration_mins <= 0) {
      return { valid: false, reason: 'duration_mins must be greater than 0' }
    }
    if (payload.duration_mins > 24 * 60) {
      return { valid: false, reason: 'duration_mins cannot exceed 24 hours (1440)' }
    }
  }
  if (payload.sequence_num !== undefined) {
    if (!Number.isInteger(payload.sequence_num) || payload.sequence_num < 1) {
      return { valid: false, reason: 'sequence_num must be a positive integer' }
    }
  }
  if (payload.ai_tip !== undefined && payload.ai_tip.length > 500) {
    return { valid: false, reason: 'ai_tip must not exceed 500 characters' }
  }
  return { valid: true }
}
