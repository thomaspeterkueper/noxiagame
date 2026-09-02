import type { EarthFeatureClass, EarthFeatureQuery, EarthFeatureSource, ImportedEarthFeature } from './earthFeatureSource'

type OverpassElement = {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  geometry?: { lat: number; lon: number }[]
  tags?: Record<string, string>
}

type OverpassResponse = { elements?: OverpassElement[] }

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
  if (tags.building) return 'building'
  if (tags.place) return 'settlement'
  if (tags.landuse === 'industrial') return 'industrial'
  if (tags.amenity) return 'public'
  return null
}

function toFeature(el: OverpassElement): ImportedEarthFeature | null {
  const featureClass = classify(el.tags)
  if (!featureClass) return null
  const provider = 'OpenStreetMap / Overpass'
  const source = { provider, dataset: 'OpenStreetMap current', sourceId: `${el.type}/${el.id}`, license: 'ODbL-1.0' }
  const base = {
    id: `osm:${el.type}:${el.id}`,
    worldId: 'earth' as const,
    featureType: featureClass,
    properties: { ...el.tags, featureClass },
    source,
  }
  if (el.type === 'node' && Number.isFinite(el.lat) && Number.isFinite(el.lon)) {
    return { ...base, geometryKind: 'point', geometry: { kind: 'point', coordinates: { lat: el.lat!, lon: el.lon! } } }
  }
  const geometry = el.geometry ?? []
  if (geometry.length < 2) {
    if (el.center) return { ...base, geometryKind: 'point', geometry: { kind: 'point', coordinates: el.center } }
    return null
  }
  const coords = geometry.map(p => ({ lat: p.lat, lon: p.lon }))
  const closed = coords.length > 3 && coords[0].lat === coords[coords.length - 1].lat && coords[0].lon === coords[coords.length - 1].lon
  const polygonClasses: EarthFeatureClass[] = ['water','forest','farmland','building','industrial','public']
  const polygon = closed && polygonClasses.includes(featureClass)
  return { ...base, geometryKind: polygon ? 'polygon' : 'line', geometry: polygon ? { kind: 'polygon', coordinates: coords } : { kind: 'line', coordinates: coords } }
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
    return (payload.elements ?? []).map(toFeature).filter((f): f is ImportedEarthFeature => Boolean(f))
  }
}
