import { NextRequest, NextResponse } from 'next/server'
import { CURRENT_EARTH_BOOTSTRAP_CLASSES } from '@/lib/world/spatial/earthFeatureSource'
import { OverpassEarthFeatureSource } from '@/lib/world/spatial/overpassEarthFeatureSource'
import { EARTH_SAUERLAND_REGION } from '@/lib/world/spatial/regions'

const source = new OverpassEarthFeatureSource()

export const revalidate = 3600

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const radiusKm = Math.min(6, Math.max(1, Number(p.get('radiusKm') ?? 3)))
  const latDelta = radiusKm / 111.32
  const lonDelta = radiusKm / (111.32 * Math.cos(EARTH_SAUERLAND_REGION.origin.lat * Math.PI / 180))
  const bounds = {
    south: EARTH_SAUERLAND_REGION.origin.lat - latDelta,
    west: EARTH_SAUERLAND_REGION.origin.lon - lonDelta,
    north: EARTH_SAUERLAND_REGION.origin.lat + latDelta,
    east: EARTH_SAUERLAND_REGION.origin.lon + lonDelta,
  }

  try {
    const features = await source.load({ bounds, classes: CURRENT_EARTH_BOOTSTRAP_CLASSES })
    return NextResponse.json({
      ok: true,
      region: EARTH_SAUERLAND_REGION,
      bounds,
      featureCount: features.length,
      features,
      attribution: '© OpenStreetMap contributors · ODbL',
    }, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Earth source unavailable' }, { status: 503 })
  }
}
