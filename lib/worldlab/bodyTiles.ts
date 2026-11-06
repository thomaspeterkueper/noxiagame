// lib/worldlab/bodyTiles.ts
// Kacheln für andere Himmelskörper (06.11.2026). Es gibt dort kein OpenStreetMap;
// eine Kachel entsteht aus dem, was der Ort selbst kennt:
//   - Fahrwege des Ortes (Tharsis: `THARSIS_HUB_SURFACE_CORRIDORS`, Ost/Nord-Meter im
//     Rahmen des Ortes, `world_frames`) → Straßen der Kachel,
//   - später Gelände (MOLA) und Flächen (Landefeld, Radiatorfelder).
// Gebäude kommen nicht in die Kachel, sondern als NOXIA-Gebäude (`/api/world-lab/body`).

import { localEnuToPlanetary } from '@/lib/game/spatial/planetary'
import type { PlanetaryReference } from '@/lib/game/spatial/types'
import { mercPerGroundMetre, type GeoPoint, type TileId } from './mercator'
import type { Projection } from './bodyProjection'
import type { RoadClass, SimplifiedTile, TileRoad } from './simplify'

/** Weg im Rahmen des Ortes (Meter Ost/Nord vom Ursprung) */
export interface FrameCorridor { points: Array<{ xM: number; yM: number }>; kind?: 'prepared-track' | 'hardened-road'; name?: string }

export interface BodyTileSource {
  projection: Projection
  reference: PlanetaryReference
  origin: GeoPoint
  corridors: readonly FrameCorridor[]
}

const round1 = (value: number) => Math.round(value * 10) / 10

/** Weg in Breite/Länge des Körpers (einmal je Ort rechnen, nicht je Kachel). */
export function corridorsToGeo(source: Pick<BodyTileSource, 'reference' | 'origin' | 'corridors'>): Array<{ points: GeoPoint[]; c: RoadClass; n?: string }> {
  const origin = { latDeg: source.origin.lat, lonDeg: source.origin.lon, elevationM: 0 }
  return source.corridors.map(corridor => ({
    c: corridor.kind === 'hardened-road' ? 'street' : 'service',
    n: corridor.name,
    points: corridor.points.map(p => { const g = localEnuToPlanetary({ eastM: p.xM, northM: p.yM, upM: 0 }, origin, source.reference); return { lat: g.latDeg, lon: g.lonDeg } }),
  }))
}

/** Eine Kachel aus den Wegen des Ortes. Wege, die die Kachel (mit 10 m Rand) berühren, kommen ganz hinein. */
export function buildBodyTile(tile: TileId, z: number, projection: Projection, roads: ReadonlyArray<{ points: GeoPoint[]; c: RoadClass; n?: string }>): SimplifiedTile {
  const origin = projection.tileOrigin(tile)
  const lat = projection.mercToGeo({ x: origin.x + projection.tileSizeMerc / 2, y: origin.y - projection.tileSizeMerc / 2 }).lat
  const k = mercPerGroundMetre(lat)
  const size = projection.tileSizeMerc / k
  const local = (point: GeoPoint) => { const m = projection.geoToMerc(point); return { x: (m.x - origin.x) / k, y: (origin.y - m.y) / k } }
  const out: SimplifiedTile = { z, x: tile.x, y: tile.y, size: round1(size), roads: [], rivers: [], areas: [], blocks: [] }
  const margin = 10
  for (const road of roads) {
    const pts = road.points.map(local)
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y)
    if (Math.max(...xs) < -margin || Math.min(...xs) > size + margin || Math.max(...ys) < -margin || Math.min(...ys) > size + margin) continue
    const entry: TileRoad = { c: road.c, p: pts.flatMap(p => [round1(p.x), round1(p.y)]) }
    if (road.n) entry.n = road.n
    out.roads.push(entry)
  }
  return out
}
