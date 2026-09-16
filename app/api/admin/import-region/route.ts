// app/api/admin/import-region/route.ts
// Geschuetzte Server-Route zum Import/Refresh einer Kartenregion.
// Route und scripts/import-earth-region.mjs verwenden denselben Importmodus.

import { createHash, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const maxDuration = 120

const OVERPASS_ENDPOINTS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
]
const MAX_POINTS_PER_WAY = 40
const IMPORT_SECRET_SHA256 = '6e7d71b3bd360c945d18f8a3c20d596739049d97736455dda6980c95856d4e8d'

type GeoPoint = { lat: number; lon: number }
type OverpassElement = {
  type?: string
  lat?: number
  lon?: number
  tags?: Record<string, string>
  geometry?: GeoPoint[]
  members?: Array<{ geometry?: GeoPoint[] }>
}

type PreparedFeature = {
  feature_type: string
  geometry: { kind: 'point' | 'line' | 'polygon'; coordinates: GeoPoint | GeoPoint[] }
  properties: Record<string, string>
}

function boundsFor(lat: number, lon: number, radiusKm: number) {
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

function capPoints(points: GeoPoint[]) {
  const simplified = simplify(points)
  if (simplified.length <= MAX_POINTS_PER_WAY) return simplified
  const step = simplified.length / MAX_POINTS_PER_WAY
  const out: GeoPoint[] = []
  for (let i = 0; i < MAX_POINTS_PER_WAY; i++) out.push(simplified[Math.floor(i * step)])
  return out
}

function matchesImportSecret(secret: string) {
  const actual = Buffer.from(createHash('sha256').update(secret).digest('hex'))
  const expected = Buffer.from(IMPORT_SECRET_SHA256)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function buildCombinedQuery(bounds: { south: number; west: number; north: number; east: number }) {
  const b = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`
  return `[out:json][timeout:55];(
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

async function fetchRegionElements(bounds: { south: number; west: number; north: number; east: number }) {
  const query = buildCombinedQuery(bounds)
  const failures: string[] = []

  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 35000)
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
      return { elements: (data.elements ?? []) as OverpassElement[], endpoint }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      failures.push(`${new URL(endpoint).host}: ${reason}`)
    } finally {
      clearTimeout(timeout)
    }
  }

  throw new Error(`Overpass nicht erreichbar (${failures.join('; ')})`)
}

function classifyElement(el: OverpassElement) {
  const tags = el.tags ?? {}
  if (el.type === 'node' && /^(city|town|village|hamlet)$/.test(tags.place ?? '')) return 'settlement'
  if (tags.highway && /^(motorway|trunk|primary|secondary)$/.test(tags.highway)) return 'road'
  if (tags.railway) return 'rail'
  if (tags.landuse === 'industrial') return 'industrial'
  if (/^(residential|commercial|retail)$/.test(tags.landuse ?? '')) return 'urban'
  if (/^(farmland|farmyard|meadow|orchard)$/.test(tags.landuse ?? '')) return 'farmland'
  if (tags.landuse === 'forest' || tags.natural === 'wood') return 'forest'
  if (tags.natural === 'water' || tags.water) return 'water'
  return null
}

function geometryFeature(cls: string, raw: GeoPoint[], properties: Record<string, string>): PreparedFeature | null {
  const points = raw.filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lon))
  if (points.length < 2) return null
  const capped = capPoints(points)
  const isPolygon = points.length > 3 && points[0].lat === points[points.length - 1].lat && points[0].lon === points[points.length - 1].lon
  return {
    feature_type: cls,
    geometry: { kind: isPolygon ? 'polygon' : 'line', coordinates: capped },
    properties,
  }
}

function toFeatures(elements: OverpassElement[]) {
  const out: PreparedFeature[] = []
  for (const el of elements) {
    const cls = classifyElement(el)
    if (!cls) continue
    const properties = el.tags ?? {}

    if (el.type === 'node') {
      if (!Number.isFinite(el.lat) || !Number.isFinite(el.lon)) continue
      out.push({
        feature_type: cls,
        geometry: { kind: 'point', coordinates: { lat: el.lat!, lon: el.lon! } },
        properties,
      })
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = req.headers.get('x-noxia-admin-secret') ?? searchParams.get('secret')
  if (!secret || !matchesImportSecret(secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const slug = searchParams.get('slug')
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
    // Erst laden und transformieren. Bestehende DB-Daten bleiben bei einem
    // Overpass-Fehler dadurch unangetastet.
    const { elements, endpoint } = await fetchRegionElements(bounds)
    const prepared = toFeatures(elements)
    const counts: Record<string, number> = {}
    for (const feature of prepared) counts[feature.feature_type] = (counts[feature.feature_type] ?? 0) + 1

    const supabase = createServiceClient()
    const { data: region, error: regionError } = await supabase
      .from('celestial_regions')
      .upsert(
        { body, slug, label, center_lat: lat, center_lon: lon, radius_km: radiusKm, bounds, source: 'overpass', imported_at: new Date().toISOString() },
        { onConflict: 'slug' }
      )
      .select()
      .single()
    if (regionError) throw regionError

    const { error: deleteError } = await supabase.from('region_features').delete().eq('region_id', region.id)
    if (deleteError) throw deleteError

    const rows = prepared.map(feature => ({ ...feature, region_id: region.id }))
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from('region_features').insert(rows.slice(i, i + 500))
      if (error) throw error
    }

    return NextResponse.json({ ok: true, regionId: region.id, slug, total: rows.length, counts, endpoint })
  } catch (err) {
    console.error('region import failed', { slug, error: err })
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Import fehlgeschlagen' }, { status: 500 })
  }
}
