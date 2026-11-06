// lib/worldlab/busLines.server.ts
// Aktualisiert: 06.11.2026 — Buslinien aus OpenStreetMap (relation route=bus) je Gegend holen und in earth_bus_routes ablegen
// Version:      1.0.0
//
// Eine Buslinie ist in OSM eine Relation mit den befahrenen Wegen und den
// Haltestellen als Mitglieder. Overpass liefert mit `out geom` die Geometrie
// aller Mitglieder; die Wege werden zu einer Linie verbunden (chainLines), die
// Haltestellen darauf gelegt (placeStops). Geholt wird je Rasterzelle von 0,1°
// einmal; danach kommt alles aus der Tabelle.

import type { createServiceClient } from '@/lib/supabase/service'
import { chainLines, lineLength, type GeoPoint } from './railLine'
import { placeStops, type BusLine } from './busLine'

type Supabase = ReturnType<typeof createServiceClient>
type Member = { type: 'way' | 'node' | 'relation'; ref: number; role?: string; geometry?: Array<GeoPoint | null>; lat?: number; lon?: number }
type Relation = { type?: string; id?: number; tags?: Record<string, string>; members?: Member[] }
type Node = { type?: string; id?: number; tags?: Record<string, string>; lat?: number; lon?: number }

const ENDPOINTS = ['https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter']
const TIMEOUT_MS = 20_000
/** Umkreis je Abruf (m) – eine Zelle von 0,1° ist rund 11 × 7 km. */
const AROUND_M = 9000

export function busCellKey(lat: number, lon: number) {
  return `${Math.floor(lat * 10)}:${Math.floor(lon * 10)}`
}

export function busRouteQuery(lat: number, lon: number) {
  return `[out:json][timeout:25];relation[type=route][route=bus](around:${AROUND_M},${lat.toFixed(5)},${lon.toFixed(5)});out geom;`
}

/** Overpass-Antwort → Linien mit Haltestellen. Linien ohne zusammenhängende Strecke (< 500 m) fallen weg. */
export function busRoutesFromOverpass(elements: Array<Relation | Node>): BusLine[] {
  const nodeNames = new Map<number, string>()
  for (const element of elements) if (element.type === 'node' && element.id != null && (element as Node).tags?.name) nodeNames.set(element.id, String((element as Node).tags!.name))
  const out: BusLine[] = []
  for (const element of elements) {
    if (element.type !== 'relation' || element.id == null) continue
    const relation = element as Relation
    const tags = relation.tags ?? {}
    const pieces: GeoPoint[][] = []
    const stops: Array<{ name: string; at: GeoPoint }> = []
    for (const member of relation.members ?? []) {
      if (member.type === 'way' && !/^(platform|stop)/.test(member.role ?? '')) {
        const pts = (member.geometry ?? []).filter((p): p is GeoPoint => Boolean(p) && Number.isFinite(p!.lat) && Number.isFinite(p!.lon))
        if (pts.length >= 2) pieces.push(pts)
      } else if (member.type === 'node' && Number.isFinite(member.lat) && Number.isFinite(member.lon) && /^(stop|platform)/.test(member.role ?? '')) {
        stops.push({ name: nodeNames.get(member.ref) ?? 'Haltestelle', at: { lat: member.lat!, lon: member.lon! } })
      }
    }
    const chains = chainLines(pieces, 30)
    const points = chains[0]
    if (!points || lineLength(points) < 500) continue
    const name = tags.ref ? `Linie ${tags.ref}` : tags.name ?? `Bus ${relation.id}`
    const rounded = points.map(p => ({ lat: Math.round(p.lat * 1e6) / 1e6, lon: Math.round(p.lon * 1e6) / 1e6 }))
    out.push({ id: `osm:relation:${relation.id}`, name: name.slice(0, 80), points: rounded, lengthM: Math.round(lineLength(rounded)), stops: placeStops(rounded, stops) })
  }
  return out
}

async function fetchFromOverpass(lat: number, lon: number): Promise<BusLine[]> {
  const query = busRouteQuery(lat, lon)
  const controllers = ENDPOINTS.map(() => new AbortController())
  const failures: string[] = []
  try {
    return await Promise.any(ENDPOINTS.map(async (endpoint, index) => {
      const timer = setTimeout(() => controllers[index].abort(), TIMEOUT_MS)
      try {
        const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'NOXIA/0.1 world-lab-bus' }, body: new URLSearchParams({ data: query }), signal: controllers[index].signal, cache: 'no-store' })
        if (!response.ok) throw new Error('HTTP ' + response.status)
        const payload = await response.json() as { elements?: Array<Relation | Node>; remark?: string }
        if (!Array.isArray(payload.elements) || (payload.elements.length === 0 && payload.remark)) throw new Error(payload.remark ?? 'keine Daten')
        return busRoutesFromOverpass(payload.elements)
      } catch (error) {
        failures.push(new URL(endpoint).host + ': ' + (error instanceof Error ? error.message : String(error)))
        throw error
      } finally { clearTimeout(timer) }
    }))
  } catch {
    throw new Error('Overpass: ' + failures.join('; '))
  } finally { for (const controller of controllers) controller.abort() }
}

/** Linien um einen Punkt: aus der Tabelle, beim ersten Mal je Zelle aus OpenStreetMap. */
export async function busLinesAround(supabase: Supabase, lat: number, lon: number): Promise<{ lines: BusLine[]; error?: string }> {
  const cell = busCellKey(lat, lon)
  const { data: known } = await supabase.from('earth_bus_cells').select('cell,fetched_at,error').eq('cell', cell).maybeSingle()
  let error: string | undefined
  // Fehlgeschlagene Abrufe nach einer Stunde noch einmal versuchen
  const stale = known?.error && Date.now() - new Date(String(known.fetched_at)).getTime() > 3_600_000
  if (!known || stale) {
    try {
      const lines = await fetchFromOverpass(lat, lon)
      if (lines.length) {
        const rows = lines.map(line => {
          const lats = line.points.map(p => p.lat), lons = line.points.map(p => p.lon)
          return { id: line.id, name: line.name, props: {}, coords: line.points, stops: line.stops, length_m: line.lengthM, min_lat: Math.min(...lats), max_lat: Math.max(...lats), min_lon: Math.min(...lons), max_lon: Math.max(...lons), fetched_at: new Date().toISOString() }
        })
        await supabase.from('earth_bus_routes').upsert(rows, { onConflict: 'id' })
      }
      await supabase.from('earth_bus_cells').upsert({ cell, routes: lines.length, error: null, fetched_at: new Date().toISOString() }, { onConflict: 'cell' })
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught)
      await supabase.from('earth_bus_cells').upsert({ cell, routes: 0, error: error.slice(0, 500), fetched_at: new Date().toISOString() }, { onConflict: 'cell' })
    }
  }
  const { data } = await supabase.from('earth_bus_routes').select('id,name,coords,stops,length_m')
    .lte('min_lat', lat + 0.12).gte('max_lat', lat - 0.12).lte('min_lon', lon + 0.18).gte('max_lon', lon - 0.18).limit(40)
  const lines: BusLine[] = (data ?? []).map(row => ({ id: String(row.id), name: String(row.name), points: row.coords as GeoPoint[], lengthM: Number(row.length_m), stops: (row.stops ?? []) as BusLine['stops'] }))
  return { lines, error }
}
