// lib/world/spatial/earthPlaceMaterializer.server.ts
// Aktualisiert: 12.10.2026 — Importprofil v3: Kirchen und andere Gotteshäuser als Landmarks; Importprofil v2: Meer aus Küstenlinien, Strand und Fels; ältere Ortsimporte werden beim nächsten Aufruf einmalig erneuert
// Version:      1.2.0

import { createServiceClient } from '@/lib/supabase/service'
import { seaPolygonsFromCoastlines } from './earthCoastline'

type GeoPoint = { lat: number; lon: number }
type Bounds = { south: number; west: number; north: number; east: number }
type Tags = Record<string, string>
type OverpassElement = {
  type?: 'node' | 'way' | 'relation'
  id?: number
  lat?: number
  lon?: number
  center?: GeoPoint
  tags?: Tags
  geometry?: GeoPoint[]
  members?: Array<{ geometry?: GeoPoint[] }>
}
type PreparedFeature = {
  feature_type: string
  geometry: { kind: 'point' | 'line' | 'polygon'; coordinates: GeoPoint | GeoPoint[] }
  properties: Record<string, unknown>
}

const OVERPASS_ENDPOINTS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
]
/** Weitere Spiegel nur im geduldigen Modus (stündlicher Lauf, 27.10.2026). */
const PATIENT_EXTRA_ENDPOINTS = ['https://maps.mail.ru/osm/tools/overpass/api/interpreter']
/** Geduldiger Modus: Wartezeit je Server und Rechenzeit, um die der Server gebeten wird. */
const PATIENT_TIMEOUT_MS = 50_000
const PATIENT_SERVER_TIMEOUT_S = 45
const MAX_POINTS_PER_FEATURE = 36
// 4: Sportflächen (leisure=pitch|stadium|track|sports_centre, ohne Golf) als 'sport'
// 5: Orte des Alltags als 'place_area' (Spielplatz, Garten, Freibad, Friedhof,
//    Kleingärten, Rasen, Festplatz, Parkplatz); visual_class nennt die Art
// 6: Einzelbäume (natural=tree, Punkt) und Alleen (natural=tree_row, Linie)
export const EARTH_GEOGRAPHY_IMPORT_VERSION = 6
export const EARTH_NORMALIZATION_VERSION = 1
export const EARTH_ENRICHMENT_VERSION = 1
const EARTH_IMPORT_PROFILE = 'earth-osm-generalized-v3'
const OVERPASS_TIMEOUT_MS = 25_000

export function earthPlaceBounds(lat: number, lon: number, radiusKm: number): Bounds {
  const latDelta = radiusKm / 111.32
  const cosLat = Math.max(.05, Math.abs(Math.cos(lat * Math.PI / 180)))
  const lonDelta = radiusKm / (111.32 * cosLat)
  return { south: lat - latDelta, west: lon - lonDelta, north: lat + latDelta, east: lon + lonDelta }
}

function perpendicularDistance(point: GeoPoint, a: GeoPoint, b: GeoPoint) {
  const dx = b.lon - a.lon
  const dy = b.lat - a.lat
  const length = Math.hypot(dx, dy) || 1e-9
  return Math.abs((point.lon - a.lon) * dy - (point.lat - a.lat) * dx) / length
}

function simplify(points: GeoPoint[], tolerance = .00012): GeoPoint[] {
  if (points.length <= 2) return points
  let maxDistance = 0
  let index = 0
  const a = points[0]
  const b = points[points.length - 1]
  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], a, b)
    if (distance > maxDistance) { maxDistance = distance; index = i }
  }
  if (maxDistance <= tolerance) return [a, b]
  const left = simplify(points.slice(0, index + 1), tolerance)
  const right = simplify(points.slice(index), tolerance)
  return [...left.slice(0, -1), ...right]
}

function capPoints(points: GeoPoint[], polygon: boolean) {
  const source = polygon ? points.slice(0, -1) : points
  const simplified = simplify(source)
  const max = polygon ? MAX_POINTS_PER_FEATURE - 1 : MAX_POINTS_PER_FEATURE
  let capped = simplified
  if (simplified.length > max) {
    const step = simplified.length / max
    capped = Array.from({ length: max }, (_, index) => simplified[Math.floor(index * step)])
  }
  return polygon && capped.length >= 3 ? [...capped, capped[0]] : capped
}

function classify(tags: Tags, isNode = false) {
  if (isNode && /^(city|town|village|hamlet|suburb)$/.test(tags.place ?? '')) return 'settlement'
  if (isNode && tags.natural === 'tree') return 'tree'
  if (tags.natural === 'tree_row') return 'tree_row'
  if (tags.name && (
    /^(museum|attraction|viewpoint|gallery)$/.test(tags.tourism ?? '')
    || /^(castle|monument|memorial|archaeological_site|ruins|fort|city_gate)$/.test(tags.historic ?? '')
    || /^(university|townhall|theatre|arts_centre|library|hospital|place_of_worship)$/.test(tags.amenity ?? '')
    || /^(station)$/.test(tags.railway ?? '')
    || /^(tower|lighthouse|observatory)$/.test(tags.man_made ?? '')
  )) return 'landmark'
  if (tags.highway && /^(motorway|trunk|primary|secondary|tertiary)$/.test(tags.highway)) return 'road'
  if (tags.railway && /^(rail|light_rail|tram)$/.test(tags.railway)) return 'rail'
  if (tags.waterway && /^(river|canal)$/.test(tags.waterway)) return 'waterway'
  if (tags.natural === 'water' || tags.water) return 'water'
  if (/^(beach|sand|shoal)$/.test(tags.natural ?? '')) return 'beach'
  if (/^(bare_rock|scree|shingle|rock)$/.test(tags.natural ?? '')) return 'rock'
  if (/^(pitch|stadium|track|sports_centre)$/.test(tags.leisure ?? '') && tags.sport !== 'golf') return 'sport'
  if (placeAreaClass(tags)) return 'place_area'
  if (tags.landuse === 'forest' || tags.natural === 'wood' || tags.landcover === 'trees') return 'forest'
  if (/^(scrub|grassland|heath|wetland)$/.test(tags.natural ?? '') || tags.landcover === 'grass' || /^(park|nature_reserve)$/.test(tags.leisure ?? '')) return 'vegetation'
  if (/^(farmland|farmyard|meadow|orchard|grass)$/.test(tags.landuse ?? '')) return 'farmland'
  if (/^(residential|commercial|retail)$/.test(tags.landuse ?? '')) return 'urban'
  if (tags.landuse === 'industrial') return 'industrial'
  return null
}

/** Orte des Alltags, die man auf der Karte wiedererkennt. */
function placeAreaClass(tags: Tags): string | null {
  if (/^(playground|garden|swimming_pool|water_park|dog_park)$/.test(tags.leisure ?? '')) return tags.leisure === 'water_park' ? 'swimming_pool' : tags.leisure!
  if (/^(cemetery|allotments|grass|recreation_ground|village_green)$/.test(tags.landuse ?? '')) return tags.landuse!
  if (tags.amenity === 'grave_yard') return 'cemetery'
  if (tags.amenity === 'parking' && tags.parking !== 'underground' && tags.parking !== 'multi-storey') return 'parking'
  return null
}

function visualClass(featureType: string, tags: Tags) {
  if (featureType === 'forest') return tags.natural === 'wood' ? 'wood' : 'forest'
  if (featureType === 'farmland') return tags.landuse ?? 'farmland'
  if (featureType === 'vegetation') return tags.natural ?? tags.landcover ?? tags.leisure ?? 'vegetation'
  if (featureType === 'urban') return tags.landuse ?? 'urban'
  if (featureType === 'sport') return tags.leisure ?? 'pitch'
  if (featureType === 'place_area') return placeAreaClass(tags) ?? 'place_area'
  if (featureType === 'beach' || featureType === 'rock') return tags.natural ?? featureType
  if (featureType === 'landmark') return tags.tourism ?? tags.historic ?? tags.amenity ?? tags.railway ?? tags.man_made ?? 'landmark'
  return featureType
}

function geometryFeature(featureType: string, raw: GeoPoint[], tags: Tags, sourceId: string): PreparedFeature | null {
  const points = raw.filter(point => Number.isFinite(point?.lat) && Number.isFinite(point?.lon))
  if (points.length < 2) return null
  const polygon = points.length > 3
    && Math.abs(points[0].lat - points[points.length - 1].lat) < 1e-8
    && Math.abs(points[0].lon - points[points.length - 1].lon) < 1e-8
  const coordinates = capPoints(points, polygon)
  if (coordinates.length < (polygon ? 4 : 2)) return null
  return {
    feature_type: featureType,
    geometry: { kind: polygon ? 'polygon' : 'line', coordinates },
    properties: {
      ...tags,
      noxia_source: 'OpenStreetMap',
      noxia_source_id: sourceId,
      noxia_provenance: 'observed',
      visual_seed: sourceId,
      visual_class: visualClass(featureType, tags),
    },
  }
}

function pointInRing(point: GeoPoint, ring: GeoPoint[]) {
  let hit = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j]
    if ((a.lat > point.lat) !== (b.lat > point.lat) && point.lon < (b.lon - a.lon) * (point.lat - a.lat) / (b.lat - a.lat) + a.lon) hit = !hit
  }
  return hit
}

function derivedCoastFeature(featureType: string, ring: GeoPoint[], sourceId: string, visual: string): PreparedFeature | null {
  // No point cap here: the shoreline is the most visible edge of a coastal map.
  const simplified = simplify(ring.slice(0, -1), .00004)
  if (simplified.length < 3) return null
  return {
    feature_type: featureType,
    geometry: { kind: 'polygon', coordinates: [...simplified, simplified[0]] },
    properties: {
      ...(featureType === 'water' ? { natural: 'water', water: 'sea' } : { place: 'island' }),
      noxia_source: 'OpenStreetMap',
      noxia_source_id: sourceId,
      noxia_provenance: 'derived',
      noxia_derivation: 'natural=coastline',
      visual_seed: sourceId,
      visual_class: visual,
    },
  }
}

function toFeatures(elements: OverpassElement[], bounds: Bounds) {
  const output: PreparedFeature[] = []
  const coastlines: GeoPoint[][] = []
  for (const element of elements) {
    const tags = element.tags ?? {}
    if (element.type === 'way' && tags.natural === 'coastline') {
      const points = (element.geometry ?? []).filter(point => Number.isFinite(point?.lat) && Number.isFinite(point?.lon))
      if (points.length >= 2) coastlines.push(points)
      continue
    }
    const featureType = classify(tags, element.type === 'node')
    if (!featureType || element.id == null) continue
    const sourceId = `osm:${element.type}:${element.id}`
    if (element.type === 'node') {
      if (!Number.isFinite(element.lat) || !Number.isFinite(element.lon)) continue
      output.push({
        feature_type: featureType,
        geometry: { kind: 'point', coordinates: { lat: element.lat!, lon: element.lon! } },
        properties: {
          ...tags,
          noxia_source: 'OpenStreetMap',
          noxia_source_id: sourceId,
          noxia_provenance: 'observed',
          visual_seed: sourceId,
          visual_class: visualClass(featureType, tags),
        },
      })
      continue
    }
    if (featureType === 'landmark') {
      const raw = element.geometry ?? element.members?.flatMap(member => member.geometry ?? []) ?? []
      const point = element.center ?? (raw.length
        ? { lat: raw.reduce((sum, item) => sum + item.lat, 0) / raw.length, lon: raw.reduce((sum, item) => sum + item.lon, 0) / raw.length }
        : null)
      if (point && Number.isFinite(point.lat) && Number.isFinite(point.lon)) {
        output.push({
          feature_type: 'landmark',
          geometry: { kind: 'point', coordinates: point },
          properties: {
            ...tags,
            noxia_source: 'OpenStreetMap',
            noxia_source_id: sourceId,
            noxia_provenance: 'observed',
            visual_seed: sourceId,
            visual_class: visualClass('landmark', tags),
          },
        })
      }
      continue
    }
    if (element.type === 'relation') {
      for (const [index, member] of (element.members ?? []).entries()) {
        const feature = geometryFeature(featureType, member.geometry ?? [], tags, `${sourceId}:member:${index}`)
        if (feature) output.push(feature)
      }
      continue
    }
    const feature = geometryFeature(featureType, element.geometry ?? [], tags, sourceId)
    if (feature) output.push(feature)
  }
  // OSM has no sea polygon; the sea is whatever lies on the water side of the
  // coastline. Derive it once at import so every view shows the same shore.
  if (coastlines.length) {
    const { sea, islands } = seaPolygonsFromCoastlines(coastlines, bounds)
    // Plausibility: a settlement can never lie in the sea. If one does, the
    // coastline data was incomplete for this view – show no sea rather than
    // flooding the land.
    const settlements = output.flatMap(feature => feature.feature_type === 'settlement' && feature.geometry.kind === 'point' ? [feature.geometry.coordinates as GeoPoint] : [])
    const plausibleSea = sea.filter(ring => !settlements.some(point => pointInRing(point, ring)))
    plausibleSea.forEach((ring, index) => {
      const feature = derivedCoastFeature('water', ring, `noxia:sea:${index}`, 'sea')
      if (feature) output.push(feature)
    })
    islands.forEach((ring, index) => {
      const feature = derivedCoastFeature('island', ring, `noxia:island:${index}`, 'island')
      if (feature) output.push(feature)
    })
  }
  return output
}

function queryFor(bounds: Bounds) {
  const box = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`
  // Deliberately no blanket [building] query. A materialized NOXIA city keeps
  // the real morphology while avoiding tens of thousands of irrelevant houses.
  return `[out:json][timeout:25];(
way[natural=coastline](${box});
way[natural~"beach|sand|shoal|bare_rock|scree|shingle|rock"](${box});relation[natural~"beach|sand|shoal|bare_rock|scree|shingle|rock"](${box});
way[natural=water](${box});way[water](${box});relation[natural=water](${box});
way[waterway~"river|canal"](${box});
way[landuse=forest](${box});way[natural=wood](${box});relation[landuse=forest](${box});relation[natural=wood](${box});
way[landcover=trees](${box});relation[landcover=trees](${box});
way[natural~"scrub|grassland|heath|wetland"](${box});relation[natural~"scrub|grassland|heath|wetland"](${box});
way[landcover=grass](${box});relation[landcover=grass](${box});
way[leisure~"park|nature_reserve"](${box});relation[leisure~"park|nature_reserve"](${box});
way[leisure~"pitch|stadium|track|sports_centre"](${box});relation[leisure~"pitch|stadium|track|sports_centre"](${box});
way[leisure~"playground|garden|swimming_pool|water_park|dog_park"](${box});
way[landuse~"cemetery|allotments|grass|recreation_ground|village_green"](${box});relation[landuse~"cemetery|allotments|recreation_ground"](${box});
way[amenity~"grave_yard|parking"](${box});
node[natural=tree](${box});way[natural=tree_row](${box});
way[landuse~"farmland|farmyard|meadow|orchard|grass"](${box});
way[landuse~"residential|commercial|retail"](${box});relation[landuse~"residential|commercial|retail"](${box});
way[landuse=industrial](${box});relation[landuse=industrial](${box});
way[highway~"motorway|trunk|primary|secondary|tertiary"](${box});
way[railway~"rail|light_rail|tram"](${box});
node[place~"city|town|village|hamlet|suburb"](${box});
nwr[name][tourism~"museum|attraction|viewpoint|gallery"](${box});
nwr[name][historic~"castle|monument|memorial|archaeological_site|ruins|fort|city_gate"](${box});
nwr[name][amenity~"university|townhall|theatre|arts_centre|library|hospital|place_of_worship"](${box});
nwr[name][railway=station](${box});
nwr[name][man_made~"tower|lighthouse|observatory"](${box});
);out center geom;`
}

// Reduced regional profile for large or overloaded Overpass requests.
// Preserve observable settlement, roads, waterways and forest outlines rather
// than silently presenting an empty map as a successfully imported location.
function compactQueryFor(bounds: Bounds) {
  const box = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`
  return `[out:json][timeout:18];(
node[place~"city|town|village|hamlet"](${box});
way[highway~"primary|secondary|tertiary|residential"](${box});
way[waterway~"river|stream"](${box});
way[natural=wood](${box});way[landuse=forest](${box});
way[landuse=residential](${box});
);out center geom;`
}

/**
 * Geduldig (nur ohne wartenden Spieler, z. B. stündlicher Lauf): alle Spiegel
 * gleichzeitig, bis 50 s Wartezeit, 45 s Rechenzeit auf dem Server. Bei
 * überlasteten Servern (27.10.2026: alle Abrufe scheiterten nach 9 s) kommt so
 * noch eine Antwort; je Profil gewinnt die erste brauchbare.
 */
async function loadNormalizedFeaturesPatiently(bounds: Bounds) {
  const failures: string[] = []
  const endpoints = [...OVERPASS_ENDPOINTS, ...PATIENT_EXTRA_ENDPOINTS]
  const longer = (query: string) => query.replace(/\[timeout:\d+\]/, `[timeout:${PATIENT_SERVER_TIMEOUT_S}]`)
  for (const profile of [{ name: 'compact-v2', query: longer(compactQueryFor(bounds)) }, { name: EARTH_IMPORT_PROFILE, query: longer(queryFor(bounds)) }]) {
    const controllers = endpoints.map(() => new AbortController())
    try {
      return await Promise.any(endpoints.map(async (endpoint, index) => {
        const host = new URL(endpoint).host
        const timer = setTimeout(() => controllers[index].abort(), PATIENT_TIMEOUT_MS)
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'NOXIA/0.1 earth-place-materializer' },
            body: new URLSearchParams({ data: profile.query }), signal: controllers[index].signal, cache: 'no-store',
          })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const payload = await response.json() as { elements?: OverpassElement[]; remark?: string }
          const features = toFeatures(payload.elements ?? [], bounds)
          if (!features.length) throw new Error(payload.remark ?? 'empty result')
          return { features, source: `overpass:${host}:${profile.name}` }
        } catch (error) {
          failures.push(`${profile.name} ${host}: ${error instanceof Error ? error.message : String(error)}`)
          throw error
        } finally { clearTimeout(timer) }
      }))
    } catch { /* nächstes Profil */ } finally { for (const controller of controllers) controller.abort() }
  }
  throw new Error(`Kartennormalisierung fehlgeschlagen: ${failures.join('; ')}`)
}

async function loadNormalizedFeatures(bounds: Bounds) {
  const failures: string[] = []
  // The synchronous API must stay below the gateway timeout. A compact OSM
  // snapshot is preferable to a 504 and an empty, unusable place.
  const profiles = [
    { name: 'compact-v2', query: compactQueryFor(bounds) },
    { name: EARTH_IMPORT_PROFILE, query: queryFor(bounds) },
  ]
  for (const profile of profiles) {
    for (const endpoint of OVERPASS_ENDPOINTS.slice(0, 2)) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 9_000)
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'user-agent': 'NOXIA/0.1 earth-place-materializer',
          },
          body: new URLSearchParams({ data: profile.query }),
          signal: controller.signal,
          cache: 'no-store',
        })
        if (!response.ok) {
          failures.push(`${profile.name} ${new URL(endpoint).host}: HTTP ${response.status}`)
          continue
        }
        const payload = await response.json() as { elements?: OverpassElement[] }
        const features = toFeatures(payload.elements ?? [], bounds)
        if (features.length) {
          return { features, source: `overpass:${new URL(endpoint).host}:${profile.name}` }
        }
        failures.push(`${profile.name} ${new URL(endpoint).host}: empty result`)
      } catch (error) {
        failures.push(`${profile.name} ${new URL(endpoint).host}: ${error instanceof Error ? error.message : String(error)}`)
      } finally {
        clearTimeout(timer)
      }
    }
  }
  throw new Error(`Kartennormalisierung fehlgeschlagen: ${failures.join('; ')}`)
}

export async function materializeEarthPlace(input: {
  slug: string
  label: string
  lat: number
  lon: number
  radiusKm?: number
  refreshGeography?: boolean
  /** Ohne wartenden Spieler (stündlicher Lauf): länger warten, alle Spiegel. */
  patient?: boolean
}) {
  const requestedRadiusKm = Math.min(2.5, Math.max(2.2, input.radiusKm ?? 2.2))
  const supabase = createServiceClient()

  const { data: existing, error: existingError } = await supabase
    .from('celestial_regions')
    .select('id, slug, source, imported_at, radius_km, bounds, geography_import_version, normalization_version, enrichment_version')
    .eq('slug', input.slug)
    .maybeSingle()
  if (existingError) throw existingError

  let existingFeatureIds: string[] = []
  if (existing) {
    const { data: featureRows, error: featureError } = await supabase
      .from('region_features')
      .select('id, feature_type, enrichment:properties->>noxia_enrichment')
      .eq('region_id', existing.id)
    if (featureError) throw featureError
    // Only regional geography counts as the persisted snapshot. Local detail
    // rows (footprints, paths) belong to the walkable scene and neither prove
    // that the place was materialized nor get replaced by a geography import.
    // Resolved arrival nodes are world state of their own and survive a refresh.
    existingFeatureIds = ((featureRows ?? []) as Array<{ id: string; feature_type: string; enrichment: string | null }>)
      .filter(row => !row.enrichment && row.feature_type !== 'arrival_node')
      .map(row => String(row.id))

    // Create once, persist, enrich incrementally. Existing geography is
    // authoritative until a geography refresh succeeds. A snapshot written by
    // an older import profile is refreshed; if that fails it simply stays.
    if (existingFeatureIds.length > 0 && Number(existing.geography_import_version ?? 0) < EARTH_GEOGRAPHY_IMPORT_VERSION) {
      input = { ...input, refreshGeography: true }
    }
    if (existingFeatureIds.length > 0 && !input.refreshGeography) {
      const versionPatch: Record<string, unknown> = {}
      if (Number(existing.geography_import_version ?? 0) < EARTH_GEOGRAPHY_IMPORT_VERSION) {
        versionPatch.geography_import_version = EARTH_GEOGRAPHY_IMPORT_VERSION
      }
      if (Number(existing.normalization_version ?? 0) < EARTH_NORMALIZATION_VERSION) {
        versionPatch.normalization_version = EARTH_NORMALIZATION_VERSION
      }
      if (Number(existing.enrichment_version ?? 0) < EARTH_ENRICHMENT_VERSION) {
        versionPatch.enrichment_version = EARTH_ENRICHMENT_VERSION
      }
      if (String(existing.source ?? '') === 'noxia:materialization-failed') {
        versionPatch.source = 'overpass:retained-snapshot'
      }
      if (Object.keys(versionPatch).length > 0) {
        const { error } = await supabase.from('celestial_regions').update(versionPatch).eq('id', existing.id)
        if (error) throw error
      }
      return {
        ok: true,
        status: 'ready' as const,
        slug: input.slug,
        regionId: existing.id,
        total: existingFeatureIds.length,
        source: versionPatch.source ?? existing.source,
        persistedSnapshot: true,
      }
    }
  }

  const targetRadiusKm = input.refreshGeography && existing
    ? Math.max(Number(existing.radius_km ?? 0), requestedRadiusKm)
    : requestedRadiusKm
  const targetBounds = earthPlaceBounds(input.lat, input.lon, targetRadiusKm)
  let regionId = existing?.id as string | undefined

  if (!regionId) {
    const { data: region, error: regionError } = await supabase
      .from('celestial_regions')
      .upsert({
        body: 'earth',
        slug: input.slug,
        label: input.label,
        center_lat: input.lat,
        center_lon: input.lon,
        radius_km: targetRadiusKm,
        bounds: targetBounds,
        source: 'noxia:materializing',
        imported_at: null,
        source_checked_at: new Date().toISOString(),
        geography_import_version: 0,
        normalization_version: 0,
        enrichment_version: EARTH_ENRICHMENT_VERSION,
      }, { onConflict: 'slug' })
      .select('id')
      .single()
    if (regionError || !region) throw regionError ?? new Error('NOXIA-Ort konnte nicht angelegt werden')
    regionId = region.id
  }

  const checkedAt = new Date().toISOString()
  try {
    const loaded = input.patient ? await loadNormalizedFeaturesPatiently(targetBounds) : await loadNormalizedFeatures(targetBounds)
    if (!loaded.features.length) throw new Error('Keine verwertbaren Realwelt-Features gefunden')
    const rows = loaded.features.map(feature => ({ ...feature, region_id: regionId }))
    const insertedIds: string[] = []

    try {
      for (let index = 0; index < rows.length; index += 400) {
        const { data: inserted, error } = await supabase
          .from('region_features')
          .insert(rows.slice(index, index + 400))
          .select('id')
        if (error) throw error
        insertedIds.push(...(inserted ?? []).map(row => String(row.id)))
      }
    } catch (insertError) {
      for (let index = 0; index < insertedIds.length; index += 400) {
        await supabase.from('region_features').delete().in('id', insertedIds.slice(index, index + 400))
      }
      throw insertError
    }

    // Replace the previous snapshot only after the new one was fully written.
    for (let index = 0; index < existingFeatureIds.length; index += 400) {
      const { error } = await supabase.from('region_features').delete().in('id', existingFeatureIds.slice(index, index + 400))
      if (error) throw error
    }

    const { error: updateError } = await supabase
      .from('celestial_regions')
      .update({
        label: input.label,
        center_lat: input.lat,
        center_lon: input.lon,
        source: loaded.source,
        imported_at: checkedAt,
        source_checked_at: checkedAt,
        bounds: targetBounds,
        radius_km: targetRadiusKm,
        geography_import_version: EARTH_GEOGRAPHY_IMPORT_VERSION,
        normalization_version: EARTH_NORMALIZATION_VERSION,
        enrichment_version: EARTH_ENRICHMENT_VERSION,
      })
      .eq('id', regionId)
    if (updateError) throw updateError

    return {
      ok: true,
      status: 'ready' as const,
      slug: input.slug,
      regionId,
      total: rows.length,
      source: loaded.source,
      persistedSnapshot: true,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (existingFeatureIds.length > 0 && existing) {
      await supabase
        .from('celestial_regions')
        .update({ source_checked_at: checkedAt })
        .eq('id', existing.id)
      return {
        ok: true,
        status: 'ready' as const,
        slug: input.slug,
        regionId: existing.id,
        total: existingFeatureIds.length,
        source: existing.source,
        persistedSnapshot: true,
        refreshFailed: true,
        refreshError: message,
      }
    }

    await supabase
      .from('celestial_regions')
      .update({
        source: 'noxia:materialization-failed',
        source_checked_at: checkedAt,
      })
      .eq('id', regionId)

    return {
      ok: false,
      status: 'failed' as const,
      slug: input.slug,
      regionId,
      error: message,
    }
  }
}
