// app/api/admin/import-region/route.ts
// Geschuetzte Server-Route zum Import/Refresh einer Kartenregion.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { OpenMeteoElevationSource } from '@/lib/world/spatial/openMeteoElevationSource'

export const maxDuration = 120

const elevationSource = new OpenMeteoElevationSource()
const OVERPASS_ENDPOINTS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
]
const OSM_MAP_ENDPOINT = 'https://api.openstreetmap.org/api/0.6/map'
const MAX_POINTS_PER_WAY = 40

type GeoPoint = { lat: number; lon: number }
type Tags = Record<string, string>
type Bounds = { south: number; west: number; north: number; east: number }
type OverpassElement = {
  type?: string
  lat?: number
  lon?: number
  tags?: Tags
  geometry?: GeoPoint[]
  members?: Array<{ geometry?: GeoPoint[] }>
}
type PreparedFeature = {
  feature_type: string
  geometry: { kind: 'point' | 'line' | 'polygon'; coordinates: GeoPoint | GeoPoint[] }
  properties: Tags
}
type OsmWay = { refs: string[]; tags: Tags }

function boundsFor(lat: number, lon: number, radiusKm: number): Bounds {
  const dLat = radiusKm / 111.32
  const dLon = radiusKm / (111.32 * Math.cos(lat * Math.PI / 180))
  return { south: lat - dLat, west: lon - dLon, north: lat + dLat, east: lon + dLon }
}

function perpDistance(p: GeoPoint, a: GeoPoint, b: GeoPoint) {
  const dx = b.lon - a.lon, dy = b.lat - a.lat
  const len = Math.hypot(dx, dy) || 1e-9
  return Math.abs((p.lon - a.lon) * dy - (p.lat - a.lat) * dx) / len
}

function simplify(points: GeoPoint[], tolerance = 0.00015): GeoPoint[] {
  if (points.length <= 2) return points
  let maxDist = 0, index = 0
  const a = points[0], b = points[points.length - 1]
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDistance(points[i], a, b)
    if (d > maxDist) { maxDist = d; index = i }
  }
  if (maxDist > tolerance) {
    const left = simplify(points.slice(0, index + 1), tolerance)
    const right = simplify(points.slice(index), tolerance)
    return [...left.slice(0, -1), ...right]
  }
  return [a, b]
}

function capLinePoints(points: GeoPoint[]) {
  const simplified = simplify(points)
  if (simplified.length <= MAX_POINTS_PER_WAY) return simplified
  const step = simplified.length / MAX_POINTS_PER_WAY
  const out: GeoPoint[] = []
  for (let i = 0; i < MAX_POINTS_PER_WAY; i++) out.push(simplified[Math.floor(i * step)])
  return out
}

function capPolygonPoints(points: GeoPoint[]) {
  const ring = points.slice(0, -1)
  const maxRingPoints = MAX_POINTS_PER_WAY - 1
  let capped = ring
  if (ring.length > maxRingPoints) {
    const step = ring.length / maxRingPoints
    capped = []
    for (let i = 0; i < maxRingPoints; i++) capped.push(ring[Math.floor(i * step)])
  }
  if (capped.length < 3) return points
  return [...capped, capped[0]]
}

function buildCombinedQuery(bounds: Bounds) {
  const b = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`
  return `[out:json][timeout:30];(
way[natural=water](${b});way[water](${b});relation[natural=water](${b});
way[landuse=forest](${b});way[natural=wood](${b});relation[landuse=forest](${b});relation[natural=wood](${b});
way[landuse~"farmland|farmyard|meadow|orchard"](${b});
way[landuse~"residential|commercial|retail"](${b});relation[landuse~"residential|commercial|retail"](${b});
way[landuse=industrial](${b});relation[landuse=industrial](${b});
way[highway~"motorway|trunk|primary|secondary"](${b});
way[railway](${b});
node[place~"city|town|village|hamlet"](${b});
);out geom;`
}

async function fetchOverpass(bounds: Bounds) {
  const query = buildCombinedQuery(bounds)
  const failures: string[] = []
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'user-agent': 'NOXIA/0.1 region-import',
        },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
        cache: 'no-store',
      })
      if (!res.ok) {
        failures.push(`${new URL(endpoint).host}: HTTP ${res.status}`)
        continue
      }
      const data = await res.json()
      return { elements: (data.elements ?? []) as OverpassElement[], source: `overpass:${new URL(endpoint).host}` }
    } catch (err) {
      failures.push(`${new URL(endpoint).host}: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      clearTimeout(timeout)
    }
  }
  throw new Error(failures.join('; '))
}

function classifyTags(tags: Tags, isNode = false) {
  if (isNode && /^(city|town|village|hamlet)$/.test(tags.place ?? '')) return 'settlement'
  if (tags.highway && /^(motorway|trunk|primary|secondary)$/.test(tags.highway)) return 'road'
  if (tags.railway) return 'rail'
  if (tags.landuse === 'industrial') return 'industrial'
  if (/^(residential|commercial|retail)$/.test(tags.landuse ?? '')) return 'urban'
  if (/^(farmland|farmyard|meadow|orchard)$/.test(tags.landuse ?? '')) return 'farmland'
  if (tags.landuse === 'forest' || tags.natural === 'wood') return 'forest'
  if (tags.natural === 'water' || tags.water) return 'water'
  return null
}

function geometryFeature(cls: string, raw: GeoPoint[], properties: Tags): PreparedFeature | null {
  const points = raw.filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lon))
  if (points.length < 2) return null
  const isPolygon = points.length > 3 && points[0].lat === points[points.length - 1].lat && points[0].lon === points[points.length - 1].lon
  const capped = isPolygon ? capPolygonPoints(points) : capLinePoints(points)
  return { feature_type: cls, geometry: { kind: isPolygon ? 'polygon' : 'line', coordinates: capped }, properties }
}

function toFeaturesFromOverpass(elements: OverpassElement[]) {
  const out: PreparedFeature[] = []
  for (const el of elements) {
    const properties = el.tags ?? {}
    const cls = classifyTags(properties, el.type === 'node')
    if (!cls) continue
    if (el.type === 'node') {
      if (!Number.isFinite(el.lat) || !Number.isFinite(el.lon)) continue
      out.push({ feature_type: cls, geometry: { kind: 'point', coordinates: { lat: el.lat!, lon: el.lon! } }, properties })
      continue
    }
    if (el.type === 'relation' && Array.isArray(el.members)) {
      for (const member of el.members) {
        const feature = geometryFeature(cls, member.geometry ?? [], properties)
        if (feature) out.push(feature)
      }
      continue
    }
    const feature = geometryFeature(cls, el.geometry ?? [], properties)
    if (feature) out.push(feature)
  }
  return out
}

function decodeXml(value: string) {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
}

function attr(text: string, name: string) {
  const match = text.match(new RegExp(`\\b${name}="([^"]*)"`))
  return match ? decodeXml(match[1]) : null
}

function parseTags(body: string): Tags {
  const tags: Tags = {}
  const re = /<tag\b([^>]*?)\/>/g
  let match: RegExpExecArray | null
  while ((match = re.exec(body))) {
    const key = attr(match[1], 'k')
    const value = attr(match[1], 'v')
    if (key != null && value != null) tags[key] = value
  }
  return tags
}

async function fetchOsmMap(bounds: Bounds) {
  const url = new URL(OSM_MAP_ENDPOINT)
  url.searchParams.set('bbox', `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'NOXIA/0.1 region-import', accept: 'application/xml,text/xml' },
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`OSM map API HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timeout)
  }
}

function toFeaturesFromOsmXml(xml: string) {
  const nodes = new Map<string, GeoPoint>()
  const ways = new Map<string, OsmWay>()
  const out: PreparedFeature[] = []

  const nodeRe = /<node\b([^>]*?)(?:\/>|>([\s\S]*?)<\/node>)/g
  let nodeMatch: RegExpExecArray | null
  while ((nodeMatch = nodeRe.exec(xml))) {
    const attrs = nodeMatch[1]
    const id = attr(attrs, 'id')
    const lat = Number(attr(attrs, 'lat'))
    const lon = Number(attr(attrs, 'lon'))
    if (!id || !Number.isFinite(lat) || !Number.isFinite(lon)) continue
    nodes.set(id, { lat, lon })
    const tags = parseTags(nodeMatch[2] ?? '')
    const cls = classifyTags(tags, true)
    if (cls === 'settlement') {
      out.push({ feature_type: cls, geometry: { kind: 'point', coordinates: { lat, lon } }, properties: tags })
    }
  }

  const wayRe = /<way\b([^>]*)>([\s\S]*?)<\/way>/g
  let wayMatch: RegExpExecArray | null
  while ((wayMatch = wayRe.exec(xml))) {
    const id = attr(wayMatch[1], 'id')
    if (!id) continue
    const body = wayMatch[2]
    const refs: string[] = []
    const ndRe = /<nd\b([^>]*?)\/>/g
    let ndMatch: RegExpExecArray | null
    while ((ndMatch = ndRe.exec(body))) {
      const ref = attr(ndMatch[1], 'ref')
      if (ref) refs.push(ref)
    }
    ways.set(id, { refs, tags: parseTags(body) })
  }

  const emitted = new Set<string>()
  const emitWay = (id: string, way: OsmWay, cls: string, properties: Tags) => {
    const key = `${cls}:${id}`
    if (emitted.has(key)) return
    const points = way.refs.map(ref => nodes.get(ref)).filter((p): p is GeoPoint => Boolean(p))
    const feature = geometryFeature(cls, points, properties)
    if (feature) {
      emitted.add(key)
      out.push(feature)
    }
  }

  for (const [id, way] of ways) {
    const cls = classifyTags(way.tags)
    if (cls) emitWay(id, way, cls, way.tags)
  }

  const relationRe = /<relation\b([^>]*)>([\s\S]*?)<\/relation>/g
  let relationMatch: RegExpExecArray | null
  while ((relationMatch = relationRe.exec(xml))) {
    const body = relationMatch[2]
    const relationTags = parseTags(body)
    const cls = classifyTags(relationTags)
    if (!cls) continue
    const memberRe = /<member\b([^>]*?)\/>/g
    let memberMatch: RegExpExecArray | null
    while ((memberMatch = memberRe.exec(body))) {
      if (attr(memberMatch[1], 'type') !== 'way') continue
      const ref = attr(memberMatch[1], 'ref')
      if (!ref) continue
      const way = ways.get(ref)
      if (way) emitWay(ref, way, cls, relationTags)
    }
  }

  return out
}

async function loadFeatures(bounds: Bounds) {
  let overpassError = ''
  try {
    const result = await fetchOverpass(bounds)
    return { features: toFeaturesFromOverpass(result.elements), source: result.source }
  } catch (err) {
    overpassError = err instanceof Error ? err.message : String(err)
  }

  const xml = await fetchOsmMap(bounds)
  const features = toFeaturesFromOsmXml(xml)
  return { features, source: 'osm-map-api', overpassError }
}

async function importElevation(supabase: ReturnType<typeof createServiceClient>, regionId: string, bounds: Bounds) {
  const grid = await elevationSource.load(bounds, 200)
  const flat = grid.samples.map(s => s.elevationM)
  const { error: deleteError } = await supabase.from('region_elevation').delete().eq('region_id', regionId)
  if (deleteError) throw deleteError
  const { error } = await supabase.from('region_elevation').insert({
    region_id: regionId,
    resolution_m: grid.source.resolutionM,
    rows: grid.rows,
    cols: grid.cols,
    origin_lat: bounds.north,
    origin_lon: bounds.west,
    grid: flat,
  })
  if (error) throw error
  return { ok: true, rows: grid.rows, cols: grid.cols, resolutionM: grid.source.resolutionM }
}

const MRDS_WFS_ENDPOINT = 'https://mrdata.usgs.gov/services/wfs/mrds'
const GLIM_DATASET_URL = 'https://hdl.handle.net/10013/epic.39939.d001'

async function importMineralOccurrences(supabase: ReturnType<typeof createServiceClient>, regionId: string, bounds: Bounds) {
  const params = new URLSearchParams({
    service: 'WFS',
    version: '1.1.0',
    request: 'GetFeature',
    typeName: 'mrds',
    outputFormat: 'json',
    srsName: 'EPSG:4326',
    bbox: `${bounds.south},${bounds.west},${bounds.north},${bounds.east},EPSG:4326`,
  })
  const res = await fetch(`${MRDS_WFS_ENDPOINT}?${params}`)
  if (!res.ok) throw new Error(`MRDS WFS: HTTP ${res.status}`)
  const geojson = await res.json()
  const rows = ((geojson.features ?? []) as any[])
    .filter(f => f.geometry?.type === 'Point' && Array.isArray(f.geometry.coordinates))
    .map(f => {
      const p = f.properties ?? {}
      const [lon, lat] = f.geometry.coordinates
      const commodities = String(p.commod1 ?? p.commodities ?? '')
        .split(/[;,]/).map((s: string) => s.trim()).filter(Boolean)
      return {
        region_id: regionId,
        source: 'usgs-mrds',
        external_id: p.dep_id != null ? String(p.dep_id) : null,
        name: p.name ?? p.site_name ?? null,
        lat, lon,
        commodities,
        development_status: p.dev_stat ?? p.development_status ?? null,
        properties: p,
      }
    })

  await supabase.from('region_mineral_occurrences').delete().eq('region_id', regionId)
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('region_mineral_occurrences').insert(rows.slice(i, i + 500))
    if (error) throw error
  }
  return rows.length
}

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(req.url)
  const secret = req.headers.get('x-noxia-admin-secret') ?? searchParams.get('secret')
  const { data: cfg } = await supabase.from('internal_config').select('value').eq('key', 'admin_import_secret').single()
  if (!secret || !cfg || secret !== cfg.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const slug = searchParams.get('slug')

  // GLiM ist ein einmaliger GLOBALER Import (kein Regionsbezug), daher eigener
  // Action-Zweig, bevor slug/label/lat/lon als Pflichtfelder geprueft werden.
  const action = searchParams.get('action')
  if (action === 'inspect-glim') {
    try {
      const res = await fetch(GLIM_DATASET_URL, { redirect: 'follow' })
      if (!res.ok) return NextResponse.json({ error: `GLiM Download: HTTP ${res.status}` }, { status: 502 })
      const buf = Buffer.from(await res.arrayBuffer())
      const JSZip = (await import('jszip')).default
      const zip = await JSZip.loadAsync(buf)
      const entries = Object.keys(zip.files)
      const first = entries.find(n => !zip.files[n].dir)
      const preview = first ? (await zip.files[first].async('text')).slice(0, 1500) : null
      return NextResponse.json({ ok: true, finalUrl: res.url, byteLength: buf.length, entries, previewFile: first, preview })
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Inspektion fehlgeschlagen' }, { status: 500 })
    }
  }

  const label = searchParams.get('label')
  const lat = Number(searchParams.get('lat'))
  const lon = Number(searchParams.get('lon'))
  const radiusKm = Number(searchParams.get('radius'))
  const body = searchParams.get('body') ?? 'earth'

  if (!slug || !label || !Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(radiusKm) || radiusKm <= 0) {
    return NextResponse.json({ error: 'slug, label, lat, lon und radius > 0 erforderlich' }, { status: 400 })
  }

  const bounds = boundsFor(lat, lon, radiusKm)

  try {
    // Externe Kartendaten zuerst laden. Bestehende DB-Daten bleiben bei einem
    // Netz-/API-Fehler unangetastet.
    const loaded = await loadFeatures(bounds)
    const prepared = loaded.features
    if (prepared.length === 0) throw new Error('Kartendatenquelle lieferte keine verwertbaren Features')

    const counts: Record<string, number> = {}
    for (const feature of prepared) counts[feature.feature_type] = (counts[feature.feature_type] ?? 0) + 1

    const { data: region, error: regionError } = await supabase
      .from('celestial_regions')
      .upsert(
        { body, slug, label, center_lat: lat, center_lon: lon, radius_km: radiusKm, bounds, source: loaded.source, imported_at: new Date().toISOString() },
        { onConflict: 'slug' }
      )
      .select()
      .single()
    if (regionError) throw regionError

    const rows = prepared.map(feature => ({ ...feature, region_id: region.id }))

    const { error: deleteError } = await supabase.from('region_features').delete().eq('region_id', region.id)
    if (deleteError) throw deleteError
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from('region_features').insert(rows.slice(i, i + 500))
      if (error) throw error
    }

    let elevation: { ok: boolean; rows?: number; cols?: number; resolutionM?: number; error?: string }
    try {
      elevation = await importElevation(supabase, region.id, bounds)
    } catch (err) {
      elevation = { ok: false, error: err instanceof Error ? err.message : 'Elevation-Import fehlgeschlagen' }
    }

    let minerals: { ok: boolean; count?: number; error?: string }
    try {
      const count = await importMineralOccurrences(supabase, region.id, bounds)
      minerals = { ok: true, count }
    } catch (err) {
      minerals = { ok: false, error: err instanceof Error ? err.message : 'MRDS-Import fehlgeschlagen' }
    }

    return NextResponse.json({
      ok: true,
      regionId: region.id,
      slug,
      total: rows.length,
      counts,
      source: loaded.source,
      overpassError: loaded.overpassError,
      elevation,
      minerals,
    })
  } catch (err) {
    console.error('region import failed', { slug, error: err })
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Import fehlgeschlagen' }, { status: 500 })
  }
}
