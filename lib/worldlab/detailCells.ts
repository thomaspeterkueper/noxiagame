// lib/worldlab/detailCells.ts
// Feste Zellen für das Nachladen von Ortsdetail (Gebäude, Wohnstraßen, Wege).
//
// Ortsdetail wird in Kreisen von 500 m geholt (lib/world/spatial/earthLocalEnrichment).
// Damit jeder Punkt der Erde genau einer Zelle gehört und ein Ort nicht zweimal
// geholt wird, liegen die Mitten auf einem festen Raster von rund 667 × 667 m.
// Die halbe Diagonale (≈ 471 m) bleibt unter dem Radius – die Kreise decken
// das Raster lückenlos.

import type { GeoPoint } from './mercator'

/** Rasterweite in Breitengraden (≈ 667 m). */
export const DETAIL_CELL_LAT = 0.006
/** Radius, mit dem eine Zelle geholt wird. */
export const DETAIL_RADIUS_KM = 0.5

const round5 = (value: number) => Math.round(value * 1e5) / 1e5

/** Mitte der Zelle, in der der Punkt liegt (auf fünf Stellen, wie die Ortskennung). */
export function detailCell(point: GeoPoint): GeoPoint {
  const row = Math.floor(point.lat / DETAIL_CELL_LAT)
  const lat = (row + 0.5) * DETAIL_CELL_LAT
  // Ost-West-Weite so, dass die Zelle in Metern quadratisch bleibt.
  const lonStep = DETAIL_CELL_LAT / Math.max(0.05, Math.cos(lat * Math.PI / 180))
  const col = Math.floor(point.lon / lonStep)
  return { lat: round5(lat), lon: round5((col + 0.5) * lonStep) }
}

/** Abstand in Metern (für kurze Strecken genügt die flache Näherung). */
export function groundDistanceM(a: GeoPoint, b: GeoPoint): number {
  const north = (a.lat - b.lat) * 111_195
  const east = (a.lon - b.lon) * 111_195 * Math.cos((a.lat + b.lat) / 2 * Math.PI / 180)
  return Math.hypot(north, east)
}
