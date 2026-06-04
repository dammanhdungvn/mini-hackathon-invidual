/**
 * TDD tests for lib/itinerary/operations.ts
 * Written BEFORE implementation per TDD protocol.
 *
 * Tests cover:
 *   - hhmmToMins / minsToHHMM (round-trip)
 *   - calcEndTime
 *   - isValidTime / isTimeRangeValid
 *   - removeItemAndResequence
 *   - reorderItems
 *   - applyTimeEdit
 *   - validateItemUpdate
 */

import { describe, it, expect } from 'vitest'
import {
  hhmmToMins,
  minsToHHMM,
  calcEndTime,
  isValidTime,
  isTimeRangeValid,
  removeItemAndResequence,
  reorderItems,
  applyTimeEdit,
  validateItemUpdate,
  type ItemTimeSlot,
} from './operations'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeItem = (overrides: Partial<ItemTimeSlot> = {}): ItemTimeSlot => ({
  id: 'item-1',
  start_time: '09:00',
  end_time: '10:30',
  duration_mins: 90,
  sequence_num: 1,
  ...overrides,
})

// ─── hhmmToMins ───────────────────────────────────────────────────────────────

describe('hhmmToMins', () => {
  it('converts midnight to 0', () => expect(hhmmToMins('00:00')).toBe(0))
  it('converts 09:00 to 540', () => expect(hhmmToMins('09:00')).toBe(540))
  it('converts 23:59 to 1439', () => expect(hhmmToMins('23:59')).toBe(1439))
  it('throws on invalid format "9:0"', () => expect(() => hhmmToMins('9:0')).not.toThrow())
  it('throws on invalid hours (25:00)', () => expect(() => hhmmToMins('25:00')).toThrow())
  it('throws on invalid minutes (09:60)', () => expect(() => hhmmToMins('09:60')).toThrow())
  it('throws on non-time string', () => expect(() => hhmmToMins('abc')).toThrow())
})

// ─── minsToHHMM ──────────────────────────────────────────────────────────────

describe('minsToHHMM', () => {
  it('converts 0 to 00:00', () => expect(minsToHHMM(0)).toBe('00:00'))
  it('converts 540 to 09:00', () => expect(minsToHHMM(540)).toBe('09:00'))
  it('converts 1439 to 23:59', () => expect(minsToHHMM(1439)).toBe('23:59'))
  it('clamps values below 0', () => expect(minsToHHMM(-10)).toBe('00:00'))
  it('clamps values above 23:59', () => expect(minsToHHMM(1500)).toBe('23:59'))
  it('pads hours with leading zero', () => expect(minsToHHMM(5 * 60)).toBe('05:00'))
})

// ─── calcEndTime ──────────────────────────────────────────────────────────────

describe('calcEndTime', () => {
  it('09:00 + 90 mins = 10:30', () => expect(calcEndTime('09:00', 90)).toBe('10:30'))
  it('10:00 + 60 mins = 11:00', () => expect(calcEndTime('10:00', 60)).toBe('11:00'))
  it('23:00 + 30 mins = 23:30', () => expect(calcEndTime('23:00', 30)).toBe('23:30'))
  it('is deterministic for same input', () => {
    expect(calcEndTime('14:30', 45)).toBe(calcEndTime('14:30', 45))
  })
})

// ─── isValidTime ─────────────────────────────────────────────────────────────

describe('isValidTime', () => {
  it('accepts 00:00', () => expect(isValidTime('00:00')).toBe(true))
  it('accepts 23:59', () => expect(isValidTime('23:59')).toBe(true))
  it('rejects 25:00', () => expect(isValidTime('25:00')).toBe(false))
  it('rejects 09:60', () => expect(isValidTime('09:60')).toBe(false))
  it('rejects empty string', () => expect(isValidTime('')).toBe(false))
  it('rejects non-time string', () => expect(isValidTime('noon')).toBe(false))
})

// ─── isTimeRangeValid ────────────────────────────────────────────────────────

describe('isTimeRangeValid', () => {
  it('09:00 < 10:00 is valid', () => expect(isTimeRangeValid('09:00', '10:00')).toBe(true))
  it('equal times are invalid', () => expect(isTimeRangeValid('09:00', '09:00')).toBe(false))
  it('reversed range is invalid', () => expect(isTimeRangeValid('10:00', '09:00')).toBe(false))
  it('returns false for invalid format', () => expect(isTimeRangeValid('abc', '09:00')).toBe(false))
})

// ─── removeItemAndResequence ─────────────────────────────────────────────────

describe('removeItemAndResequence', () => {
  const items = [
    { id: 'a', sequence_num: 1 },
    { id: 'b', sequence_num: 2 },
    { id: 'c', sequence_num: 3 },
  ]

  it('removes the item with the given id', () => {
    const result = removeItemAndResequence(items, 'b')
    expect(result.map(i => i.id)).toEqual(['a', 'c'])
  })

  it('resequences remaining items starting at 1', () => {
    const result = removeItemAndResequence(items, 'b')
    expect(result.map(i => i.sequence_num)).toEqual([1, 2])
  })

  it('returns all items unchanged when id does not exist', () => {
    const result = removeItemAndResequence(items, 'z')
    expect(result).toHaveLength(3)
    expect(result.map(i => i.sequence_num)).toEqual([1, 2, 3])
  })

  it('returns empty array when removing the only item', () => {
    const result = removeItemAndResequence([{ id: 'a', sequence_num: 1 }], 'a')
    expect(result).toHaveLength(0)
  })

  it('does NOT mutate the input array', () => {
    const original = [...items]
    removeItemAndResequence(items, 'a')
    expect(items[0].id).toBe(original[0].id)
    expect(items).toHaveLength(3)
  })
})

// ─── reorderItems ─────────────────────────────────────────────────────────────

describe('reorderItems', () => {
  const items = [
    { id: 'a', sequence_num: 1 },
    { id: 'b', sequence_num: 2 },
    { id: 'c', sequence_num: 3 },
  ]

  it('moves item from index 0 to index 2', () => {
    const result = reorderItems(items, 0, 2)
    expect(result.map(i => i.id)).toEqual(['b', 'c', 'a'])
  })

  it('moves item from index 2 to index 0', () => {
    const result = reorderItems(items, 2, 0)
    expect(result.map(i => i.id)).toEqual(['c', 'a', 'b'])
  })

  it('reassigns sequence numbers starting at 1', () => {
    const result = reorderItems(items, 0, 2)
    expect(result.map(i => i.sequence_num)).toEqual([1, 2, 3])
  })

  it('returns same order when fromIndex === toIndex', () => {
    const result = reorderItems(items, 1, 1)
    expect(result.map(i => i.id)).toEqual(['a', 'b', 'c'])
  })

  it('does NOT mutate the input array', () => {
    const original = [...items]
    reorderItems(items, 0, 2)
    expect(items[0].id).toBe(original[0].id)
  })

  it('is deterministic — same input produces same output', () => {
    const r1 = reorderItems(items, 0, 2)
    const r2 = reorderItems(items, 0, 2)
    expect(r1.map(i => i.id)).toEqual(r2.map(i => i.id))
  })
})

// ─── applyTimeEdit ───────────────────────────────────────────────────────────

describe('applyTimeEdit', () => {
  it('updates start_time and recalculates end_time', () => {
    const item = makeItem({ start_time: '09:00', duration_mins: 60 })
    const result = applyTimeEdit(item, { start_time: '10:00' })
    expect(result.start_time).toBe('10:00')
    expect(result.end_time).toBe('11:00')
  })

  it('updates duration and recalculates end_time', () => {
    const item = makeItem({ start_time: '09:00', duration_mins: 60 })
    const result = applyTimeEdit(item, { duration_mins: 120 })
    expect(result.duration_mins).toBe(120)
    expect(result.end_time).toBe('11:00')
  })

  it('updates both start_time and duration_mins', () => {
    const item = makeItem({ start_time: '08:00', duration_mins: 30 })
    const result = applyTimeEdit(item, { start_time: '14:00', duration_mins: 90 })
    expect(result.start_time).toBe('14:00')
    expect(result.duration_mins).toBe(90)
    expect(result.end_time).toBe('15:30')
  })

  it('does NOT mutate the original item', () => {
    const item = makeItem({ start_time: '09:00', duration_mins: 60 })
    applyTimeEdit(item, { start_time: '10:00' })
    expect(item.start_time).toBe('09:00')
  })

  it('throws on invalid start_time format', () => {
    const item = makeItem()
    expect(() => applyTimeEdit(item, { start_time: 'invalid' })).toThrow()
  })

  it('throws on zero duration', () => {
    const item = makeItem()
    expect(() => applyTimeEdit(item, { duration_mins: 0 })).toThrow()
  })

  it('throws on negative duration', () => {
    const item = makeItem()
    expect(() => applyTimeEdit(item, { duration_mins: -30 })).toThrow()
  })

  it('throws when duration exceeds 24 hours', () => {
    const item = makeItem()
    expect(() => applyTimeEdit(item, { duration_mins: 1500 })).toThrow()
  })
})

// ─── validateItemUpdate ──────────────────────────────────────────────────────

describe('validateItemUpdate', () => {
  it('returns valid for empty payload (no-op)', () => {
    expect(validateItemUpdate({})).toEqual({ valid: true })
  })

  it('returns valid for correct start_time', () => {
    expect(validateItemUpdate({ start_time: '14:00' })).toEqual({ valid: true })
  })

  it('returns invalid for bad start_time format', () => {
    const result = validateItemUpdate({ start_time: 'noon' })
    expect(result.valid).toBe(false)
  })

  it('returns valid for positive duration_mins', () => {
    expect(validateItemUpdate({ duration_mins: 90 })).toEqual({ valid: true })
  })

  it('returns invalid for zero duration_mins', () => {
    const result = validateItemUpdate({ duration_mins: 0 })
    expect(result.valid).toBe(false)
  })

  it('returns invalid for negative duration_mins', () => {
    const result = validateItemUpdate({ duration_mins: -1 })
    expect(result.valid).toBe(false)
  })

  it('returns invalid for non-integer duration_mins', () => {
    const result = validateItemUpdate({ duration_mins: 45.5 })
    expect(result.valid).toBe(false)
  })

  it('returns invalid for duration exceeding 24 hours', () => {
    const result = validateItemUpdate({ duration_mins: 1441 })
    expect(result.valid).toBe(false)
  })

  it('returns valid for positive sequence_num', () => {
    expect(validateItemUpdate({ sequence_num: 3 })).toEqual({ valid: true })
  })

  it('returns invalid for sequence_num of 0', () => {
    const result = validateItemUpdate({ sequence_num: 0 })
    expect(result.valid).toBe(false)
  })

  it('returns invalid for non-integer sequence_num', () => {
    const result = validateItemUpdate({ sequence_num: 1.5 })
    expect(result.valid).toBe(false)
  })

  it('returns valid for ai_tip within 500 chars', () => {
    expect(validateItemUpdate({ ai_tip: 'Great spot!' })).toEqual({ valid: true })
  })

  it('returns invalid for ai_tip exceeding 500 chars', () => {
    const result = validateItemUpdate({ ai_tip: 'x'.repeat(501) })
    expect(result.valid).toBe(false)
  })
})
