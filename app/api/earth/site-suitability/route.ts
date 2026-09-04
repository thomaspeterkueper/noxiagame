import { NextRequest, NextResponse } from 'next/server'
import { openMeteoElevationSource } from '@/lib/world/spatial/openMeteoElevationSource'
import { EARTH_SAUERLAND_REGION } from '@/lib/world/spatial/regions'
import type { GeoBounds } from '@/lib/world/spatial/earthFeatureSource'
import { elevationRange } from '@/lib/world/spatial/elevationSource'
import { analyseTerrainSuitability } from '@/lib/world/spatial/siteSuitability'

export const dynamic = 'force-dynamic'

function boundsAround(radiusKm: number): GeoBounds {
  const { lat, lon } = EARTH_SAUERLAND_REGION.origin
  const latDelta = radiusKm / 111.32
  const lonDelta = radiusKm / (111.32 * Math.cos(lat * Math.PI / 180))
  return { south: lat - latDelta, west: lon - lonDelta, north: lat + latDelta, east: lon + lonDelta }
}

export async function GET(request: NextRequest) {
  try {
    const radiusKm = Math.min(8, Math.max(1, Number(request.nextUrl.searchParams.get('radiusKm') ?? 3)))
    const grid = await openMeteoElevationSource.load(boundsAround(radiusKm), 500)
    const suitability = analyseTerrainSuitability(grid)
    return NextResponse.json({
      ok: true,
      bounds: grid.bounds,
      range: elevationRange(grid),
      source: grid.source,
      ...suitability,
      note: 'Terrain score only; no canonical spaceport site is selected by this endpoint.',
    }, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } })
  } catch (error) {
    console.error('earth site suitability', error)
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Terrain analysis unavailable' }, { status: 502 })
  }
}
