// lib/worldlab/landPlot.ts
// Freies Land abstecken (Thomas, 28.10.2026: „man sollte auch Grundstücke kaufen
// können, nicht nur Häuser“). Wo es kein offenes Kataster gibt, steckt der Spieler
// ein rechteckiges Grundstück ab. Hier die reine Geometrie, ohne Datenbank:
// Rechteck in WGS84, Überschneidung von Vielecken, Abstand zu Linien.

import type { GeoPoint } from './mercator'

export type P = { x: number; y: number }

/** Wählbare Größen (Seitenlänge in m). */
export const LAND_SIZES = [20, 30, 40, 60] as const
export const LAND_MIN_M = 10
export const LAND_MAX_M = 80
/** Abstand zu fremden Häusern ohne Kataster (wie die Bauprüfung). */
export const LAND_GARDEN_M = 6

const M_PER_DEG = 111_320

/** Ecken eines gedrehten Rechtecks (Drehung wie tile_entities.rotation_deg: x Osten, y Süden). */
export function rectRing(at: GeoPoint, w: number, d: number, rotationDeg: number): GeoPoint[] {
  const a = rotationDeg * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a)
  const k = M_PER_DEG * Math.cos(at.lat * Math.PI / 180)
  return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([lx, ly]) => {
    const x = lx * cos - ly * sin, y = lx * sin + ly * cos
    return { lat: at.lat - y / M_PER_DEG, lon: at.lon + x / k }
  })
}

/** WGS84 → Meter um einen Bezugspunkt (x Osten, y Süden – wie die Kacheln). */
export function toLocal(origin: GeoPoint, p: GeoPoint): P {
  return { x: (p.lon - origin.lon) * M_PER_DEG * Math.cos(origin.lat * Math.PI / 180), y: (origin.lat - p.lat) * M_PER_DEG }
}

export function insidePolygon(p: P, ring: readonly P[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j]
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

function cross(o: P, a: P, b: P) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x) }
function segmentsCross(a: P, b: P, c: P, d: P): boolean {
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d)
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0))
}

/** Überschneiden sich zwei Vielecke (auch nicht konvexe) mit Fläche? Bloßes Berühren zählt nicht. */
export function polygonsOverlap(a: readonly P[], b: readonly P[]): boolean {
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    if (segmentsCross(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return true
  }
  const centre = (ring: readonly P[]) => ({ x: ring.reduce((s, p) => s + p.x, 0) / ring.length, y: ring.reduce((s, p) => s + p.y, 0) / ring.length })
  return insidePolygon(centre(a), b) || insidePolygon(centre(b), a)
}

function pointSegmentDistance(p: P, a: P, b: P) {
  const dx = b.x - a.x, dy = b.y - a.y, len = dx * dx + dy * dy
  const t = len ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len)) : 0
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** Kommt eine Linie (Punkte) dem Vieleck näher als `margin` Meter (oder läuft hindurch)? */
export function lineTouchesPolygon(line: readonly P[], ring: readonly P[], margin: number): boolean {
  for (const p of line) if (insidePolygon(p, ring)) return true
  for (let i = 0; i + 1 < line.length; i++) {
    for (let j = 0; j < ring.length; j++) {
      const c = ring[j], d = ring[(j + 1) % ring.length]
      if (segmentsCross(line[i], line[i + 1], c, d)) return true
      if (pointSegmentDistance(c, line[i], line[i + 1]) < margin) return true
      if (pointSegmentDistance(line[i], c, d) < margin || pointSegmentDistance(line[i + 1], c, d) < margin) return true
    }
  }
  return false
}

/** Fläche eines Vielecks in m² (lokale Meter). */
export function polygonAreaM2(ring: readonly P[]): number {
  let sum = 0
  for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; sum += a.x * b.y - b.x * a.y }
  return Math.abs(sum) / 2
}

/** Bodenwert je m² nach der Fläche aus der Karte (wie landRate im Kataster). */
export function landRateForArea(kind: string | null): number {
  if (kind === 'built') return 4
  if (kind === 'field') return 0.6
  if (kind === 'forest') return 0.4
  return 2
}
export const LAND_USE_LABEL: Record<string, string> = { built: 'Bauland', field: 'Feld', forest: 'Wald' }
/** Flächen, auf denen man kein Land abstecken kann (öffentlich oder Wasser). */
export const LAND_BLOCKING_AREAS: Record<string, string> = {
  water: 'Gewässer', park: 'Park', playground: 'Spielplatz', cemetery: 'Friedhof', allotments: 'Kleingärten',
  parking: 'Parkplatz', pool: 'Freibad', grounds: 'Sportanlage', track: 'Laufbahn', pitch: 'Sportplatz',
  sand: 'Sportplatz', hardcourt: 'Sportplatz', clay: 'Tennisplatz', plaza: 'Platz', garden: 'Garten',
}
/** Halbe Breite je Straßenart (m); Wege durch Felder und Wald stören nicht. */
export const LAND_ROAD_HALF_WIDTH: Record<string, number> = { main: 5, street: 3.5, service: 2.5 }

/** Größe zulässig? */
export function landSizeValid(w: number, d: number) {
  return Number.isFinite(w) && Number.isFinite(d) && w >= LAND_MIN_M && d >= LAND_MIN_M && w <= LAND_MAX_M && d <= LAND_MAX_M
}

/**
 * Ohne Nutzungsart aus dem Kataster (Hessen liefert sie bei uns nicht): Ist das
 * Flurstück eine Straße? Straßen-Flurstücke sind schmal und eine Straßenmitte läuft
 * lange hindurch. Maß: Fläche je Meter Straße im Flurstück unter 16 m bei
 * mindestens 15 m Straße. Ein Hausgrundstück, an dessen Rand die OSM-Linie
 * etwas hineinragt, bleibt darüber.
 */
export function looksLikeStreetParcel(parcel: readonly P[], roads: ReadonlyArray<readonly P[]>): boolean {
  let insideM = 0
  for (const line of roads) {
    for (let i = 0; i + 1 < line.length; i++) {
      const a = line[i], b = line[i + 1], len = Math.hypot(b.x - a.x, b.y - a.y)
      const steps = Math.max(1, Math.ceil(len / 2))
      for (let k = 0; k < steps; k++) {
        const t = (k + 0.5) / steps
        if (insidePolygon({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, parcel)) insideM += len / steps
      }
    }
  }
  return insideM >= 15 && polygonAreaM2(parcel) / insideM < 16
}
