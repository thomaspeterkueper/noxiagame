// lib/worldlab/buildingConflict.server.ts
// Bauprüfung auf der Erde (Thomas, 25.10.2026):
//   * Wo Flurstücke bekannt sind (Kataster NRW): Der Neubau muss ganz auf eigenen
//     Flurstücken liegen – niemand baut im Garten eines anderen.
//   * Wo ein echtes Haus steht, wird nicht gebaut – erst kaufen und abreißen.
//   * Ohne Kataster wird das Grundstück geschätzt: um fremde Häuser bleibt ein
//     Garten von 6 m frei.
//   * Auf einer freien Fläche nach Abriss baut nur, wem sie gehört.

import type { createServiceClient } from '@/lib/supabase/service'
import { geoToMerc, tileAt, tileOrigin, TILE_SIZE_MERC, type GeoPoint } from './mercator'
import { rectsOverlap } from './rects'
import { loadTile } from './tileSource.server'
import { insideRing, parcelsAround } from './parcelOffer.server'

type Supabase = ReturnType<typeof createServiceClient>
export type BuildingConflict =
  | { kind: 'real'; name: string }
  | { kind: 'plot'; name: string }
  | { kind: 'parcel'; name: string }
  | { kind: 'garden'; name: string }
  | null

/** Geschätzter Garten um fremde Häuser, wo es kein Kataster gibt (m). */
const GARDEN_M = 6
const M_PER_DEG = 111320

/** Ecken und Mitte des Neubaus in WGS84 (Drehung wie tile_entities.rotation_deg: x Osten, y Süden). */
function footprintPoints(at: GeoPoint, w: number, d: number, rotationDeg: number): GeoPoint[] {
  const a = rotationDeg * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a)
  const k = M_PER_DEG * Math.cos(at.lat * Math.PI / 180)
  return [[0, 0], [-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([lx, ly]) => {
    const x = lx * cos - ly * sin, y = lx * sin + ly * cos
    return { lat: at.lat - y / M_PER_DEG, lon: at.lon + x / k }
  })
}

export async function realBuildingConflict(supabase: Supabase, at: GeoPoint, widthM: number, depthM: number, rotationDeg: number, profileId: string): Promise<BuildingConflict> {
  // 1. Kataster: jede Ecke auf einem eigenen Flurstück
  const parcels = await parcelsAround(supabase, at, Math.hypot(widthM, depthM) / 2 + 10)
  const withCadastre = parcels.length > 0
  if (withCadastre) {
    for (const point of footprintPoints(at, widthM, depthM, rotationDeg)) {
      const parcel = parcels.find(row => Array.isArray(row.ring) && insideRing(point, row.ring))
      if (!parcel) return { kind: 'parcel', name: 'kein Flurstück' }
      if (parcel.owner !== profileId) return { kind: 'parcel', name: parcel.owner ? 'einem anderen Spieler' : 'der Gemeinde' }
    }
  }

  // 2. Echte Häuser (und ohne Kataster ihr Garten)
  const merc = geoToMerc(at)
  const home = tileAt(merc)
  const hits: Array<{ source?: string; name: string; garden: boolean }> = []
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const tile = { x: home.x + dx, y: home.y + dy }
    const data = await loadTile(supabase, tile)
    if (!data.blocks.length) continue
    const origin = tileOrigin(tile), k = TILE_SIZE_MERC / data.size
    const p = { x: (merc.x - origin.x) / k, y: (origin.y - merc.y) / k }
    const mine = { x: p.x, y: p.y, hw: widthM / 2, hd: depthM / 2, a: rotationDeg * Math.PI / 180 }
    for (const block of data.blocks) {
      // Ein halber Meter Spiel: Nachbarn, die sich nur berühren, zählen nicht.
      const house = { x: block.x, y: block.y, hw: Math.max(0.5, block.w / 2 - 0.5), hd: Math.max(0.5, block.d / 2 - 0.5), a: block.a }
      const name = block.nm ?? block.h ?? 'ein Gebäude'
      if (rectsOverlap(mine, house)) hits.push({ source: block.i, name, garden: false })
      else if (!withCadastre && rectsOverlap(mine, { ...house, hw: house.hw + GARDEN_M, hd: house.hd + GARDEN_M })) hits.push({ source: block.i, name, garden: true })
    }
  }
  if (!hits.length) return null
  const sources = hits.map(hit => hit.source).filter((source): source is string => Boolean(source))
  const [{ data: cleared }, { data: acquired }] = sources.length
    ? await Promise.all([
        supabase.from('earth_cleared_buildings').select('source_ref,profile_id').in('source_ref', sources),
        supabase.from('tile_entities').select('source_ref,profile_id').in('source_ref', sources),
      ])
    : [{ data: [] }, { data: [] }]
  const clearedBy = new Map((cleared ?? []).map(row => [String(row.source_ref), String(row.profile_id)]))
  const ownedBy = new Map((acquired ?? []).map(row => [String(row.source_ref), String(row.profile_id)]))
  for (const hit of hits) {
    const plotOwner = hit.source ? clearedBy.get(hit.source) : undefined
    if (hit.garden) {
      // Garten eines eigenen (gekauften oder abgerissenen) Hauses ist eigener Grund.
      const owner = hit.source ? ownedBy.get(hit.source) ?? plotOwner : undefined
      if (owner !== profileId) return { kind: 'garden', name: hit.name }
      continue
    }
    if (plotOwner === undefined) return { kind: 'real', name: hit.name }
    if (plotOwner !== profileId) return { kind: 'plot', name: hit.name }
  }
  return null
}
