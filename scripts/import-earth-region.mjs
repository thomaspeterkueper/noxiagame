#!/usr/bin/env node
// Importiert eine echte Earth-Region in die NOXIA-Regionstabellen.

import { createClient } from '@supabase/supabase-js'

const OVERPASS_ENDPOINTS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
]
const ELEVATION_ENDPOINT = 'https://api.open-meteo.com/v1/elevation'
const MAX_POINTS_PER_WAY = 40
const ELEVATION_BATCH_SIZE = 100
const ELEVATION_MAX_ATTEMPTS = 4

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)) }

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).reduce((acc, cur, i, arr) => {
      if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1]])
      return acc
    }, [])
  )
  for (const req of ['slug', 'label', 'lat', 'lon', 'radius']) {
    if (!args[req]) throw new Error(`--${req} fehlt`)
  }
  const lat = Number(args.lat)
  const lon = Number(args.lon)
  const radiusKm = Number(args.radius)
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(radiusKm) || radiusKm <= 0) {
    throw new Error('lat/lon/radius muessen gueltige Zahlen sein; radius > 0')
  }
  return { slug: args.slug, label: args.label, lat, lon, radiusKm, body: args.body ?? 'earth' }
}

function boundsFor(lat, lon, radiusKm) {
  const dLat = radiusKm / 111.32
  const dLon = radiusKm / (111.32 * Math.cos(lat * Math.PI / 180))
  return { south: lat - dLat, west: lon - dLon, north: lat + dLat, east: lon + dLon }
}

function perpDistance(p, a, b) {
  const dx = b.lon - a.lon, dy = b.lat - a.lat
  const len = Math.hypot(dx, dy) || 1e-9
  return Math.abs((p.lon - a.lon) * dy - (p.lat - a.lat) * dx) / len
}

function simplify(points, tolerance = 0.00015) {
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

function capLinePoints(points) {
  const simplified = simplify(points)
  if (simplified.length <= MAX_POINTS_PER_WAY) return simplified
  const step = simplified.length / MAX_POINTS_PER_WAY
  const out = []
  for (let i = 0; i < MAX_POINTS_PER_WAY; i++) out.push(simplified[Math.floor(i * step)])
  return out
}

function capPolygonPoints(points) {
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

function buildCombinedQuery(bounds) {
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

async function fetchOverpass(bounds) {
  const query = buildCombinedQuery(bounds)
  const failures = []
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'NOXIA/0.1 region-import-cli' },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
      })
      if (!response.ok) {
        failures.push(`${new URL(endpoint).host}: HTTP ${response.status}`)
        continue
      }
      const json = await response.json()
      return { elements: json.elements ?? [], source: `overpass:${new URL(endpoint).host}` }
    } catch (err) {
      failures.push(`${new URL(endpoint).host}: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      clearTimeout(timeout)
    }
  }
  throw new Error(`Overpass fehlgeschlagen: ${failures.join('; ')}`)
}

function classify(tags, isNode = false) {
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

function geometryFeature(cls, raw, properties) {
  const points = raw.filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lon))
  if (points.length < 2) return null
  const isPolygon = points.length > 3 && points[0].lat === points.at(-1).lat && points[0].lon === points.at(-1).lon
  const capped = isPolygon ? capPolygonPoints(points) : capLinePoints(points)
  return { feature_type: cls, geometry: { kind: isPolygon ? 'polygon' : 'line', coordinates: capped }, properties }
}

function toFeatures(elements) {
  const out = []
  for (const el of elements) {
    const properties = el.tags ?? {}
    const cls = classify(properties, el.type === 'node')
    if (!cls) continue
    if (el.type === 'node') {
      if (Number.isFinite(el.lat) && Number.isFinite(el.lon)) {
        out.push({ feature_type: cls, geometry: { kind: 'point', coordinates: { lat: el.lat, lon: el.lon } }, properties })
      }
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

async function fetchElevationResponse(url) {
  let lastStatus = 0
  for (let attempt = 1; attempt <= ELEVATION_MAX_ATTEMPTS; attempt++) {
    const response = await fetch(url)
    if (response.ok) return response
    lastStatus = response.status
    if ((response.status !== 429 && response.status < 500) || attempt === ELEVATION_MAX_ATTEMPTS) break
    const retryAfter = Number(response.headers.get('retry-after'))
    const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 750 * 2 ** (attempt - 1)
    await sleep(delay)
  }
  throw new Error(`Elevation-Quelle: HTTP ${lastStatus || 'network error'}`)
}

async function fetchElevationGrid(bounds, targetResolutionM = 200) {
  const midLat = (bounds.south + bounds.north) / 2
  const metresPerLat = 111_320
  const metresPerLon = Math.max(1, metresPerLat * Math.cos(midLat * Math.PI / 180))
  const widthM = Math.max(1, (bounds.east - bounds.west) * metresPerLon)
  const heightM = Math.max(1, (bounds.north - bounds.south) * metresPerLat)
  const cols = Math.max(3, Math.min(18, Math.ceil(widthM / targetResolutionM) + 1))
  const rows = Math.max(3, Math.min(18, Math.ceil(heightM / targetResolutionM) + 1))
  const points = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) points.push({
    lat: bounds.north - (r / (rows - 1)) * (bounds.north - bounds.south),
    lon: bounds.west + (c / (cols - 1)) * (bounds.east - bounds.west),
  })

  const values = []
  for (let start = 0; start < points.length; start += ELEVATION_BATCH_SIZE) {
    const batch = points.slice(start, start + ELEVATION_BATCH_SIZE)
    const params = new URLSearchParams({
      latitude: batch.map(p => p.lat.toFixed(6)).join(','),
      longitude: batch.map(p => p.lon.toFixed(6)).join(','),
    })
    const response = await fetchElevationResponse(`${ELEVATION_ENDPOINT}?${params}`)
    const json = await response.json()
    if (!Array.isArray(json.elevation) || json.elevation.length !== batch.length) throw new Error('Elevation-Quelle: ungueltige Antwort')
    values.push(...json.elevation.map(Number))
    if (start + ELEVATION_BATCH_SIZE < points.length) await sleep(250)
  }
  return { rows, cols, resolutionM: 90, grid: values }
}

async function main() {
  const { slug, label, lat, lon, radiusKm, body } = parseArgs()
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen in der Umgebung')
  const supabase = createClient(supabaseUrl, serviceKey)
  const bounds = boundsFor(lat, lon, radiusKm)

  console.log(`Lade Kartendaten fuer ${label} (${slug}) ...`)
  const loaded = await fetchOverpass(bounds)
  const prepared = toFeatures(loaded.elements)
  if (!prepared.length) throw new Error('Keine verwertbaren Kartenfeatures geladen')

  const counts = {}
  for (const feature of prepared) counts[feature.feature_type] = (counts[feature.feature_type] ?? 0) + 1
  console.log('Features:', counts)

  const { data: region, error: regionError } = await supabase
    .from('celestial_regions')
    .upsert({
      body, slug, label,
      center_lat: lat, center_lon: lon, radius_km: radiusKm,
      bounds, source: loaded.source, imported_at: new Date().toISOString(),
    }, { onConflict: 'slug' })
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
  console.log(`Kartendaten gespeichert: ${rows.length} Features`)

  try {
    console.log('Importiere Hoehenraster ...')
    const elevation = await fetchElevationGrid(bounds)
    const { error: elevationDeleteError } = await supabase.from('region_elevation').delete().eq('region_id', region.id)
    if (elevationDeleteError) throw elevationDeleteError
    const { error } = await supabase.from('region_elevation').insert({
      region_id: region.id,
      resolution_m: elevation.resolutionM,
      rows: elevation.rows,
      cols: elevation.cols,
      origin_lat: bounds.north,
      origin_lon: bounds.west,
      grid: elevation.grid,
    })
    if (error) throw error
    console.log(`Hoehenraster gespeichert: ${elevation.rows}x${elevation.cols}`)
  } catch (err) {
    console.error('Hoehenraster-Import fehlgeschlagen:', err instanceof Error ? err.message : String(err))
  }
}

main().catch(err => { console.error(err); process.exit(1) })
