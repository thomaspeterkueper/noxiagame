// lib/worldlab/buildingConflict.server.ts
// Bauprüfung auf der Erde (Thomas, 25.10.2026): Wo ein echtes Haus steht, darf
// man nicht bauen – erst kaufen und abreißen. Auf einer freien Fläche nach
// Abriss darf nur der bauen, dem sie gehört.

import type { createServiceClient } from '@/lib/supabase/service'
import { geoToMerc, tileAt, tileOrigin, TILE_SIZE_MERC, type GeoPoint } from './mercator'
import { rectsOverlap } from './rects'
import { loadTile } from './tileSource.server'

type Supabase = ReturnType<typeof createServiceClient>
export type BuildingConflict = { kind: 'real'; name: string } | { kind: 'plot'; name: string } | null

/** Grundriss des neuen Baus (Mitte, Breite, Tiefe in m, Drehung in Grad wie tile_entities.rotation_deg). */
export async function realBuildingConflict(supabase: Supabase, at: GeoPoint, widthM: number, depthM: number, rotationDeg: number, profileId: string): Promise<BuildingConflict> {
  const merc = geoToMerc(at)
  const home = tileAt(merc)
  const hits: Array<{ source?: string; name: string }> = []
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const tile = { x: home.x + dx, y: home.y + dy }
    const data = await loadTile(supabase, tile)
    if (!data.blocks.length) continue
    const origin = tileOrigin(tile), k = TILE_SIZE_MERC / data.size
    const p = { x: (merc.x - origin.x) / k, y: (origin.y - merc.y) / k }
    const mine = { x: p.x, y: p.y, hw: widthM / 2, hd: depthM / 2, a: rotationDeg * Math.PI / 180 }
    for (const block of data.blocks) {
      // Ein halber Meter Spiel: Nachbarn, die sich nur berühren, zählen nicht.
      const theirs = { x: block.x, y: block.y, hw: Math.max(0.5, block.w / 2 - 0.5), hd: Math.max(0.5, block.d / 2 - 0.5), a: block.a }
      if (rectsOverlap(mine, theirs)) hits.push({ source: block.i, name: block.nm ?? block.h ?? 'ein Gebäude' })
    }
  }
  if (!hits.length) return null
  const sources = hits.map(hit => hit.source).filter((source): source is string => Boolean(source))
  const { data: cleared } = sources.length ? await supabase.from('earth_cleared_buildings').select('source_ref,profile_id').in('source_ref', sources) : { data: [] }
  const owner = new Map((cleared ?? []).map(row => [String(row.source_ref), String(row.profile_id)]))
  for (const hit of hits) {
    const plotOwner = hit.source ? owner.get(hit.source) : undefined
    if (plotOwner === undefined) return { kind: 'real', name: hit.name }
    if (plotOwner !== profileId) return { kind: 'plot', name: hit.name }
  }
  return null
}
