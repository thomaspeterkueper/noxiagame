import { NextRequest, NextResponse } from 'next/server'
import { CURRENT_EARTH_BOOTSTRAP_CLASSES } from '@/lib/world/spatial/earthFeatureSource'
import { OverpassEarthFeatureSource } from '@/lib/world/spatial/overpassEarthFeatureSource'
import { EARTH_SAUERLAND_REGION } from '@/lib/world/spatial/regions'

const source = new OverpassEarthFeatureSource()

export const revalidate = 300

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const requestedLat = Number(p.get('lat'))
  const requestedLon = Number(p.get('lon'))
  const hasLocalCenter = Number.isFinite(requestedLat) && Number.isFinite(requestedLon)
  const center = hasLocalCenter
    ? { lat: requestedLat, lon: requestedLon }
    : EARTH_SAUERLAND_REGION.origin
  const radiusKm = Math.min(6, Math.max(.2, Number(p.get('radiusKm') ?? (hasLocalCenter ? .6 : 3))))
  const latDelta = radiusKm / 111.32
  const lonDelta = radiusKm / (111.32 * Math.cos(center.lat * Math.PI / 180))
  const bounds = {
    south: center.lat - latDelta,
    west: center.lon - lonDelta,
    north: center.lat + latDelta,
    east: center.lon + lonDelta,
  }

  try {
    const features = await source.load({ bounds, classes: CURRENT_EARTH_BOOTSTRAP_CLASSES })
    return NextResponse.json({
      ok: true,
      region: EARTH_SAUERLAND_REGION,
      queryCenter: center,
      detail: hasLocalCenter,
      bounds,
      featureCount: features.length,
      features,
      attribution: '© OpenStreetMap contributors · ODbL',
    }, {
      headers: {
        'Cache-Control': hasLocalCenter
          ? 'public, s-maxage=120, stale-while-revalidate=300'
          : 'public, s-maxage=900, stale-while-revalidate=3600',
      },
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Earth source unavailable' }, { status: 503 })
  }
}
