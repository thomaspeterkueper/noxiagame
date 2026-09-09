import { NextRequest, NextResponse } from 'next/server'
import { CURRENT_EARTH_BOOTSTRAP_CLASSES, type ImportedEarthFeature } from '@/lib/world/spatial/earthFeatureSource'
import { OverpassEarthFeatureSource } from '@/lib/world/spatial/overpassEarthFeatureSource'
import { EARTH_SAUERLAND_REGION, getEarthRegion } from '@/lib/world/spatial/regions'

const source = new OverpassEarthFeatureSource()

export const revalidate = 300

const SELMECKE_REFERENCE_FEATURE: ImportedEarthFeature = {
  id: 'noxia:site:selmecke-reference',
  worldId: 'earth',
  featureType: 'settlement',
  geometryKind: 'point',
  properties: {
    name: 'Selmecke · NOXIA-Referenzstandort',
    place: 'noxia_reference_site',
    source: 'NOXIA',
  },
  geometry: {
    kind: 'point',
    coordinates: { lat: 51.33745, lon: 7.97975 },
  },
  source: {
    provider: 'NOXIA',
    dataset: 'canonical-reference-sites',
    sourceId: 'noxia-earth-selmecke-reference-v1',
  },
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const requestedRegionId = p.get('region')
    ?? req.cookies.get('noxia-earth-region')?.value
    ?? EARTH_SAUERLAND_REGION.id
  const viewRegion = getEarthRegion(requestedRegionId) ?? EARTH_SAUERLAND_REGION

  const rawLat = p.get('lat')
  const rawLon = p.get('lon')
  const requestedLat = rawLat === null ? Number.NaN : Number(rawLat)
  const requestedLon = rawLon === null ? Number.NaN : Number(rawLon)
  const hasLocalCenter = rawLat !== null && rawLon !== null && Number.isFinite(requestedLat) && Number.isFinite(requestedLon)
  const center = hasLocalCenter
    ? { lat: requestedLat, lon: requestedLon }
    : viewRegion.origin
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
    const imported = await source.load({ bounds, classes: CURRENT_EARTH_BOOTSTRAP_CLASSES })
    const features = !hasLocalCenter && viewRegion.id === EARTH_SAUERLAND_REGION.id
      ? [...imported, SELMECKE_REFERENCE_FEATURE]
      : imported

    return NextResponse.json({
      ok: true,
      // The selected region is only the local ENU-like projection/cache frame.
      // Persisted Earth positions are global WGS84 latitude/longitude and can
      // therefore be reprojected into any Earth view without changing identity.
      region: viewRegion,
      viewRegion,
      queryCenter: center,
      detail: hasLocalCenter,
      bounds,
      featureCount: features.length,
      features,
      attribution: '© OpenStreetMap contributors · ODbL · NOXIA canonical sites',
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
