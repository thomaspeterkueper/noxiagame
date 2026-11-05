// lib/worldlab/graves.ts
// W-19 (05.11.2026): Grabsteine auf Friedhofsflächen der Weltkarte.
//
// Die Reihen laufen im Winkel der Karte: entlang (1, −1), also quer zur
// Blickrichtung. So liegt eine ganze Reihe auf derselben Tiefe (x + y) und kann
// als ein Objekt gezeichnet werden, vor und hinter dem die Figur richtig steht.
// Das Raster hängt an absoluten Kachelmetern, damit Nachbarkacheln nahtlos
// aneinanderpassen. Grabfelder mit Wegen dazwischen, Abstand zu Rand, Häusern und Bäumen.
// Namen gibt es erst mit Gräbern aus der Simulation (R-23); hier wird nichts erfunden.

import { insidePolygon } from './walking'
import { seeded } from './ambient'

type P = { x: number; y: number }

/** Abstand der Reihen und der Gräber in einer Reihe (Meter) */
export const GRAVE_ROW_M = 2.8
export const GRAVE_STEP_M = 1.6
const ROWS_PER_FIELD = 5      // danach ein Querweg
const GRAVES_PER_FIELD = 7    // danach ein Längsweg
const EDGE_M = 1.8
const MAX_GRAVES = 1800       // je Kachel, damit große Friedhöfe die Karte nicht ausbremsen

export type GraveSpot = { x: number; y: number; /** Tiefe der Reihe (x + y in Kachelmetern) */ row: number; cross: boolean }

/**
 * Grabplätze in einer Friedhofsfläche.
 * `ring`: Fläche in Kachelmetern; `origin`: Lage der Kachel in absoluten Metern;
 * `blocked`: Häuser (Mitte und Radius) und Bäume, an denen kein Grab liegt.
 */
export function graveSpots(ring: P[], origin: P, blocked: Array<{ x: number; y: number; r: number }>, crosses: boolean): GraveSpot[] {
  if (ring.length < 3) return []
  const sx = GRAVE_ROW_M * Math.SQRT2, tx = GRAVE_STEP_M * Math.SQRT2
  let minS = Infinity, maxS = -Infinity, minT = Infinity, maxT = -Infinity
  for (const p of ring) { const s = p.x + p.y, t = p.x - p.y; minS = Math.min(minS, s); maxS = Math.max(maxS, s); minT = Math.min(minT, t); maxT = Math.max(maxT, t) }
  const gs = origin.x + origin.y, gt = origin.x - origin.y
  const out: GraveSpot[] = []
  const inside = (p: P) => insidePolygon(p, ring)
  for (let i = Math.ceil((minS + gs) / sx); i * sx - gs <= maxS; i++) {
    const field = ((i % (ROWS_PER_FIELD + 1)) + ROWS_PER_FIELD + 1) % (ROWS_PER_FIELD + 1)
    if (field === ROWS_PER_FIELD) continue                                   // Querweg
    const s = i * sx - gs
    for (let j = Math.ceil((minT + gt) / tx); j * tx - gt <= maxT; j++) {
      const lane = ((j % (GRAVES_PER_FIELD + 1)) + GRAVES_PER_FIELD + 1) % (GRAVES_PER_FIELD + 1)
      if (lane === GRAVES_PER_FIELD) continue                                // Längsweg
      const t = j * tx - gt
      const p = { x: (s + t) / 2, y: (s - t) / 2 }
      if (!inside(p)) continue
      // Abstand zum Rand: vier Nachbarpunkte müssen auch drinnen liegen
      if (!inside({ x: p.x + EDGE_M, y: p.y }) || !inside({ x: p.x - EDGE_M, y: p.y }) || !inside({ x: p.x, y: p.y + EDGE_M }) || !inside({ x: p.x, y: p.y - EDGE_M })) continue
      if (blocked.some(b => Math.hypot(b.x - p.x, b.y - p.y) < b.r)) continue
      // Hier und da eine freie Stelle, damit es nicht wie gestempelt aussieht
      const key = `${i}:${j}`
      if (seeded('grave:' + key) < 0.12) continue
      out.push({ x: p.x, y: p.y, row: s, cross: crosses && seeded('cross:' + key) < 0.14 })
      if (out.length >= MAX_GRAVES) return out
    }
  }
  return out
}
