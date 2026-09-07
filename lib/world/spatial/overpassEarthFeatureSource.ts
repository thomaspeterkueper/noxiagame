import type { EarthFeatureClass, EarthFeatureQuery, EarthFeatureSource, ImportedEarthFeature } from './earthFeatureSource'

type OverpassMember = {
  type: 'node' | 'way' | 'relation'
  ref: number
  role?: string
  geometry?: { lat: number; lon: number }[]
}

type OverpassElement = {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  geometry?: { lat: number; lon: number }[]
  members?: OverpassMember[]
  tags?: Record<string, string>
}

type OverpassResponse = { elements?: OverpassElement[] }
type GeoPoint = { lat: number; lon: number }

const ENDPOINT = 'https://overpass-api.de/api/interpreter'

function qForClass(cls: EarthFeatureClass, b: EarthFeatureQuery['bounds']): string {
  const box = `${b.south},${b.west},${b.north},${b.east}`
  switch (cls) {
    case 'road': return `way[highway](${box});`
    case 'rail': return `way[railway](${box});`
    case 'waterway': return `way[waterway](${box});`
    case 'water': return `way[natural=water](${box});way[water](${box});relation[natural=water](${box});`
    case 'forest': return `way[landuse=forest](${box});way[natural=wood](${box});relation[landuse=forest](${box});relation[natural=wood](${box});`
    case 'farmland': return `way[landuse~"farmland|farmyard|meadow|orchard"](${box});relation[landuse~"farmland|farmyard|meadow|orchard"](${box});`
    case 'urban': return `way[landuse~"residential|commercial|retail"](${box});relation[landuse~"residential|commercial|retail"](${box});`
    case 'building': return `way[building](${box});`
    case 'settlement': return `node[place~"city|town|village|hamlet"](${box});`
    case 'industrial': return `way[landuse=industrial](${box});relation[landuse=industrial](${box});`
    case 'public': return `way[amenity](${box});node[amenity](${box});`
  }
}

function classify(tags: Record<string, string> = {}): EarthFeatureClass | null {
  if (tags.highway) return 'road'
  if (tags.railway) return 'rail'
  if (tags.waterway) return 'waterway'
  if (tags.natural === 'water' || tags.water) return 'water'
  if (tags.landuse === 'forest' || tags.natural === 'wood') return 'forest'
  if (['farmland','farmyard','meadow','orchard'].includes(tags.landuse ?? '')) return 'farmland'
  if (['residential','commercial','retail'].includes(tags.landuse ?? '')) return 'urban'
  if (tags.building) return 'building'
  if (tags.place) return 'settlement'
  if (tags.landuse === 'industrial') return 'industrial'
  if (tags.amenity) return 'public'
  return null
}

function samePoint(a: GeoPoint, b: GeoPoint) {
  return Math.abs(a.lat - b.lat) < 1e-8 && Math.abs(a.lon - b.lon) < 1e-8
}

function isClosed(points: GeoPoint[]) {
  return points.length > 3 && samePoint(points[0], points[points.length - 1])
}

/**
 * Overpass multipolygon relations expose geometry on their member ways rather
 * than as a single relation.geometry array. Stitch outer member fragments into
 * closed rings so large forests, farmland, urban areas and water bodies are not
 * silently dropped by the bootstrap renderer.
 */
function stitchOuterRings(members: OverpassMember[]): GeoPoint[][] {
  const pending = members
    .filter(member => (member.role ?? 'outer') === 'outer' && (member.geometry?.length ?? 0) >= 2)
    .map(member => member.geometry!.map(point => ({ lat: point.lat, lon: point.lon })))
  const rings: GeoPoint[][] = []

  while (pending.length) {
    let ring = pending.shift()!
    let progressed = true

    while (!isClosed(ring) && progressed && pending.length) {
      progressed = false
      const first = ring[0]
      const last = ring[ring.length - 1]

      for (let i = 0; i < pending.length; i++) {
        const candidate = pending[i]
        const candidateFirst = candidate[0]
        const candidateLast = candidate[candidate.length - 1]

        if (samePoint(last, candidateFirst)) {
          ring = [...ring, ...candidate.slice(1)]
        } else if (samePoint(last, candidateLast)) {
          ring = [...ring, ...candidate.slice(0, -1).reverse()]
        } else if (samePoint(first, candidateLast)) {
          ring = [...candidate.slice(0, -1), ...ring]
        } else if (samePoint(first, candidateFirst)) {
          ring = [...candidate.slice(1).reverse(), ...ring]
        } else {
          continue
        }

        pending.splice(i, 1)
        progressed = true
        break
      }
    }

    if (isClosed(ring)) rings.push(ring)
  }

  return rings
}

function baseFor(el: OverpassElement, featureClass: EarthFeatureClass, sourceId = `${el.type}/${el.id}`) {
  return {
    worldId: 'earth' as const,
    featureType: featureClass,
    properties: { ...el.tags, featureClass },
    source: {
      provider: 'OpenStreetMap / Overpass',
      dataset: 'OpenStreetMap current',
      sourceId,
      license: 'ODbL-1.0',
    },
  }
}

function toFeatures(el: OverpassElement): ImportedEarthFeature[] {
  const featureClass = classify(el.tags)
  if (!featureClass) return []

  const base = baseFor(el, featureClass)
  if (el.type === 'node' && Number.isFinite(el.lat) && Number.isFinite(el.lon)) {
    return [{
      ...base,
      id: `osm:${el.type}:${el.id}`,
      geometryKind: 'point',
      geometry: { kind: 'point', coordinates: { lat: el.lat!, lon: el.lon! } },
    }]
  }

  const polygonClasses: EarthFeatureClass[] = ['water','forest','farmland','urban','building','industrial','public']
  if (el.type === 'relation' && polygonClasses.includes(featureClass) && el.members?.length) {
    const rings = stitchOuterRings(el.members)
    if (rings.length) {
      return rings.map((coordinates, index) => ({
        ...baseFor(el, featureClass, `relation/${el.id}#outer-${index + 1}`),
        id: `osm:relation:${el.id}:outer:${index + 1}`,
        properties: { ...base.properties, relationRole: 'outer', relationId: String(el.id) },
        geometryKind: 'polygon',
        geometry: { kind: 'polygon', coordinates },
      }))
    }
  }

  const geometry = el.geometry ?? []
  if (geometry.length < 2) {
    if (el.center) return [{
      ...base,
      id: `osm:${el.type}:${el.id}`,
      geometryKind: 'point',
      geometry: { kind: 'point', coordinates: el.center },
    }]
    return []
  }

  const coords = geometry.map(point => ({ lat: point.lat, lon: point.lon }))
  const polygon = isClosed(coords) && polygonClasses.includes(featureClass)
  return [{
    ...base,
    id: `osm:${el.type}:${el.id}`,
    geometryKind: polygon ? 'polygon' : 'line',
    geometry: polygon
      ? { kind: 'polygon', coordinates: coords }
      : { kind: 'line', coordinates: coords },
  }]
}

export class OverpassEarthFeatureSource implements EarthFeatureSource {
  readonly id = 'osm-overpass-current'

  async load(query: EarthFeatureQuery): Promise<ImportedEarthFeature[]> {
    const body = `[out:json][timeout:20];(${query.classes.map(c => qForClass(c, query.bounds)).join('')});out body geom center;`
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'NOXIA/0.1 earth-bootstrap' },
      body: new URLSearchParams({ data: body }),
      next: { revalidate: 3600 },
    })
    if (!response.ok) throw new Error(`Overpass ${response.status}`)
    const payload = await response.json() as OverpassResponse
    return (payload.elements ?? []).flatMap(toFeatures)
  }
}
