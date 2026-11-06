// lib/worldlab/bodyProjection.ts
// Weltkarte jenseits der Erde (06.11.2026): dieselbe Kachelrechnung wie die Erde
// (`mercator.ts`), aber mit dem Umfang des jeweiligen Himmelskörpers. Mercator-Meter
// sind dann am Äquator dieses Körpers Bodenmeter; `mercPerGroundMetre` gilt
// unverändert, weil es nur von der Breite abhängt.
//
// Eigene Datei, damit `mercator.ts` (Teil des Kachelformats der Erde, siehe
// `tileFormat.ts`) unverändert bleibt und keine Erdkachel neu erzeugt werden muss.

import { geoToMerc, mercToGeo, tileAt, tileOrigin, TILE_SIZE_MERC, TILE_Z, EARTH_CIRCUMFERENCE_M, type GeoPoint, type MercPoint, type TileId } from './mercator'

/** Alles, was die Zeichenmaschine von der Kartenprojektion braucht. */
export interface Projection {
  /** Umfang am Äquator in Metern */
  circumferenceM: number
  tileSizeMerc: number
  geoToMerc: (point: GeoPoint) => MercPoint
  mercToGeo: (point: MercPoint) => GeoPoint
  tileAt: (point: MercPoint) => TileId
  tileOrigin: (tile: TileId) => MercPoint
}

/** Die Erde: genau die Funktionen aus `mercator.ts`. */
export const EARTH_PROJECTION: Projection = {
  circumferenceM: EARTH_CIRCUMFERENCE_M, tileSizeMerc: TILE_SIZE_MERC, geoToMerc, mercToGeo, tileAt, tileOrigin,
}

const MAX_LAT = 85.05112878

/**
 * Projektion für einen Körper mit diesem Äquatorradius, Kachelstufe wie die Erde
 * (Mars: rund 158 m je Kachel bei 14° N). Polnahe Orte (Shackleton am Mond-Südpol)
 * gehen damit nicht – Mercator endet bei 85°; dafür braucht es eine Polarprojektion.
 */
export function bodyProjection(equatorialRadiusM: number, tileZ = TILE_Z): Projection {
  const circumferenceM = 2 * Math.PI * equatorialRadiusM
  const half = circumferenceM / 2
  const size = circumferenceM / 2 ** tileZ
  return {
    circumferenceM,
    tileSizeMerc: size,
    geoToMerc: point => {
      const lat = Math.max(-MAX_LAT, Math.min(MAX_LAT, point.lat))
      return { x: point.lon / 180 * half, y: Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / Math.PI * half }
    },
    mercToGeo: point => ({ lon: point.x / half * 180, lat: (2 * Math.atan(Math.exp(point.y / half * Math.PI)) - Math.PI / 2) * 180 / Math.PI }),
    tileAt: point => ({ x: Math.floor((point.x + half) / size), y: Math.floor((half - point.y) / size) }),
    tileOrigin: tile => ({ x: tile.x * size - half, y: half - tile.y * size }),
  }
}

/** Geht dieser Ort mit Mercator? (Nein: Pole, z. B. Shackleton bei 89,8° S) */
export function mercatorUsable(lat: number): boolean {
  return Math.abs(lat) < 80
}
