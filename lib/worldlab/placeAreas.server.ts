// lib/worldlab/placeAreas.server.ts
// Friedhöfe nachholen (W-13, 05.11.2026): In Sundern fehlten alle Friedhofsflächen,
// weil die Region noch mit einem älteren Importprofil geladen ist und ihr Neuimport
// regelmäßig an der Zeit scheitert. Hier holen wir je Zelle (~450 × 420 m) nur die
// Friedhöfe aus OpenStreetMap und legen sie als `place_area` in die Region, die den
// Ort umfasst – wie es der volle Import täte. Nichts wird erfunden.

import type { createServiceClient } from '@/lib/supabase/service'

type Supabase = ReturnType<typeof createServiceClient>
type Box = { south: number; west: number; north: number; east: number }
type OverpassWay = { type?: string; id?: number; tags?: Record<string, string>; geometry?: Array<{ lat: number; lon: number } | null> }

const ENDPOINTS = ['https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter']
const TIMEOUT_MS = 15_000
/** Friedhöfe ragen weit über die Zelle hinaus: großzügiger Rand (Grad) */
const MARGIN = 0.004

export function cemeteryQuery(box: Box) {
  const b = [box.south - MARGIN, box.west - MARGIN, box.north + MARGIN, box.east + MARGIN].map(v => v.toFixed(6)).join(',')
  return `[out:json][timeout:20];(way[landuse=cemetery](${b});way[amenity=grave_yard](${b}););out tags geom;`
}

/** Overpass-Wege → Zeilen für region_features (ohne region_id). */
export function cemeteryRows(ways: readonly OverpassWay[]) {
  return ways.flatMap(way => {
    const ring = (way.geometry ?? []).filter((p): p is { lat: number; lon: number } => Boolean(p) && Number.isFinite(p!.lat) && Number.isFinite(p!.lon))
    if (way.type !== 'way' || !way.id || ring.length < 4) return []
    const tags = way.tags ?? {}
    return [{
      feature_type: 'place_area',
      geometry: { kind: 'polygon', coordinates: ring.map(p => ({ lat: Math.round(p.lat * 1e7) / 1e7, lon: Math.round(p.lon * 1e7) / 1e7 })) },
      properties: { visual_class: 'cemetery', ...(tags.name ? { name: tags.name.slice(0, 120) } : {}), ...(tags.religion ? { religion: tags.religion } : {}), noxia_source_id: `osm:way:${way.id}`, noxia_place_detail: true },
    }]
  })
}

export async function fetchCemeteries(box: Box) {
  const query = cemeteryQuery(box)
  const controllers = ENDPOINTS.map(() => new AbortController())
  const failures: string[] = []
  try {
    return await Promise.any(ENDPOINTS.map(async (endpoint, index) => {
      const timer = setTimeout(() => controllers[index].abort(), TIMEOUT_MS)
      try {
        const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'NOXIA/0.1 world-lab-areas' }, body: new URLSearchParams({ data: query }), signal: controllers[index].signal, cache: 'no-store' })
        if (!response.ok) throw new Error('HTTP ' + response.status)
        const payload = await response.json() as { elements?: OverpassWay[]; remark?: string }
        if (!Array.isArray(payload.elements) || (payload.elements.length === 0 && payload.remark)) throw new Error(payload.remark ?? 'keine Daten')
        return cemeteryRows(payload.elements)
      } catch (error) {
        failures.push(new URL(endpoint).host + ': ' + (error instanceof Error ? error.message : String(error)))
        throw error
      } finally { clearTimeout(timer) }
    }))
  } catch {
    throw new Error('Overpass: ' + failures.join('; '))
  } finally { for (const controller of controllers) controller.abort() }
}

/** Region, die den Punkt umfasst (die größte, kein Ortsdetail), für neue Flächen. */
export async function regionFor(supabase: Supabase, point: { lat: number; lon: number }): Promise<string | null> {
  const { data } = await supabase.from('celestial_regions').select('id,center_lat,center_lon,radius_km,source').eq('body', 'earth')
  let best: { id: string; r: number } | null = null
  for (const row of data ?? []) {
    const north = (Number(row.center_lat) - point.lat) * 111_195
    const east = (Number(row.center_lon) - point.lon) * 111_195 * Math.cos(point.lat * Math.PI / 180)
    const r = Number(row.radius_km ?? 0) * 1000
    if (Math.hypot(north, east) > r || r <= 0) continue
    if (!best || r > best.r) best = { id: String(row.id), r }
  }
  return best?.id ?? null
}

/** Friedhöfe der Zelle in die Region legen; schon vorhandene (gleiche OSM-Kennung) werden ersetzt. */
export async function storeCemeteries(supabase: Supabase, regionId: string, rows: ReturnType<typeof cemeteryRows>) {
  if (!rows.length) return 0
  const ids = rows.map(row => row.properties.noxia_source_id)
  const { data: existing } = await supabase.from('region_features').select('id,properties').eq('feature_type', 'place_area').in('properties->>noxia_source_id', ids)
  const known = new Set((existing ?? []).map(row => String((row.properties as Record<string, unknown>)?.noxia_source_id)))
  const fresh = rows.filter(row => !known.has(row.properties.noxia_source_id)).map(row => ({ ...row, region_id: regionId }))
  if (fresh.length) {
    const { error } = await supabase.from('region_features').insert(fresh)
    if (error) throw error
  }
  return fresh.length
}
