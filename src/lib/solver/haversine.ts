/**
 * Haversine distance utility.
 * Pure TypeScript — no imports, no side effects, fully deterministic.
 */

/** Returns great-circle distance in kilometres between two lat/lng points */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Estimates travel time in minutes between two points.
 * Uses walking for ≤1.5 km, city taxi for ≤10 km, express transit beyond.
 */
export function estimateTravelMins(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const km = haversineKm(lat1, lng1, lat2, lng2)
  if (km <= 1.5) return Math.ceil(km * 15)          // walk ~4 km/h
  if (km <= 10)  return Math.ceil(km * 3)            // taxi ~20 km/h
  return Math.ceil(km * 1.5 + 10)                    // express + 10min overhead
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}
