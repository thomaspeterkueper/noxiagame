#!/usr/bin/env node
// scripts/import-earth-region.mjs
// Erstellt: 16.09.2026
//
// Importiert einen Kartenausschnitt der echten Erde (via Overpass API),
// vereinfacht ihn (grobe Kategorien statt Einzelgebaeude, Geometrie-
// Reduktion) und schreibt ihn in celestial_regions/region_features.
// Ersetzt die vorherige Live-Abfrage bei jedem Kartenaufruf (Grund:
// Rate-Limits, teils 10+MB-Antworten, keine Verfuegbarkeitsgarantie).
//
// Aufruf:
//   node scripts/import-earth-region.mjs \
//     --slug earth-sauerland --label "Sauerland" \
//     --lat 51.325 --lon 8.005 --radius 3
//
// Benoetigt SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY in der Umgebung.
//
// Absichtlich NICHT importiert: einzelne Gebaeude-Polygone (`building`)
// und einzelne Amenities (`public`) -- das war die Hauptursache fuer die
// riesigen Antwortgroessen bei kaum zusaetzlichem Spielwert. Stattdessen
// grobe Flaechenkategorien: water, forest, farmland, urban, industrial,
// road (nur Hauptstrassen), rail, settlement (Ortsnamen als Punkte).

import { createClient } from '@supabase/supabase-js'

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter'
const MAX_POINTS_PER_WAY = 40 // Geometrie-Reduktion: mehr Punkte bringen auf dieser Zoomstufe nichts

const CLASS_QUERIES = {
  water:      b => `way[natural=water](${b});way[water](${b});relation[natural=water](${b});`,
  forest:     b => `way[landuse=forest](${b});way[natural=wood](${b});relation[landuse=forest](${b});`,
  farmland:   b => `way[landuse~"farmland|farmyard|meadow|orchard"](${b});`,
  urban:      b => `way[landuse~"residential|commercial|retail"](${b});relation[landuse~"residential|commercial|retail"](${b});`,
  industrial: b => `way[landuse=industrial](${b});`,
  road:       b => `way[highway~"motorway|trunk|primary|secondary"](${b});`,
  rail:       b => `way[railway](${b});`,
  settlement: b => `node[place~"city|town|village|hamlet"](${b});`,
}

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
  return {
    slug: args.slug,
    label: args.label,
    lat: Number(args.lat),
    lon: Number(args.lon),
    radiusKm: Number(args.radius),
    body: args.body ?? 'earth',
  }
}

function boundsFor(lat, lon, radiusKm) {
  const dLat = radiusKm / 111.32
  const dLon = radiusKm / (111.32 * Math.cos(lat * Math.PI / 180))
  return { south: lat - dLat, west: lon - dLon, north: lat + dLat, east: lon + dLon }
}

// Douglas-Peucker-Vereinfachung, damit Linien/Polygone nicht jeden
// OSM-Stuetzpunkt mitschleppen.
function simplify(points, tolerance = 0.00015) {
  if (points.length <= 2) return points
  let maxDist = 0, index = 0
  const [p1, p2] = [points[0], points[points.length - 1]]
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDistance(points[i], p1, p2)
    if (d > maxDist) { maxDist = d; index = i }
  }
  if (maxDist > tolerance) {
    const left = simplify(points.slice(0, index + 1), tolerance)
    const right = simplify(points.slice(index), tolerance)
    return [...left.slice(0, -1), ...right]
  }
  return [p1, p2]
}

function perpDistance(p, a, b) {
  const dx = b.lon - a.lon, dy = b.lat - a.lat
  const len = Math.hypot(dx, dy) || 1e-9
  return Math.abs((p.lon - a.lon) * dy - (p.lat - a.lat) * dx) / len
}

function capPoints(points) {
  const simplified = simplify(points)
  if (simplified.length <= MAX_POINTS_PER_WAY) return simplified
  const step = simplified.length / MAX_POINTS_PER_WAY
  const out = []
  for (let i = 0; i < MAX_POINTS_PER_WAY; i++) out.push(simplified[Math.floor(i * step)])
  return out
}

async function fetchClass(cls, bounds) {
  const b = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`
  const q = `[out:json][timeout:60];(${CLASS_QUERIES[cls](b)});out geom;`
  const res = await fetch(OVERPASS_ENDPOINT, { method: 'POST', body: 'data=' + encodeURIComponent(q) })
  if (!res.ok) throw new Error(`Overpass ${cls}: HTTP ${res.status}`)
  const data = await res.json()
  return data.elements ?? []
}

function toFeatures(cls, elements) {
  const out = []
  for (const el of elements) {
    if (el.type === 'node') {
      if (!Number.isFinite(el.lat) || !Number.isFinite(el.lon)) continue
      out.push({
        feature_type: cls,
        geometry: { kind: 'point', coordinates: { lat: el.lat, lon: el.lon } },
        properties: el.tags ?? {},
      })
      continue
    }
    const raw = (el.geometry ?? []).filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lon))
    if (raw.length < 2) continue
    const capped = capPoints(raw)
    const isPolygon = raw.length > 3 && raw[0].lat === raw[raw.length - 1].lat && raw[0].lon === raw[raw.length - 1].lon
    out.push({
      feature_type: cls,
      geometry: { kind: isPolygon ? 'polygon' : 'line', coordinates: capped },
      properties: el.tags ?? {},
    })
  }
  return out
}

async function main() {
  const { slug, label, lat, lon, radiusKm, body } = parseArgs()
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen in der Umgebung')
  const supabase = createClient(supabaseUrl, serviceKey)

  const bounds = boundsFor(lat, lon, radiusKm)
  console.log(`Importiere ${label} (${slug}) — ${Object.keys(CLASS_QUERIES).length} Kategorien, Radius ${radiusKm}km`)

  const { data: region, error: regionError } = await supabase
    .from('celestial_regions')
    .upsert({
      body, slug, label,
      center_lat: lat, center_lon: lon, radius_km: radiusKm,
      bounds, source: 'overpass', imported_at: new Date().toISOString(),
    }, { onConflict: 'slug' })
    .select()
    .single()
  if (regionError) throw regionError

  // Alte Features dieser Region ersetzen (erneuter Import = frischer Stand)
  await supabase.from('region_features').delete().eq('region_id', region.id)

  let totalFeatures = 0
  for (const cls of Object.keys(CLASS_QUERIES)) {
    const elements = await fetchClass(cls, bounds)
    const features = toFeatures(cls, elements).map(f => ({ ...f, region_id: region.id }))
    if (features.length > 0) {
      // In Batches schreiben, falls eine Kategorie sehr viele Features hat
      for (let i = 0; i < features.length; i += 500) {
        const { error } = await supabase.from('region_features').insert(features.slice(i, i + 500))
        if (error) throw error
      }
    }
    console.log(`  ${cls}: ${features.length} Features`)
    totalFeatures += features.length
    await new Promise(r => setTimeout(r, 1500)) // Overpass-freundliches Tempo zwischen Kategorien
  }

  console.log(`Fertig: ${totalFeatures} Features fuer ${label} gespeichert (region_id=${region.id})`)
}

main().catch(err => { console.error(err); process.exit(1) })
