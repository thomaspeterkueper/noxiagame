// app/api/admin/import-region/route.ts
// Erstellt: 16.09.2026
//
// Einmalige, geschuetzte Server-Route zum Import/Refresh einer Kartenregion
// (siehe scripts/import-earth-region.mjs fuer das aequivalente, wiederholbar
// per CLI aufrufbare Skript -- diese Route existiert, weil die lokale
// Entwicklungsumgebung keinen Netzwerkzugriff auf overpass-api.de hat, die
// Vercel-Produktionsumgebung aber schon). Absicherung ueber ein Secret in
// internal_config (Tabelle), nicht ueber einen Vercel-Env-Var-Rollout.
//
// Aufruf: GET /api/admin/import-region?slug=earth-sauerland&label=Sauerland&lat=51.325&lon=8.005&radius=3
// Header: x-noxia-admin-secret: <secret aus internal_config>

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { OpenMeteoElevationSource } from '@/lib/world/spatial/openMeteoElevationSource'

const elevationSource = new OpenMeteoElevationSource()

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter'
const MAX_POINTS_PER_WAY = 40

const CLASS_QUERIES: Record<string, (b: string) => string> = {
  water:      b => `way[natural=water](${b});way[water](${b});relation[natural=water](${b});`,
  forest:     b => `way[landuse=forest](${b});way[natural=wood](${b});relation[landuse=forest](${b});`,
  farmland:   b => `way[landuse~"farmland|farmyard|meadow|orchard"](${b});`,
  urban:      b => `way[landuse~"residential|commercial|retail"](${b});relation[landuse~"residential|commercial|retail"](${b});`,
  industrial: b => `way[landuse=industrial](${b});`,
  road:       b => `way[highway~"motorway|trunk|primary|secondary"](${b});`,
  rail:       b => `way[railway](${b});`,
  settlement: b => `node[place~"city|town|village|hamlet"](${b});`,
}

type GeoPoint = { lat: number; lon: number }

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

async function fetchClass(cls: string, bounds: { south: number; west: number; north: number; east: number }) {
  const b = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`
  const q = `[out:json][timeout:60];(${CLASS_QUERIES[cls](b)});out geom;`
  const res = await fetch(OVERPASS_ENDPOINT, { method: 'POST', body: 'data=' + encodeURIComponent(q) })
  if (!res.ok) throw new Error(`Overpass ${cls}: HTTP ${res.status}`)
  const data = await res.json()
  return (data.elements ?? []) as any[]
}

function toFeatures(cls: string, elements: any[]) {
  const out: { feature_type: string; geometry: any; properties: any }[] = []
  for (const el of elements) {
    if (el.type === 'node') {
      if (!Number.isFinite(el.lat) || !Number.isFinite(el.lon)) continue
      out.push({ feature_type: cls, geometry: { kind: 'point', coordinates: { lat: el.lat, lon: el.lon } }, properties: el.tags ?? {} })
      continue
    }
    const raw: GeoPoint[] = (el.geometry ?? []).filter((p: any) => p && Number.isFinite(p.lat) && Number.isFinite(p.lon))
    if (raw.length < 2) continue
    const capped = capPoints(raw)
    const isPolygon = raw.length > 3 && raw[0].lat === raw[raw.length - 1].lat && raw[0].lon === raw[raw.length - 1].lon
    out.push({ feature_type: cls, geometry: { kind: isPolygon ? 'polygon' : 'line', coordinates: capped }, properties: el.tags ?? {} })
  }
  return out
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
  const label = searchParams.get('label')
  const lat = Number(searchParams.get('lat'))
  const lon = Number(searchParams.get('lon'))
  const radiusKm = Number(searchParams.get('radius'))
  const body = searchParams.get('body') ?? 'earth'

  if (!slug || !label || !Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(radiusKm)) {
    return NextResponse.json({ error: 'slug, label, lat, lon, radius erforderlich' }, { status: 400 })
  }

  const bounds = boundsFor(lat, lon, radiusKm)

  const { data: region, error: regionError } = await supabase
    .from('celestial_regions')
    .upsert(
      { body, slug, label, center_lat: lat, center_lon: lon, radius_km: radiusKm, bounds, source: 'overpass', imported_at: new Date().toISOString() },
      { onConflict: 'slug' }
    )
    .select()
    .single()
  if (regionError) return NextResponse.json({ error: regionError.message }, { status: 500 })

  await supabase.from('region_features').delete().eq('region_id', region.id)

  const counts: Record<string, number> = {}
  let total = 0
  try {
    for (const cls of Object.keys(CLASS_QUERIES)) {
      const elements = await fetchClass(cls, bounds)
      const features = toFeatures(cls, elements).map(f => ({ ...f, region_id: region.id }))
      for (let i = 0; i < features.length; i += 500) {
        const { error } = await supabase.from('region_features').insert(features.slice(i, i + 500))
        if (error) throw error
      }
      counts[cls] = features.length
      total += features.length
      await new Promise(r => setTimeout(r, 1200))
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Import fehlgeschlagen', partial: counts }, { status: 500 })
  }

  let elevationStatus: { ok: boolean; rows?: number; cols?: number; error?: string } = { ok: false }
  try {
    const grid = await elevationSource.load(bounds, 200)
    const flat = grid.samples.map(s => s.elevationM)
    await supabase.from('region_elevation').delete().eq('region_id', region.id)
    const { error: elevError } = await supabase.from('region_elevation').insert({
      region_id: region.id,
      resolution_m: grid.source.resolutionM,
      rows: grid.rows,
      cols: grid.cols,
      origin_lat: bounds.north,
      origin_lon: bounds.west,
      grid: flat,
    })
    if (elevError) throw elevError
    elevationStatus = { ok: true, rows: grid.rows, cols: grid.cols }
  } catch (err) {
    elevationStatus = { ok: false, error: err instanceof Error ? err.message : 'Elevation-Import fehlgeschlagen' }
  }

  return NextResponse.json({ ok: true, regionId: region.id, slug, total, counts, elevation: elevationStatus })
}
