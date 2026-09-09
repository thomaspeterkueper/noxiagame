import { NextRequest, NextResponse } from 'next/server'
import { CURRENT_EARTH_BOOTSTRAP_CLASSES, type ImportedEarthFeature } from '@/lib/world/spatial/earthFeatureSource'
import { OverpassEarthFeatureSource } from '@/lib/world/spatial/overpassEarthFeatureSource'
import { EARTH_SAUERLAND_REGION, getEarthRegion } from '@/lib/world/spatial/regions'

const source = new OverpassEarthFeatureSource()

export const revalidate = 0

const EARTH_VIEW_LAT_COOKIE = 'noxia-earth-view-lat'
const EARTH_VIEW_LON_COOKIE = 'noxia-earth-view-lon'

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

function finiteCoordinate(raw: string | null, min: number, max: number) {
  if (raw == null || raw.trim() === '') return null
  const value = Number(raw)
  return Number.isFinite(value) && value >= min && value <= max ? value : null
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const requestedRegionId = p.get('region')
    ?? req.cookies.get('noxia-earth-region')?.value
    ?? EARTH_SAUERLAND_REGION.id
  const viewRegion = getEarthRegion(requestedRegionId) ?? EARTH_SAUERLAND_REGION

  const queryLat = finiteCoordinate(p.get('lat'), -90, 90)
  const queryLon = finiteCoordinate(p.get('lon'), -180, 180)
  const cookieLat = finiteCoordinate(req.cookies.get(EARTH_VIEW_LAT_COOKIE)?.value ?? null, -90, 90)
  const cookieLon = finiteCoordinate(req.cookies.get(EARTH_VIEW_LON_COOKIE)?.value ?? null, -180, 180)
  const localLat = queryLat ?? cookieLat
  const localLon = queryLon ?? cookieLon
  const hasLocalCenter = localLat != null && localLon != null
  const center = hasLocalCenter
    ? { lat: localLat, lon: localLon }
    : viewRegion.origin
  const radiusKm = Math.min(6, Math.max(.2, Number(p.get('radiusKm') ?? (hasLocalCenter ? .6 : 3))))
  const latDelta = radiusKm / 111.32
  const cosLat = Math.max(.05, Math.abs(Math.cos(center.lat * Math.PI / 180)))
  const lonDelta = radiusKm / (111.32 * cosLat)
  const bounds = {
    south: center.lat - latDelta,
    west: center.lon - lonDelta,
    north: center.lat + latDelta,
    east: center.lon + lonDelta,
  }

  try {
    const imported = await source.load({ bounds, classes: CURRENT_EARTH_BOOTSTRAP_CLASSES })
    const containsSelmecke = SELMECKE_REFERENCE_FEATURE.geometry.kind === 'point'
      && SELMECKE_REFERENCE_FEATURE.geometry.coordinates.lat >= bounds.south
      && SELMECKE_REFERENCE_FEATURE.geometry.coordinates.lat <= bounds.north
      && SELMECKE_REFERENCE_FEATURE.geometry.coordinates.lon >= bounds.west
      && SELMECKE_REFERENCE_FEATURE.geometry.coordinates.lon <= bounds.east
    const features = containsSelmecke
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
      // This response is selected by cookies as well as query parameters. Do not
      // edge-cache one user's Sauerland view and then replay it for Namibia.
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
        'Vary': 'Cookie',
      },
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Earth source unavailable' }, {
      status: 503,
      headers: { 'Cache-Control': 'private, no-store, max-age=0', 'Vary': 'Cookie' },
    })
  }
}
