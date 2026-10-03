import { createServiceClient } from '@/lib/supabase/service'

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
const MAX_POINTS_PER_FEATURE = 36
export const EARTH_PLACE_MATERIALIZER_VERSION = 'noxia-place-v3-landscape'

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
  if (tags.name && (
    /^(museum|attraction|viewpoint|gallery)$/.test(tags.tourism ?? '')
    || /^(castle|monument|memorial|archaeological_site|ruins|fort|city_gate)$/.test(tags.historic ?? '')
    || /^(university|townhall|theatre|arts_centre|library|hospital)$/.test(tags.amenity ?? '')
    || /^(station)$/.test(tags.railway ?? '')
    || /^(tower|lighthouse|observatory)$/.test(tags.man_made ?? '')
  )) return 'landmark'
  if (tags.highway && /^(motorway|trunk|primary|secondary|tertiary)$/.test(tags.highway)) return 'road'
  if (tags.railway && /^(rail|light_rail|tram)$/.test(tags.railway)) return 'rail'
  if (tags.waterway && /^(river|canal)$/.test(tags.waterway)) return 'waterway'
  if (tags.natural === 'water' || tags.water) return 'water'
  if (tags.landuse === 'forest' || tags.natural === 'wood' || tags.landcover === 'trees') return 'forest'
  if (/^(scrub|grassland|heath|wetland)$/.test(tags.natural ?? '') || tags.landcover === 'grass' || /^(park|nature_reserve)$/.test(tags.leisure ?? '')) return 'vegetation'
  if (/^(farmland|farmyard|meadow|orchard|grass)$/.test(tags.landuse ?? '')) return 'farmland'
  if (/^(residential|commercial|retail)$/.test(tags.landuse ?? '')) return 'urban'
  if (tags.landuse === 'industrial') return 'industrial'
  return null
}

function visualClass(featureType: string, tags: Tags) {
  if (featureType === 'forest') return tags.natural === 'wood' ? 'wood' : 'forest'
  if (featureType === 'farmland') return tags.landuse ?? 'farmland'
  if (featureType === 'vegetation') return tags.natural ?? tags.landcover ?? tags.leisure ?? 'vegetation'
  if (featureType === 'urban') return tags.landuse ?? 'urban'
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

function toFeatures(elements: OverpassElement[]) {
  const output: PreparedFeature[] = []
  for (const element of elements) {
    const tags = element.tags ?? {}
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
  return output
}

function queryFor(bounds: Bounds) {
  const box = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`
  // Deliberately no blanket [building] query. A materialized NOXIA city keeps
  // the real morphology while avoiding tens of thousands of irrelevant houses.
  return `[out:json][timeout:12];(
way[natural=water](${box});way[water](${box});relation[natural=water](${box});
way[waterway~"river|canal"](${box});
way[landuse=forest](${box});way[natural=wood](${box});relation[landuse=forest](${box});relation[natural=wood](${box});
way[landcover=trees](${box});relation[landcover=trees](${box});
way[natural~"scrub|grassland|heath|wetland"](${box});relation[natural~"scrub|grassland|heath|wetland"](${box});
way[landcover=grass](${box});relation[landcover=grass](${box});
way[leisure~"park|nature_reserve"](${box});relation[leisure~"park|nature_reserve"](${box});
way[landuse~"farmland|farmyard|meadow|orchard|grass"](${box});
way[landuse~"residential|commercial|retail"](${box});relation[landuse~"residential|commercial|retail"](${box});
way[landuse=industrial](${box});relation[landuse=industrial](${box});
way[highway~"motorway|trunk|primary|secondary|tertiary"](${box});
way[railway~"rail|light_rail|tram"](${box});
node[place~"city|town|village|hamlet|suburb"](${box});
nwr[name][tourism~"museum|attraction|viewpoint|gallery"](${box});
nwr[name][historic~"castle|monument|memorial|archaeological_site|ruins|fort|city_gate"](${box});
nwr[name][amenity~"university|townhall|theatre|arts_centre|library|hospital"](${box});
nwr[name][railway=station](${box});
nwr[name][man_made~"tower|lighthouse|observatory"](${box});
);out center geom;`
}

async function loadNormalizedFeatures(bounds: Bounds) {
  const failures: string[] = []
  const query = queryFor(bounds)
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'user-agent': 'NOXIA/0.1 earth-place-materializer',
        },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
        cache: 'no-store',
      })
      if (!response.ok) {
        failures.push(`${new URL(endpoint).host}: HTTP ${response.status}`)
        continue
      }
      const payload = await response.json() as { elements?: OverpassElement[] }
      return { features: toFeatures(payload.elements ?? []), source: `overpass:${new URL(endpoint).host}:${EARTH_PLACE_MATERIALIZER_VERSION}` }
    } catch (error) {
      failures.push(`${new URL(endpoint).host}: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      clearTimeout(timer)
    }
  }
  throw new Error(`Kartennormalisierung fehlgeschlagen: ${failures.join('; ')}`)
}

export async function materializeEarthPlace(input: { slug: string; label: string; lat: number; lon: number; radiusKm?: number }) {
  const radiusKm = Math.min(2.5, Math.max(2.2, input.radiusKm ?? 2.2))
  const bounds = earthPlaceBounds(input.lat, input.lon, radiusKm)
  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from('celestial_regions')
    .select('id, slug, source, imported_at')
    .eq('slug', input.slug)
    .maybeSingle()

  if (existing) {
    const { count } = await supabase
      .from('region_features')
      .select('id', { count: 'exact', head: true })
      .eq('region_id', existing.id)
    if ((count ?? 0) > 0 && String(existing.source ?? '').includes(EARTH_PLACE_MATERIALIZER_VERSION)) {
      return { ok: true, status: 'ready' as const, slug: input.slug, regionId: existing.id, total: count ?? 0, source: existing.source }
    }
  }

  const { data: region, error: regionError } = await supabase
    .from('celestial_regions')
    .upsert({
      body: 'earth',
      slug: input.slug,
      label: input.label,
      center_lat: input.lat,
      center_lon: input.lon,
      radius_km: radiusKm,
      bounds,
      source: 'noxia:materializing',
      imported_at: new Date().toISOString(),
    }, { onConflict: 'slug' })
    .select('id')
    .single()
  if (regionError || !region) throw regionError ?? new Error('NOXIA-Ort konnte nicht angelegt werden')

  try {
    const loaded = await loadNormalizedFeatures(bounds)
    if (!loaded.features.length) throw new Error('Keine verwertbaren Realwelt-Features gefunden')
    const rows = loaded.features.map(feature => ({ ...feature, region_id: region.id }))

    const { error: deleteError } = await supabase.from('region_features').delete().eq('region_id', region.id)
    if (deleteError) throw deleteError
    for (let index = 0; index < rows.length; index += 400) {
      const { error } = await supabase.from('region_features').insert(rows.slice(index, index + 400))
      if (error) throw error
    }
    const { error: updateError } = await supabase
      .from('celestial_regions')
      .update({ source: loaded.source, imported_at: new Date().toISOString(), bounds, radius_km: radiusKm })
      .eq('id', region.id)
    if (updateError) throw updateError

    return { ok: true, status: 'ready' as const, slug: input.slug, regionId: region.id, total: rows.length, source: loaded.source }
  } catch (error) {
    await supabase
      .from('celestial_regions')
      .update({ source: 'noxia:materialization-failed', imported_at: new Date().toISOString() })
      .eq('id', region.id)
    return {
      ok: false,
      status: 'failed' as const,
      slug: input.slug,
      regionId: region.id,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
