// lib/game/hospitality/placeKnowledge.server.ts
// Lädt das Ortswissen für ein Gebäude: reale Geographie aus region_features,
// NOXIA-Gebäude in der Nähe und kanonische Landmarken. Nur lesend.

import { SELMECKE_REFERENCE_SITE } from '@/lib/world/spatial/earthReferenceSites'
import { earthLandmarksInBounds } from '@/lib/world/spatial/earthLandmarkPresentation'
import { placeKnowledgeFacts, type PlaceBuildingInput, type PlaceFeatureInput, type PlaceLandmarkInput } from './placeKnowledge'

type Geo = { lat: number; lon: number }

const FEATURE_RADIUS_M = 6000
const BUILDING_RADIUS_M = 4000
const LANDMARK_RADIUS_M = 15000

function distanceM(a: Geo, b: Geo): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad)
  return Math.hypot(dLat, dLon) * 6371000
}

function bearingDeg(from: Geo, to: Geo): number {
  const rad = Math.PI / 180
  const north = (to.lat - from.lat) * rad
  const east = (to.lon - from.lon) * rad * Math.cos(((from.lat + to.lat) / 2) * rad)
  return (Math.atan2(east, north) / rad + 360) % 360
}

function geo(value: any): Geo | null {
  const lat = Number(value?.lat), lon = Number(value?.lon)
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null
}

/** Kürzeste Entfernung zu einem Punkt der Geometrie – grob, aber ohne falsche Nähe. */
function nearestDistance(geometry: any, origin: Geo): number | null {
  if (!geometry) return null
  if (geometry.kind === 'point') {
    const point = geo(geometry.coordinates)
    return point ? distanceM(origin, point) : null
  }
  let best: number | null = null
  for (const raw of Array.isArray(geometry.coordinates) ? geometry.coordinates : []) {
    const point = geo(raw)
    if (!point) continue
    const d = distanceM(origin, point)
    if (best === null || d < best) best = d
  }
  return best
}

export interface PlaceKnowledge {
  placeLabel: string | null
  facts: string[]
}

/**
 * Ortswissen für das Gebäude `tileEntityId`. Liegt das Gebäude nicht auf einer
 * Erdposition (z. B. Station), gibt es kein Ortswissen aus Kartendaten.
 */
export async function loadPlaceKnowledge(supabase: any, tileEntityId: string): Promise<PlaceKnowledge | null> {
  const { data: tile } = await supabase
    .from('tile_entities')
    .select('id,location_id,latitude_deg,longitude_deg,spatial_region_id,status')
    .eq('id', tileEntityId)
    .maybeSingle()
  if (!tile) return null
  const origin = geo({ lat: tile.latitude_deg, lon: tile.longitude_deg })
  if (!origin || tile.latitude_deg == null || tile.longitude_deg == null) return { placeLabel: null, facts: [] }

  const pad = 0.2
  const [{ data: regions }, { data: nearTiles }] = await Promise.all([
    supabase
      .from('celestial_regions')
      .select('id,slug,label,center_lat,center_lon,radius_km')
      .eq('body', 'earth')
      .gte('center_lat', origin.lat - pad).lte('center_lat', origin.lat + pad)
      .gte('center_lon', origin.lon - pad * 2).lte('center_lon', origin.lon + pad * 2),
    supabase
      .from('tile_entities')
      .select('id,entity_id,latitude_deg,longitude_deg')
      .eq('location_id', tile.location_id)
      .eq('entity_type', 'building')
      .eq('status', 'active')
      .gte('latitude_deg', origin.lat - 0.05).lte('latitude_deg', origin.lat + 0.05)
      .gte('longitude_deg', origin.lon - 0.08).lte('longitude_deg', origin.lon + 0.08)
      .limit(400),
  ])

  // Regionen, deren Ausschnitt das Gebäude erreicht.
  const reachable = (regions ?? [])
    .map((region: any) => ({ region, d: distanceM(origin, { lat: Number(region.center_lat), lon: Number(region.center_lon) }) }))
    .filter((item: any) => Number.isFinite(item.d) && item.d <= Number(item.region.radius_km ?? 0) * 1000 + FEATURE_RADIUS_M)
    .sort((a: any, b: any) => a.d - b.d)
  // Der Ortsname kommt von der nächsten benannten Ortsregion (nicht „Lokaldetail …“).
  const placeLabel = reachable
    .map((item: any) => String(item.region.label ?? ''))
    .find((label: string) => label.includes(',')) ?? null

  const regionIds = reachable.map((item: any) => item.region.id)
  const typeIds = [...new Set((nearTiles ?? []).map((row: any) => String(row.entity_id)))]
  const [{ data: featureRows }, { data: definitions }] = await Promise.all([
    regionIds.length
      ? supabase.from('region_features').select('id,feature_type,geometry,properties').in('region_id', regionIds).not('properties->>name', 'is', null).limit(3000)
      : Promise.resolve({ data: [] as any[] }),
    typeIds.length
      ? supabase.from('building_definitions').select('key,name').in('key', typeIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const features: PlaceFeatureInput[] = (featureRows ?? []).flatMap((row: any) => {
    const d = nearestDistance(row.geometry, origin)
    const name = String(row.properties?.name ?? '').trim()
    if (d === null || d > FEATURE_RADIUS_M || !name) return []
    return [{ name, featureType: String(row.feature_type), placeKind: row.properties?.place ?? null, distanceM: d }]
  })

  // Kanonische NOXIA-Referenzstandorte stehen nicht in den Kartendaten.
  const referenceDistance = distanceM(origin, { lat: SELMECKE_REFERENCE_SITE.point.lat, lon: SELMECKE_REFERENCE_SITE.point.lon })
  if (referenceDistance <= FEATURE_RADIUS_M) {
    features.push({ name: SELMECKE_REFERENCE_SITE.label, featureType: 'settlement', placeKind: 'noxia_reference_site', distanceM: referenceDistance })
  }

  const nameByType = new Map<string, string>((definitions ?? []).map((row: any) => [String(row.key), String(row.name)]))
  const buildings: PlaceBuildingInput[] = (nearTiles ?? []).flatMap((row: any) => {
    if (row.id === tile.id) return []
    const point = geo({ lat: row.latitude_deg, lon: row.longitude_deg })
    const name = nameByType.get(String(row.entity_id))
    if (!point || !name) return []
    const d = distanceM(origin, point)
    if (d > BUILDING_RADIUS_M) return []
    return [{ typeId: String(row.entity_id), name, distanceM: d, bearingDeg: bearingDeg(origin, point) }]
  })

  const landmarks: PlaceLandmarkInput[] = earthLandmarksInBounds({
    south: origin.lat - 0.15, north: origin.lat + 0.15, west: origin.lon - 0.25, east: origin.lon + 0.25,
  }).flatMap(({ landmark, point }) => {
    const d = distanceM(origin, point)
    return d <= LANDMARK_RADIUS_M ? [{ name: landmark.name, locality: landmark.locality, noxiaRole: landmark.noxiaRole, distanceM: d }] : []
  })

  return { placeLabel, facts: placeKnowledgeFacts({ placeLabel, features, buildings, landmarks }) }
}
