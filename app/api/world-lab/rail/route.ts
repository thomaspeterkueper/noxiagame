// app/api/world-lab/rail/route.ts
// Bahnstrecken um einen Punkt für den Zug der Weltkarte: Hauptgleise (ohne
// Abstell- und Anschlussgleise) aus OpenStreetMap, zu Linien verbunden, jede
// beginnend am Bahnhof, wenn einer an ihrem Ende liegt (z. B. Bahnhof Sundern
// → Richtung Neheim). Nur lesend.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { chainLines, lineLength, metresBetween, startAt, type GeoPoint } from '@/lib/worldlab/railLine'

type Row = { feature_type: string; geometry: { kind?: string; coordinates?: unknown }; properties: Record<string, unknown> | null }

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get('lat')), lon = Number(req.nextUrl.searchParams.get('lon'))
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return NextResponse.json({ error: 'lat/lon fehlt' }, { status: 400 })
  const supabase = createServiceClient()
  const { data: regions } = await supabase.from('celestial_regions').select('id,center_lat,center_lon,radius_km').eq('body', 'earth')
    .gte('center_lat', lat - 0.3).lte('center_lat', lat + 0.3).gte('center_lon', lon - 0.45).lte('center_lon', lon + 0.45)
  const ids = (regions ?? []).filter(region => metresBetween({ lat, lon }, { lat: Number(region.center_lat), lon: Number(region.center_lon) }) <= Number(region.radius_km ?? 0) * 1000 + 20_000).map(region => String(region.id))
  if (!ids.length) return NextResponse.json({ lines: [] })

  const [{ data: rails }, { data: stations }, { data: detailed }] = await Promise.all([
    supabase.from('region_features').select('feature_type,geometry,properties').in('region_id', ids).eq('feature_type', 'rail').limit(2000),
    supabase.from('region_features').select('feature_type,geometry,properties').in('region_id', ids).in('feature_type', ['building', 'landmark']).or('properties->>building.eq.train_station,properties->>railway.eq.station').limit(200),
    // Genaue Gleise (lib/worldlab/lineDetails.server.ts) gehen vor den grob vereinfachten der Regionen
    supabase.from('earth_line_details').select('id,props,coords').eq('kind', 'rail')
      .lte('min_lat', lat + 0.3).gte('max_lat', lat - 0.3).lte('min_lon', lon + 0.45).gte('max_lon', lon - 0.45).limit(2000),
  ])
  // Hauptgleise: Abstell-, Anschluss- und Rangiergleise (service=*) fahren keinen Zug.
  const seen = new Set<string>()
  const fine: Row[] = ((detailed ?? []) as Array<{ id: string; props: Record<string, unknown>; coords: unknown }>).map(row => ({ feature_type: 'rail', geometry: { kind: 'line', coordinates: row.coords }, properties: { ...row.props, noxia_source_id: row.id } }))
  const pieces = [...fine, ...((rails ?? []) as Row[])].flatMap(row => {
    const props = row.properties ?? {}
    const key = String(props.noxia_source_id ?? '')
    if (props.service || props.railway !== 'rail' || (key && seen.has(key))) return []
    seen.add(key)
    const points = Array.isArray(row.geometry?.coordinates) ? (row.geometry.coordinates as GeoPoint[]).filter(p => Number.isFinite(p?.lat) && Number.isFinite(p?.lon)) : []
    return points.length >= 2 ? [points] : []
  })
  const stationList = ((stations ?? []) as Row[]).flatMap(row => {
    const coords = row.geometry?.coordinates
    const ring = Array.isArray(coords) ? coords as GeoPoint[] : coords ? [coords as GeoPoint] : []
    if (!ring.length) return []
    const at = { lat: ring.reduce((s, p) => s + p.lat, 0) / ring.length, lon: ring.reduce((s, p) => s + p.lon, 0) / ring.length }
    return [{ name: String(row.properties?.name ?? 'Bahnhof'), at }]
  })
  const lines = chainLines(pieces).filter(line => lineLength(line) > 300).slice(0, 6).map(line => {
    // Bahnhof an einem Ende (bis 400 m)? Dann beginnt die Linie dort.
    let best: { name: string; at: GeoPoint } | null = null, bestD = 400
    for (const station of stationList) for (const end of [line[0], line[line.length - 1]]) {
      const d = metresBetween(end, station.at)
      if (d < bestD) { bestD = d; best = station }
    }
    const points = best ? startAt(line, best.at) : line
    return { points: points.map(p => ({ lat: Math.round(p.lat * 1e6) / 1e6, lon: Math.round(p.lon * 1e6) / 1e6 })), lengthM: Math.round(lineLength(points)), station: best }
  })
  return NextResponse.json({ lines }, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } })
}
