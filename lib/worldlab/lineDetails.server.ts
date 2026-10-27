// lib/worldlab/lineDetails.server.ts
// Hauptstraßen, Kreisverkehre und Gleise in voller Genauigkeit (Thomas, 27.10.2026:
// „teilweise noch Chaos, z. B. beim Bahnhof“). Die Regionsimporte vereinfachen
// diese Linien auf rund 13 m – ein Abstellgleis wird zur Geraden quer über alles,
// ein Kreisel zum Vieleck. Hier holen wir sie je Zelle (~450 × 420 m) einmal aus
// OpenStreetMap und legen sie in earth_line_details ab. Die Kachel nimmt bei
// gleicher OSM-Kennung die genauere Linie (lib/worldlab/simplify.ts).
// Die begehbare Erdszene liest diese Tabelle nicht.

import type { createServiceClient } from '@/lib/supabase/service'
import type { GeoPoint } from './mercator'
import type { SourceFeature } from './simplify'

type Supabase = ReturnType<typeof createServiceClient>
type OverpassWay = { type?: string; id?: number; tags?: Record<string, string>; geometry?: Array<GeoPoint | null> }

const ENDPOINTS = ['https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter']
const TIMEOUT_MS = 12_000
const OSM_API = 'https://api.openstreetmap.org/api/0.6/map'
const WANTED_HIGHWAY = /^(motorway|trunk|primary|secondary|tertiary)(_link)?$/
const WANTED_RAILWAY = /^(rail|light_rail|tram|narrow_gauge|subway)$/
/** Rand um die Zelle, damit Linien an der Zellgrenze ganz da sind (Grad) */
const MARGIN = 0.0015
const KEEP_TAGS = ['highway', 'railway', 'service', 'junction', 'bridge', 'tunnel', 'layer', 'name', 'usage', 'lanes', 'oneway', 'width']

export function lineDetailQuery(box: { south: number; west: number; north: number; east: number }) {
  const b = [box.south - MARGIN, box.west - MARGIN, box.north + MARGIN, box.east + MARGIN].map(v => v.toFixed(6)).join(',')
  return `[out:json][timeout:15];(way[highway~"^(motorway|trunk|primary|secondary|tertiary)(_link)?$"](${b});way[highway][junction~"^(roundabout|circular)$"](${b});way[railway~"^(rail|light_rail|tram|narrow_gauge|subway)$"](${b}););out tags geom;`
}

/** Overpass-Antwort → Zeilen für earth_line_details (volle Geometrie, höchstens 600 Punkte). */
export function lineDetailRows(elements: OverpassWay[]) {
  return elements.flatMap(element => {
    if (element.type !== 'way' || element.id == null) return []
    const tags = element.tags ?? {}
    const kind = tags.railway ? 'rail' as const : tags.highway ? 'road' as const : null
    if (!kind) return []
    let coords = (element.geometry ?? []).filter((p): p is GeoPoint => Boolean(p) && Number.isFinite(p!.lat) && Number.isFinite(p!.lon))
      .map(p => ({ lat: Math.round(p.lat * 1e7) / 1e7, lon: Math.round(p.lon * 1e7) / 1e7 }))
    if (coords.length < 2) return []
    if (coords.length > 600) { const step = (coords.length - 1) / 599; coords = Array.from({ length: 600 }, (_, i) => coords[Math.round(i * step)]) }
    const props: Record<string, string> = {}
    for (const key of KEEP_TAGS) if (tags[key]) props[key] = tags[key].slice(0, 120)
    const lats = coords.map(p => p.lat), lons = coords.map(p => p.lon)
    return [{ id: `osm:way:${element.id}`, kind, props, coords, min_lat: Math.min(...lats), max_lat: Math.max(...lats), min_lon: Math.min(...lons), max_lon: Math.max(...lons), fetched_at: new Date().toISOString() }]
  })
}

/** OSM-Kartenausschnitt (XML der OSM-API) → Wege mit Geometrie, nur Hauptstraßen, Kreisel, Gleise. */
export function parseOsmMap(xml: string): OverpassWay[] {
  const decode = (v: string) => v.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  const nodes = new Map<string, GeoPoint>()
  for (const m of xml.matchAll(/<node\b([^>]*)\/?>/g)) {
    const id = m[1].match(/\bid="(\d+)"/)?.[1], lat = m[1].match(/\blat="([-\d.]+)"/)?.[1], lon = m[1].match(/\blon="([-\d.]+)"/)?.[1]
    if (id && lat && lon) nodes.set(id, { lat: Number(lat), lon: Number(lon) })
  }
  const ways: OverpassWay[] = []
  for (const m of xml.matchAll(/<way\b[^>]*\bid="(\d+)"[^>]*>([\s\S]*?)<\/way>/g)) {
    const tags: Record<string, string> = {}
    for (const t of m[2].matchAll(/<tag k="([^"]*)" v="([^"]*)"\s*\/>/g)) tags[decode(t[1])] = decode(t[2])
    const wanted = WANTED_RAILWAY.test(tags.railway ?? '') || WANTED_HIGHWAY.test(tags.highway ?? '') || (Boolean(tags.highway) && /^(roundabout|circular)$/.test(tags.junction ?? ''))
    if (!wanted) continue
    const geometry = [...m[2].matchAll(/<nd ref="(\d+)"\s*\/>/g)].map(nd => nodes.get(nd[1]) ?? null)
    ways.push({ type: 'way', id: Number(m[1]), tags, geometry })
  }
  return ways
}

/** Overpass ist oft überlastet: dann der Kartenausschnitt der OSM-API (ein Abruf je Zelle, wenige hundert KB bis wenige MB). */
async function fetchFromOsmApi(box: { south: number; west: number; north: number; east: number }) {
  const bbox = [box.west - MARGIN, box.south - MARGIN, box.east + MARGIN, box.north + MARGIN].map(v => v.toFixed(6)).join(',')
  const response = await fetch(`${OSM_API}?bbox=${bbox}`, { headers: { 'user-agent': 'NOXIA/0.1 world-lab-lines (noxiagame.vercel.app)' }, signal: AbortSignal.timeout(25_000), cache: 'no-store' })
  if (!response.ok) throw new Error('OSM-API HTTP ' + response.status)
  return lineDetailRows(parseOsmMap(await response.text()))
}

/** Erst alle Overpass-Spiegel gleichzeitig (erste gültige Antwort zählt), sonst die OSM-API. */
export async function fetchLineDetails(box: { south: number; west: number; north: number; east: number }) {
  try { return await fetchFromOverpass(box) } catch (overpass) {
    try { return await fetchFromOsmApi(box) } catch (api) {
      throw new Error(`${overpass instanceof Error ? overpass.message : String(overpass)} | ${api instanceof Error ? api.message : String(api)}`)
    }
  }
}

async function fetchFromOverpass(box: { south: number; west: number; north: number; east: number }) {
  const query = lineDetailQuery(box)
  const controllers = ENDPOINTS.map(() => new AbortController())
  const failures: string[] = []
  try {
    return await Promise.any(ENDPOINTS.map(async (endpoint, index) => {
      const timer = setTimeout(() => controllers[index].abort(), TIMEOUT_MS)
      try {
        const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'NOXIA/0.1 world-lab-lines' }, body: new URLSearchParams({ data: query }), signal: controllers[index].signal, cache: 'no-store' })
        if (!response.ok) throw new Error('HTTP ' + response.status)
        const payload = await response.json() as { elements?: OverpassWay[]; remark?: string }
        if (!Array.isArray(payload.elements) || (payload.elements.length === 0 && payload.remark)) throw new Error(payload.remark ?? 'keine Daten')
        return lineDetailRows(payload.elements)
      } catch (error) {
        failures.push(new URL(endpoint).host + ': ' + (error instanceof Error ? error.message : String(error)))
        throw error
      } finally { clearTimeout(timer) }
    }))
  } catch {
    throw new Error('Overpass: ' + failures.join('; '))
  } finally { for (const controller of controllers) controller.abort() }
}

/** Genaue Linien, die einen Ausschnitt berühren – als Kartenobjekte wie aus den Regionen. */
export async function lineDetailFeatures(supabase: Supabase, box: { south: number; west: number; north: number; east: number }): Promise<SourceFeature[]> {
  const { data, error } = await supabase.from('earth_line_details').select('id,kind,props,coords')
    .lte('min_lat', box.north).gte('max_lat', box.south).lte('min_lon', box.east).gte('max_lon', box.west).limit(2000)
  if (error || !data) return []
  return data.map(row => ({
    id: 'line:' + String(row.id),
    featureType: String(row.kind),
    geometry: { kind: 'line' as const, coordinates: row.coords as GeoPoint[] },
    properties: { ...(row.props as Record<string, unknown>), noxia_source_id: String(row.id), noxia_line_detail: true },
  }))
}
