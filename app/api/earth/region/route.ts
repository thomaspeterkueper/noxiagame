import { NextRequest, NextResponse } from 'next/server'
import { CURRENT_EARTH_BOOTSTRAP_CLASSES, type ImportedEarthFeature } from '@/lib/world/spatial/earthFeatureSource'
import { OverpassEarthFeatureSource } from '@/lib/world/spatial/overpassEarthFeatureSource'
import { EARTH_SAUERLAND_REGION, getEarthRegion } from '@/lib/world/spatial/regions'
import { SELMECKE_REFERENCE_SITE } from '@/lib/world/spatial/earthReferenceSites'
import { earthLandmarksInBounds } from '@/lib/world/spatial/earthLandmarkPresentation'
import { createServiceClient } from '@/lib/supabase/service'

const source = new OverpassEarthFeatureSource()

export const revalidate = 0

const EARTH_VIEW_LAT_COOKIE = 'noxia-earth-view-lat'
const EARTH_VIEW_LON_COOKIE = 'noxia-earth-view-lon'
const EARTH_VIEW_LABEL_COOKIE = 'noxia-earth-view-label'
const EARTH_VIEW_PLACE_COOKIE = 'noxia-earth-view-place-slug'

const SELMECKE_REFERENCE_FEATURE: ImportedEarthFeature = {
  id: SELMECKE_REFERENCE_SITE.id,
  worldId: 'earth',
  featureType: 'settlement',
  geometryKind: 'point',
  properties: {
    name: SELMECKE_REFERENCE_SITE.label,
    place: 'noxia_reference_site',
    source: 'NOXIA',
  },
  geometry: {
    kind: 'point',
    coordinates: SELMECKE_REFERENCE_SITE.point,
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

function narrativeLandmarksFor(bounds: { south:number; west:number; north:number; east:number }) {
  return earthLandmarksInBounds(bounds).map(({ landmark, point }) => ({
    id: landmark.id,
    name: landmark.name,
    locality: landmark.locality,
    countryCode: landmark.countryCode,
    tags: landmark.tags,
    presentDayRole: landmark.presentDayRole,
    noxiaRole: landmark.noxiaRole,
    sourceProjects: landmark.sourceProjects,
    locator: landmark.locator,
    point,
  }))
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

  const placeSlug = hasLocalCenter
    ? (p.get('place') ?? req.cookies.get(EARTH_VIEW_PLACE_COOKIE)?.value ?? null)
    : null
  const placeLabel = (p.get('label') ?? req.cookies.get(EARTH_VIEW_LABEL_COOKIE)?.value ?? viewRegion.name).slice(0, 240)
  const storedSlug = placeSlug ?? requestedRegionId

  // Runtime rendering never depends on a live Overpass request for arbitrary
  // searched places. Once selected, a place is identified persistently and
  // served from NOXIA storage. Until enrichment finishes, the renderer gets a
  // valid real-world centre/bounds with zero features instead of a 504.
  const supabase = createServiceClient()
  const { data: storedRegion } = await supabase
    .from('celestial_regions')
    .select('id, slug, label, center_lat, center_lon, radius_km, bounds, source, imported_at')
    .eq('slug', storedSlug)
    .maybeSingle()

  if (storedRegion) {
    const { data: rows, error: featuresError } = await supabase
      .from('region_features')
      .select('id, feature_type, geometry, properties')
      .eq('region_id', storedRegion.id)

    if (!featuresError) {
      const storedBounds = (storedRegion.bounds as typeof bounds) ?? bounds
      const containsSelmecke = SELMECKE_REFERENCE_FEATURE.geometry.kind === 'point'
        && SELMECKE_REFERENCE_FEATURE.geometry.coordinates.lat >= storedBounds.south
        && SELMECKE_REFERENCE_FEATURE.geometry.coordinates.lat <= storedBounds.north
        && SELMECKE_REFERENCE_FEATURE.geometry.coordinates.lon >= storedBounds.west
        && SELMECKE_REFERENCE_FEATURE.geometry.coordinates.lon <= storedBounds.east
      const features = [
        ...(rows ?? []).map(r => ({ id: r.id, featureType: r.feature_type, properties: r.properties, geometry: r.geometry })),
        ...(containsSelmecke ? [SELMECKE_REFERENCE_FEATURE] : []),
      ]
      const materializationStatus = placeSlug
        ? (features.length > 0
            ? 'ready'
            : String(storedRegion.source ?? '').includes('failed') ? 'failed' : 'pending')
        : null
      const runtimeRegion = placeSlug
        ? {
            id: storedRegion.slug,
            name: storedRegion.label ?? placeLabel,
            origin: { lat: Number(storedRegion.center_lat), lon: Number(storedRegion.center_lon) },
            chunkSizeM: viewRegion.chunkSizeM,
            cellSizeM: viewRegion.cellSizeM,
          }
        : viewRegion

      return NextResponse.json({
        ok: true,
        region: runtimeRegion,
        viewRegion: runtimeRegion,
        queryCenter: center,
        detail: hasLocalCenter,
        bounds: storedBounds,
        featureCount: features.length,
        features,
        materialization: placeSlug ? {
          slug: placeSlug,
          label: storedRegion.label ?? placeLabel,
          lat: Number(storedRegion.center_lat),
          lon: Number(storedRegion.center_lon),
          radiusKm: Number(storedRegion.radius_km ?? radiusKm),
          status: materializationStatus,
          source: storedRegion.source,
        } : null,
        narrativeLandmarks: narrativeLandmarksFor(storedBounds),
        attribution: '© OpenStreetMap contributors · ODbL · NOXIA materialized geography',
      }, {
        headers: { 'Cache-Control': 'private, max-age=60', 'Vary': 'Cookie' },
      })
    }
  }

  if (hasLocalCenter && placeSlug) {
    return NextResponse.json({
      ok: true,
      region: {
        id: placeSlug,
        name: placeLabel,
        origin: center,
        chunkSizeM: viewRegion.chunkSizeM,
        cellSizeM: viewRegion.cellSizeM,
      },
      viewRegion: viewRegion,
      queryCenter: center,
      detail: true,
      bounds,
      featureCount: 0,
      features: [],
      materialization: {
        slug: placeSlug,
        label: placeLabel,
        lat: center.lat,
        lon: center.lon,
        radiusKm,
        status: 'missing',
        source: null,
      },
      narrativeLandmarks: narrativeLandmarksFor(bounds),
      attribution: 'NOXIA place registry · Real-world enrichment pending',
    }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0', 'Vary': 'Cookie' },
    })
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
      narrativeLandmarks: narrativeLandmarksFor(bounds),
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
