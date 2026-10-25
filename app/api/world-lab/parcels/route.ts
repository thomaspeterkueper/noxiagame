// app/api/world-lab/parcels/route.ts
// Flurstücke für die Erdkarte aus ALKIS NRW holen (WFS NW ALKIS Vereinfacht,
// Datenlizenz Deutschland – Zero – 2.0) und speichern – je Zelle (~450 × 420 m) einmal.
//
// POST { lat, lon } (angemeldet): Zelle um den Punkt holen, falls noch nicht da.
// GET  ?lat=…&lon=…&dry=1: nur abrufen und lesen, nichts speichern – zur Prüfung des Dienstes.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { inNrw, parcelCell, parcelLabel, parcelRequestUrl, parcelUsage, parseParcels, type Parcel } from '@/lib/worldlab/alkis'

export const maxDuration = 60
const PAGE = 1000, MAX_PAGES = 4, TIMEOUT_MS = 20_000

async function fetchCell(cell: ReturnType<typeof parcelCell>) {
  const parcels: Parcel[] = []
  let sample = ''
  for (let page = 0; page < MAX_PAGES; page++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const response = await fetch(parcelRequestUrl(cell, page * PAGE, PAGE), { signal: controller.signal, headers: { Accept: 'application/gml+xml, application/xml, text/xml' } })
      const text = await response.text()
      if (!sample) sample = text.slice(0, 600)
      if (!response.ok) throw new Error(`ALKIS HTTP ${response.status}: ${text.slice(0, 200)}`)
      if (/ExceptionReport/.test(text)) throw new Error('ALKIS: ' + (text.match(/<(?:\w+:)?ExceptionText>([^<]{0,300})/)?.[1] ?? text.slice(0, 200)))
      const found = parseParcels(text)
      parcels.push(...found)
      // Weniger als eine volle Seite: fertig
      const returned = Number(text.match(/numberReturned="(\d+)"/)?.[1] ?? found.length)
      if (returned < PAGE) break
    } finally { clearTimeout(timer) }
  }
  return { parcels, sample }
}

function rowsFor(parcels: Parcel[]) {
  const seen = new Set<string>()
  return parcels.flatMap(parcel => {
    if (seen.has(parcel.id)) return []
    seen.add(parcel.id)
    const lats = parcel.ring.map(p => p.lat), lons = parcel.ring.map(p => p.lon)
    const area = Number(parcel.props.flaeche ?? parcel.props.amtlflsfl ?? '')
    return [{
      id: parcel.id, source: 'alkis_nw', ring: parcel.ring,
      centre_lat: lats.reduce((a, b) => a + b, 0) / lats.length, centre_lon: lons.reduce((a, b) => a + b, 0) / lons.length,
      min_lat: Math.min(...lats), max_lat: Math.max(...lats), min_lon: Math.min(...lons), max_lon: Math.max(...lons),
      area_m2: Number.isFinite(area) && area > 0 ? Math.round(area) : null,
      label: parcelLabel(parcel.props), usage: parcelUsage(parcel.props), props: parcel.props, fetched_at: new Date().toISOString(),
    }]
  })
}

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get('lat')), lon = Number(req.nextUrl.searchParams.get('lon'))
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return NextResponse.json({ error: 'lat/lon fehlt' }, { status: 400 })
  if (req.nextUrl.searchParams.get('dry') !== '1') return NextResponse.json({ error: 'nur dry=1' }, { status: 400 })
  if (!inNrw({ lat, lon })) return NextResponse.json({ error: 'außerhalb NRW' })
  const cell = parcelCell({ lat, lon })
  try {
    const { parcels, sample } = await fetchCell(cell)
    return NextResponse.json({ cell, url: parcelRequestUrl(cell), count: parcels.length, first: parcels[0] ? { id: parcels[0].id, label: parcelLabel(parcels[0].props), usage: parcelUsage(parcels[0].props), points: parcels[0].ring.length, keys: Object.keys(parcels[0].props) } : null, sample: parcels.length ? undefined : sample })
  } catch (error) {
    return NextResponse.json({ cell, url: parcelRequestUrl(cell), error: error instanceof Error ? error.message : String(error) })
  }
}

export async function POST(req: NextRequest) {
  if (!await verifiedBearerUserId(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { lat?: number; lon?: number }
  const point = { lat: Number(body.lat), lon: Number(body.lon) }
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) return NextResponse.json({ error: 'lat/lon fehlt' }, { status: 400 })
  if (!inNrw(point)) return NextResponse.json({ ok: true, outside: true, parcels: 0 })
  const cell = parcelCell(point)
  const supabase = createServiceClient()
  const { data: known } = await supabase.from('earth_parcel_cells').select('cell,parcels,error,fetched_at').eq('cell', cell.key).maybeSingle()
  // Erfolgreich geholte Zellen bleiben; gescheiterte frühestens nach einer Stunde erneut.
  if (known && (!known.error || Date.now() - Date.parse(known.fetched_at) < 3600_000)) return NextResponse.json({ ok: !known.error, cached: true, parcels: known.parcels, error: known.error ?? undefined })
  try {
    const { parcels } = await fetchCell(cell)
    const rows = rowsFor(parcels)
    for (let i = 0; i < rows.length; i += 300) {
      const { error } = await supabase.from('earth_parcels').upsert(rows.slice(i, i + 300), { onConflict: 'id' })
      if (error) throw error
    }
    await supabase.from('earth_parcel_cells').upsert({ cell: cell.key, parcels: rows.length, error: null, fetched_at: new Date().toISOString() })
    return NextResponse.json({ ok: true, cached: false, parcels: rows.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[world-lab parcels]', cell.key, message)
    await supabase.from('earth_parcel_cells').upsert({ cell: cell.key, parcels: 0, error: message.slice(0, 500), fetched_at: new Date().toISOString() })
    return NextResponse.json({ ok: false, error: 'Kataster gerade nicht erreichbar.' })
  }
}
