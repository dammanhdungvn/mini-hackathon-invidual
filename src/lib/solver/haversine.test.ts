import { describe, it, expect } from 'vitest'
import { haversineKm, estimateTravelMins } from './haversine'

describe('haversineKm', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineKm(35.6762, 139.6503, 35.6762, 139.6503)).toBe(0)
  })

  it('calculates Tokyo–Osaka distance (~400 km)', () => {
    const km = haversineKm(35.6762, 139.6503, 34.6937, 135.5023)
    expect(km).toBeGreaterThan(390)
    expect(km).toBeLessThan(420)
  })

  it('calculates short walking distance correctly', () => {
    // ~200m apart
    const km = haversineKm(35.6762, 139.6503, 35.6780, 139.6503)
    expect(km).toBeGreaterThan(0.1)
    expect(km).toBeLessThan(0.3)
  })

  it('is symmetric — A→B equals B→A', () => {
    const d1 = haversineKm(10, 20, 15, 25)
    const d2 = haversineKm(15, 25, 10, 20)
    expect(d1).toBeCloseTo(d2, 10)
  })
})

describe('estimateTravelMins', () => {
  it('uses walking speed for short distances (≤1.5km)', () => {
    // 1 km → ceil(1 * 15) = 15 mins
    const mins = estimateTravelMins(35.6762, 139.6503, 35.6852, 139.6503)
    expect(mins).toBeLessThanOrEqual(25)
    expect(mins).toBeGreaterThan(0)
  })

  it('uses taxi speed for medium distances (1.5–10km)', () => {
    // ~5 km apart
    const mins = estimateTravelMins(35.6762, 139.6503, 35.7200, 139.6503)
    expect(mins).toBeLessThan(30)
    expect(mins).toBeGreaterThan(5)
  })

  it('uses express transit for long distances (>10km)', () => {
    const mins = estimateTravelMins(35.6762, 139.6503, 35.8762, 139.6503)
    expect(mins).toBeGreaterThan(15)
  })

  it('returns 0 travel time for identical coordinates', () => {
    expect(estimateTravelMins(35.6762, 139.6503, 35.6762, 139.6503)).toBe(0)
  })
})
