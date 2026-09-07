import type { EarthFeatureClass, EarthFeatureQuery, EarthFeatureSource, ImportedEarthFeature } from './earthFeatureSource'

type GeoPoint = { lat: number; lon: number }
type OverpassGeometryPoint = GeoPoint | null

type OverpassMember = {
  type: 'node' | 'way' | 'relation'
  ref: number
  role?: string
  geometry?: OverpassGeometryPoint[]
}

type OverpassElement = {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: GeoPoint
  geometry?: OverpassGeometryPoint[]
  members?: OverpassMember[]
  tags?: Record<string, string>
}

type OverpassResponse = { elements?: OverpassElement[] }

const ENDPOINT = 'https://overpass-api.de/api/interpreter'

function primaryQForClass(cls: EarthFeatureClass, b: EarthFeatureQuery['bounds']): string {
  const box = `${b.south},${b.west},${b.north},${b.east}`
  switch (cls) {
    case 'road': return `way[highway](${box});`
    case 'rail': return `way[railway](${box});`
    case 'waterway': return `way[waterway](${box});`
    case 'water': return `way[natural=water](${box});way[water](${box});`
    case 'forest': return `way[landuse=forest](${box});way[natural=wood](${box});`
    case 'farmland': return `way[landuse~"farmland|farmyard|meadow|orchard"](${box});`
    case 'urban': return `way[landuse~"residential|commercial|retail"](${box});`
    case 'building': return `way[building](${box});`
    case 'settlement': return `node[place~"city|town|village|hamlet"](${box});`
    case 'industrial': return `way[landuse=industrial](${box});`
    case 'public': return `way[amenity](${box});node[amenity](${box});`
  }
}

function relationQForClass(cls: EarthFeatureClass, b: EarthFeatureQuery['bounds']): string {
  const box = `${b.south},${b.west},${b.north},${b.east}`
  switch (cls) {
    case 'water': return `relation[natural=water](${box});relation[water](${box});`
    case 'forest': return `relation[landuse=forest](${box});relation[natural=wood](${box});`
    case 'farmland': return `relation[landuse~"farmland|farmyard|meadow|orchard"](${box});`
    case 'urban': return `relation[landuse~"residential|commercial|retail"](${box});`
    case 'industrial': return `relation[landuse=industrial](${box});`
    default: return ''
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

function isGeoPoint(point: OverpassGeometryPoint): point is GeoPoint {
  return point !== null && Number.isFinite(point.lat) && Number.isFinite(point.lon)
}

function geometrySegments(geometry?: OverpassGeometryPoint[]): GeoPoint[][] {
  const segments: GeoPoint[][] = []
  let current: GeoPoint[] = []

  for (const point of geometry ?? []) {
    if (isGeoPoint(point)) {
      current.push({ lat: point.lat, lon: point.lon })
      continue
    }
    if (current.length) segments.push(current)
    current = []
  }
  if (current.length) segments.push(current)
  return segments
}

function samePoint(a: GeoPoint, b: GeoPoint) {
  return Math.abs(a.lat - b.lat) < 1e-8 && Math.abs(a.lon - b.lon) < 1e-8
}

function isClosed(points: GeoPoint[]) {
  return points.length > 3 && samePoint(points[0], points[points.length - 1])
}

/**
 * Multipolygon relations carry geometry on their member ways. With a geometry
 * output bounding box Overpass may insert nulls for omitted vertices, so split
 * each member into contiguous fragments before trying to stitch outer rings.
 */
function stitchOuterRings(members: OverpassMember[]): GeoPoint[][] {
  const pending = members
    .filter(member => (member.role ?? 'outer') === 'outer')
    .flatMap(member => geometrySegments(member.geometry))
    .filter(segment => segment.length >= 2)
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
    return rings.map((coordinates, index) => ({
      ...baseFor(el, featureClass, `relation/${el.id}#outer-${index + 1}`),
      id: `osm:relation:${el.id}:outer:${index + 1}`,
      properties: { ...base.properties, relationRole: 'outer', relationId: String(el.id) },
      geometryKind: 'polygon',
      geometry: { kind: 'polygon', coordinates },
    }))
  }

  const segments = geometrySegments(el.geometry).filter(segment => segment.length >= 2)
  if (!segments.length) {
    if (el.center) return [{
      ...base,
      id: `osm:${el.type}:${el.id}`,
      geometryKind: 'point',
      geometry: { kind: 'point', coordinates: el.center },
    }]
    return []
  }

  return segments.map((coordinates, index) => {
    const polygon = isClosed(coordinates) && polygonClasses.includes(featureClass)
    return {
      ...base,
      id: segments.length === 1 ? `osm:${el.type}:${el.id}` : `osm:${el.type}:${el.id}:segment:${index + 1}`,
      geometryKind: polygon ? 'polygon' : 'line',
      geometry: polygon
        ? { kind: 'polygon' as const, coordinates }
        : { kind: 'line' as const, coordinates },
    }
  })
}

export class OverpassEarthFeatureSource implements EarthFeatureSource {
  readonly id = 'osm-overpass-current'

  async load(query: EarthFeatureQuery): Promise<ImportedEarthFeature[]> {
    const outputBox = `${query.bounds.south},${query.bounds.west},${query.bounds.north},${query.bounds.east}`
    const primaryQuery = query.classes.map(c => primaryQForClass(c, query.bounds)).join('')
    const relationQuery = query.classes.map(c => relationQForClass(c, query.bounds)).filter(Boolean).join('')

    // Ways and nodes need their complete geometry so roads, streams, buildings
    // and ordinary land-use polygons preserve their real shape. Multipolygon
    // relations can span very large regions, so only those are geometry-clipped
    // to the active map window. This keeps Overpass responses bounded without
    // collapsing the ordinary map features to centre points.
    const body = `[out:json][timeout:30];(${primaryQuery});out body geom;${relationQuery ? `(${relationQuery});out body geom(${outputBox});` : ''}`
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