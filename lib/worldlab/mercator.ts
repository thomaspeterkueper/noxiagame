// lib/worldlab/mercator.ts
// Eine Welt, ein Koordinatensystem: Web-Mercator. Kacheln folgen dem üblichen
// Kartenraster (z/x/y), deshalb passt jede Kachel überall auf der Erde lückenlos
// an ihre Nachbarn – ohne Regionsanker und ohne Umrechnen zwischen Szenen.

export const EARTH_CIRCUMFERENCE_M = 40075016.68557849
const HALF = EARTH_CIRCUMFERENCE_M / 2

/** Kachelstufe des Prototyps: am 51. Breitengrad rund 190 m Kantenlänge am Boden. */
export const TILE_Z = 17
export const TILE_SIZE_MERC = EARTH_CIRCUMFERENCE_M / 2 ** TILE_Z

export interface MercPoint { x: number; y: number }
export interface GeoPoint { lat: number; lon: number }

export function geoToMerc(point: GeoPoint): MercPoint {
  const lat = Math.max(-85.05112878, Math.min(85.05112878, point.lat))
  return {
    x: point.lon / 180 * HALF,
    y: Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / Math.PI * HALF,
  }
}

export function mercToGeo(point: MercPoint): GeoPoint {
  return {
    lon: point.x / HALF * 180,
    lat: (2 * Math.atan(Math.exp(point.y / HALF * Math.PI)) - Math.PI / 2) * 180 / Math.PI,
  }
}

/** Mercator-Meter je Bodenmeter an dieser Breite (am Äquator 1, bei 51° etwa 1,6). */
export function mercPerGroundMetre(lat: number): number {
  return 1 / Math.cos(lat * Math.PI / 180)
}

export interface TileId { x: number; y: number }

/** Kachel, in der ein Mercator-Punkt liegt. Kachel-y zählt wie üblich von Norden. */
export function tileAt(point: MercPoint): TileId {
  return {
    x: Math.floor((point.x + HALF) / TILE_SIZE_MERC),
    y: Math.floor((HALF - point.y) / TILE_SIZE_MERC),
  }
}

/** Nordwestecke der Kachel in Mercator-Metern. */
export function tileOrigin(tile: TileId): MercPoint {
  return { x: tile.x * TILE_SIZE_MERC - HALF, y: HALF - tile.y * TILE_SIZE_MERC }
}

export function tileKey(tile: TileId): string {
  return `${tile.x}/${tile.y}`
}
