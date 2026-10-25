// lib/worldlab/tileSource.server.ts
// Kartendaten einer Kachel aus den gespeicherten Erdregionen – gemeinsam für
// /api/world-lab/tile und die Bauprüfung (echte Häuser, Grundstücke).
// Regionen und ihre Objekte werden 10 Minuten im Speicher gehalten.

import type { createServiceClient } from '@/lib/supabase/service'
import { mercToGeo, tileOrigin, TILE_SIZE_MERC, TILE_Z, type TileId } from './mercator'
import { buildTile, type SimplifiedTile, type SourceFeature } from './simplify'

type Supabase = ReturnType<typeof createServiceClient>
type Region = { id: string; lat: number; lon: number; radiusKm: number }
const REGION_TTL_MS = 10 * 60_000
let regionCache: { at: number; regions: Region[] } | null = null
const featureCache = new Map<string, { at: number; features: SourceFeature[] }>()

/** Zwischenspeicher leeren (nach einem Nachladen der Kartendaten). */
export function clearTileSourceCache() { regionCache = null; featureCache.clear() }

async function earthRegions(supabase: Supabase): Promise<Region[]> {
  if (regionCache && Date.now() - regionCache.at < REGION_TTL_MS) return regionCache.regions
  const { data } = await supabase.from('celestial_regions').select('id,center_lat,center_lon,radius_km').eq('body', 'earth')
  const regions = (data ?? []).map(row => ({ id: String(row.id), lat: Number(row.center_lat), lon: Number(row.center_lon), radiusKm: Number(row.radius_km ?? 0) }))
    .filter(region => Number.isFinite(region.lat) && Number.isFinite(region.lon))
  regionCache = { at: Date.now(), regions }
  return regions
}

async function regionFeatures(supabase: Supabase, regionId: string): Promise<SourceFeature[]> {
  const cached = featureCache.get(regionId)
  if (cached && Date.now() - cached.at < REGION_TTL_MS) return cached.features
  const features: SourceFeature[] = []
  // Der Datenbankzugang liefert höchstens 1000 Zeilen je Abruf.
  for (let from = 0; from < 20_000; from += 1000) {
    const { data, error } = await supabase.from('region_features').select('id,feature_type,geometry,properties').eq('region_id', regionId).order('id').range(from, from + 999)
    if (error || !data?.length) break
    for (const row of data) features.push({ id: String(row.id), featureType: String(row.feature_type), geometry: row.geometry, properties: row.properties } as SourceFeature)
    if (data.length < 1000) break
  }
  featureCache.set(regionId, { at: Date.now(), features })
  return features
}

export async function loadTile(supabase: Supabase, tile: TileId): Promise<SimplifiedTile> {
  const origin = tileOrigin(tile)
  const centre = mercToGeo({ x: origin.x + TILE_SIZE_MERC / 2, y: origin.y - TILE_SIZE_MERC / 2 })
  const regions = (await earthRegions(supabase)).filter(region => {
    const north = (region.lat - centre.lat) * 111_195
    const east = (region.lon - centre.lon) * 111_195 * Math.cos(centre.lat * Math.PI / 180)
    return Math.hypot(north, east) <= region.radiusKm * 1000 + 600
  })
  const features = (await Promise.all(regions.map(region => regionFeatures(supabase, region.id)))).flat()
  return buildTile(features, tile, TILE_Z)
}
