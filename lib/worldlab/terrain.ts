// lib/worldlab/terrain.ts
// Gelände der Erdkarte (NOXIA-WORLD-0004, Schritt „Gelände zuerst“, Thomas 05.11.2026).
//
// Höhen liegen auf einem festen Gitter: je Kachel der Stufe 15 (am 51. Breitengrad
// rund 760 m) 9 × 9 Punkte, also etwa alle 95 m – so fein wie das Geländemodell
// (Copernicus GLO-90). Benachbarte Zellen teilen ihre Randpunkte, deshalb gibt es
// keine Sprünge an den Zellgrenzen. Eine Kachel der Stufe 17 liegt immer ganz in
// einer Zelle; ihre 9 × 9 Eckhöhen werden daraus weich (bilinear) gerechnet.
//
// Gezeichnet wird zuerst nur auf dem flachen Boden: Hangschattierung (Licht aus
// Nordwesten) und Höhenlinien. Die Kachel selbst bleibt flach.

import { mercToGeo, TILE_SIZE_MERC, TILE_Z, tileOrigin, type GeoPoint, type TileId } from './mercator'

/**
 * Gelände einer ausgelieferten Kachel: 9 × 9 Eckhöhen in Metern, zeilenweise von Norden.
 * Bewusst nicht Teil der Grundkachel (world_tiles) – kommt wie die Flurstücke frisch dazu.
 */
export interface TileTerrainPart { terrain?: number[] }

/** Stufe des Höhengitters */
export const TERRAIN_Z = 15
/** Punkte je Seite einer Höhenzelle */
export const TERRAIN_N = 9
/** Punkte je Seite der Höhen einer Kartenkachel (Stufe 17) */
export const TILE_TERRAIN_N = 9

const SCALE = 2 ** (TILE_Z - TERRAIN_Z)
const CELL_SIZE_MERC = TILE_SIZE_MERC * SCALE

export interface TerrainCellId { x: number; y: number }

export function terrainCellOf(tile: TileId): TerrainCellId {
  return { x: Math.floor(tile.x / SCALE), y: Math.floor(tile.y / SCALE) }
}

/** Gitterpunkte einer Höhenzelle, zeilenweise von Norden nach Süden, je Zeile von Westen nach Osten. */
export function terrainLattice(cell: TerrainCellId): GeoPoint[] {
  const nw = tileOrigin({ x: cell.x * SCALE, y: cell.y * SCALE })
  const points: GeoPoint[] = []
  for (let row = 0; row < TERRAIN_N; row++) for (let col = 0; col < TERRAIN_N; col++) {
    points.push(mercToGeo({ x: nw.x + col / (TERRAIN_N - 1) * CELL_SIZE_MERC, y: nw.y - row / (TERRAIN_N - 1) * CELL_SIZE_MERC }))
  }
  return points
}

/** Höhenzellen in einem Quadrat um eine Zelle (radius 1 → 3 × 3). */
export function terrainCellsAround(cell: TerrainCellId, radius: number): TerrainCellId[] {
  const out: TerrainCellId[] = []
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) out.push({ x: cell.x + dx, y: cell.y + dy })
  return out
}

/**
 * Eckhöhen einer Kartenkachel aus den Höhen ihrer Zelle (bilinear), auf 0,1 m gerundet.
 * Ergebnis zeilenweise von Norden (j = 0) nach Süden, je Zeile von Westen (i = 0).
 */
export function tileTerrain(cellHeights: readonly number[], tile: TileId): number[] | null {
  if (cellHeights.length !== TERRAIN_N * TERRAIN_N || cellHeights.some(h => !Number.isFinite(h))) return null
  const subX = ((tile.x % SCALE) + SCALE) % SCALE, subY = ((tile.y % SCALE) + SCALE) % SCALE
  const last = TERRAIN_N - 1, steps = TILE_TERRAIN_N - 1
  const at = (col: number, row: number) => cellHeights[row * TERRAIN_N + col]
  const out: number[] = []
  for (let j = 0; j <= steps; j++) for (let i = 0; i <= steps; i++) {
    const u = (subX + i / steps) / SCALE * last, v = (subY + j / steps) / SCALE * last
    const c0 = Math.min(last - 1, Math.floor(u)), r0 = Math.min(last - 1, Math.floor(v))
    const fu = u - c0, fv = v - r0
    const top = at(c0, r0) * (1 - fu) + at(c0 + 1, r0) * fu
    const bottom = at(c0, r0 + 1) * (1 - fu) + at(c0 + 1, r0 + 1) * fu
    out.push(Math.round((top * (1 - fv) + bottom * fv) * 10) / 10)
  }
  return out
}

export interface TerrainShade {
  /** Vierecke in Metern der Kachel (x nach Osten, y nach Süden), je mit Helligkeit −1 … 1 (0 = eben) */
  quads: Array<{ p: [number, number, number, number, number, number, number, number]; light: number }>
  /** Höhenlinien als Strecken x0, y0, x1, y1 in Metern der Kachel; major = jede fünfte Linie */
  contours: Array<{ s: number[]; major: boolean }>
}

/** Licht aus Nordwesten, 45° hoch; Überhöhung, damit sanfte Hänge sichtbar werden. */
const LIGHT = { x: -Math.SQRT1_2 * Math.SQRT1_2, y: -Math.SQRT1_2 * Math.SQRT1_2, z: Math.SQRT1_2 }
const EXAGGERATION = 2

/**
 * Hangschattierung und Höhenlinien für eine Kachel.
 * heights: n × n Eckhöhen (wie tileTerrain), sizeM: Kantenlänge der Kachel in Bodenmetern.
 */
export function terrainShade(heights: readonly number[], sizeM: number, intervalM = 10): TerrainShade {
  const n = Math.round(Math.sqrt(heights.length))
  const quads: TerrainShade['quads'] = []
  const contours: TerrainShade['contours'] = []
  if (n < 2 || n * n !== heights.length) return { quads, contours }
  const step = sizeM / (n - 1)
  const h = (i: number, j: number) => heights[j * n + i]
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const a = h(i, j), b = h(i + 1, j), c = h(i + 1, j + 1), d = h(i, j + 1)
    // Steigung je Meter (x nach Osten, y nach Süden)
    const dzdx = ((b - a) + (c - d)) / 2 / step * EXAGGERATION
    const dzdy = ((d - a) + (c - b)) / 2 / step * EXAGGERATION
    const len = Math.hypot(dzdx, dzdy, 1)
    const lit = (-dzdx * LIGHT.x - dzdy * LIGHT.y + LIGHT.z) / len
    const light = Math.max(-1, Math.min(1, (lit - LIGHT.z) * 3))
    const x0 = i * step, y0 = j * step, x1 = x0 + step, y1 = y0 + step
    if (Math.abs(light) >= 0.02) quads.push({ p: [x0, y0, x1, y0, x1, y1, x0, y1], light })
  }
  // Höhenlinien: Marching Squares je Zelle
  let min = Infinity, max = -Infinity
  for (const v of heights) { if (v < min) min = v; if (v > max) max = v }
  for (let level = Math.ceil(min / intervalM) * intervalM; level <= max; level += intervalM) {
    const s: number[] = []
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
      const corners: Array<[number, number, number]> = [
        [i * step, j * step, h(i, j)], [(i + 1) * step, j * step, h(i + 1, j)],
        [(i + 1) * step, (j + 1) * step, h(i + 1, j + 1)], [i * step, (j + 1) * step, h(i, j + 1)],
      ]
      const hits: number[] = []
      for (let k = 0; k < 4; k++) {
        const [xa, ya, za] = corners[k], [xb, yb, zb] = corners[(k + 1) % 4]
        // Halboffen, damit eine Linie genau auf einem Eckpunkt nicht doppelt zählt
        if ((za < level) === (zb < level)) continue
        const t = (level - za) / (zb - za)
        hits.push(xa + (xb - xa) * t, ya + (yb - ya) * t)
      }
      if (hits.length === 4) s.push(...hits)
      else if (hits.length === 8) s.push(hits[0], hits[1], hits[2], hits[3], hits[4], hits[5], hits[6], hits[7])
    }
    if (s.length) contours.push({ s: s.map(v => Math.round(v * 10) / 10), major: Math.round(level / intervalM) % 5 === 0 })
  }
  return { quads, contours }
}
