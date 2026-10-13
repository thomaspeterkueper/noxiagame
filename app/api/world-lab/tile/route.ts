// app/api/world-lab/tile/route.ts
// Prototyp „eine Welt“: liefert eine stark vereinfachte Kartenkachel.
// GET ?x=…&y=… (Kachelraster Stufe 17). Nur lesend, keine Spielwirkung.
//
// Die Antwort darf lange zwischengespeichert werden: Dieselbe Kachel sieht für
// alle gleich aus. Später werden die Kacheln einmal erzeugt und als Dateien
// abgelegt; dieser Abruf ist der Zwischenschritt dahin.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { mercToGeo, tileOrigin, TILE_SIZE_MERC, TILE_Z } from '@/lib/worldlab/mercator'
import { buildTile, type SourceFeature } from '@/lib/worldlab/simplify'

export const revalidate = 0

type Region = { id: string; lat: number; lon: number; radiusKm: number }
const REGION_TTL_MS = 10 * 60_000
let regionCache: { at: number; regions: Region[] } | null = null
const featureCache = new Map<string, { at: number; features: SourceFeature[] }>()

async function earthRegions(supabase: any): Promise<Region[]> {
  if (regionCache && Date.now() - regionCache.at < REGION_TTL_MS) return regionCache.regions
  const { data } = await supabase.from('celestial_regions').select('id,center_lat,center_lon,radius_km').eq('body', 'earth')
  const regions = (data ?? []).map((row: any) => ({ id: String(row.id), lat: Number(row.center_lat), lon: Number(row.center_lon), radiusKm: Number(row.radius_km ?? 0) }))
    .filter((region: Region) => Number.isFinite(region.lat) && Number.isFinite(region.lon))
  regionCache = { at: Date.now(), regions }
  return regions
}

async function regionFeatures(supabase: any, regionId: string): Promise<SourceFeature[]> {
  const cached = featureCache.get(regionId)
  if (cached && Date.now() - cached.at < REGION_TTL_MS) return cached.features
  const features: SourceFeature[] = []
  // Der Datenbankzugang liefert höchstens 1000 Zeilen je Abruf.
  for (let from = 0; from < 20_000; from += 1000) {
    const { data, error } = await supabase.from('region_features').select('id,feature_type,geometry,properties').eq('region_id', regionId).order('id').range(from, from + 999)
    if (error || !data?.length) break
    for (const row of data) features.push({ id: String(row.id), featureType: String(row.feature_type), geometry: row.geometry, properties: row.properties })
    if (data.length < 1000) break
  }
  featureCache.set(regionId, { at: Date.now(), features })
  return features
}

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams
  const x = Number(params.get('x')), y = Number(params.get('y'))
  const max = 2 ** TILE_Z
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= max || y >= max) {
    return NextResponse.json({ error: 'x und y müssen ganze Kachelnummern sein.' }, { status: 400 })
  }
  const origin = tileOrigin({ x, y })
  const centre = mercToGeo({ x: origin.x + TILE_SIZE_MERC / 2, y: origin.y - TILE_SIZE_MERC / 2 })

  const supabase = createServiceClient()
  const regions = (await earthRegions(supabase)).filter(region => {
    const north = (region.lat - centre.lat) * 111_195
    const east = (region.lon - centre.lon) * 111_195 * Math.cos(centre.lat * Math.PI / 180)
    return Math.hypot(north, east) <= region.radiusKm * 1000 + 600
  })
  const features = (await Promise.all(regions.map(region => regionFeatures(supabase, region.id)))).flat()
  return NextResponse.json(buildTile(features, { x, y }, TILE_Z), {
    headers: { 'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800' },
  })
}
