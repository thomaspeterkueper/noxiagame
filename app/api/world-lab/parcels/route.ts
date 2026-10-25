// app/api/world-lab/parcels/route.ts
// Flurstücke für die Erdkarte aus den Katastern der Länder holen (WFS ALKIS
// Vereinfacht, Liste und Lizenzen in lib/worldlab/alkis.ts) und speichern – je
// Zelle (~450 × 420 m) einmal. An Landesgrenzen fragen wir beide Länder.
//
// POST { lat, lon } (angemeldet): Zelle um den Punkt holen, falls noch nicht da.
// GET  ?lat=…&lon=…&dry=1: nur abrufen und lesen, nichts speichern – zur Prüfung des Dienstes.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { cadastreServicesAt, cadastreSource, parcelCell, parcelLabel, parcelRequestUrl, parcelUsage, parseParcels, type CadastreService, type Parcel } from '@/lib/worldlab/alkis'

export const maxDuration = 60
const PAGE = 1000, MAX_PAGES = 4, TIMEOUT_MS = 20_000

type Found = Parcel & { source: string }

async function fetchFrom(service: CadastreService, cell: ReturnType<typeof parcelCell>) {
  const parcels: Found[] = []
  let sample = ''
  for (let page = 0; page < MAX_PAGES; page++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const response = await fetch(parcelRequestUrl(cell, page * PAGE, PAGE, service), { signal: controller.signal, headers: { Accept: 'application/gml+xml, application/xml, text/xml' } })
      const text = await response.text()
      if (!sample) sample = text.slice(0, 600)
      if (!response.ok) throw new Error(`ALKIS HTTP ${response.status}: ${text.slice(0, 200)}`)
      if (/ExceptionReport/.test(text)) throw new Error('ALKIS: ' + (text.match(/<(?:\w+:)?ExceptionText>([^<]{0,300})/)?.[1] ?? text.slice(0, 200)))
      const found = parseParcels(text, service.zone)
      parcels.push(...found.map(parcel => ({ ...parcel, source: cadastreSource(service) })))
      // Weniger als eine volle Seite: fertig
      const returned = Math.max(Number(text.match(/numberReturned="(\d+)"/)?.[1] ?? 0), found.length)
      if (returned < PAGE) break
    } finally { clearTimeout(timer) }
  }
  return { parcels, sample }
}

/** Alle Länder, die die Zelle berühren; ein Ausfall eines Landes wird gemeldet. */
async function fetchCell(cell: ReturnType<typeof parcelCell>) {
  const centre = { lat: (cell.south + cell.north) / 2, lon: (cell.west + cell.east) / 2 }
  const services = cadastreServicesAt(centre)
  const results = await Promise.allSettled(services.map(service => fetchFrom(service, cell)))
  const parcels = results.flatMap(result => result.status === 'fulfilled' ? result.value.parcels : [])
  const errors = results.flatMap((result, i) => result.status === 'rejected' ? [`${services[i].key}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`] : [])
  const sample = results.map(result => result.status === 'fulfilled' ? result.value.sample : '').find(Boolean) ?? ''
  return { parcels, errors, sample, services: services.map(service => service.key) }
}

function rowsFor(parcels: Found[]) {
  const seen = new Set<string>()
  return parcels.flatMap(parcel => {
    if (seen.has(parcel.id)) return []
    seen.add(parcel.id)
    const lats = parcel.ring.map(p => p.lat), lons = parcel.ring.map(p => p.lon)
    const area = Number(parcel.props.flaeche ?? parcel.props.amtlflsfl ?? '')
    return [{
      id: parcel.id, source: parcel.source, ring: parcel.ring,
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
  const cell = parcelCell({ lat, lon })
  const services = cadastreServicesAt({ lat, lon })
  if (!services.length) return NextResponse.json({ error: 'kein offenes Kataster an diesem Ort' })
  try {
    const { parcels, sample, errors } = await fetchCell(cell)
    return NextResponse.json({ cell, services: services.map(service => service.key), errors, url: parcelRequestUrl(cell, 0, 1000, services[0]), count: parcels.length, first: parcels[0] ? { id: parcels[0].id, label: parcelLabel(parcels[0].props), usage: parcelUsage(parcels[0].props), points: parcels[0].ring.length, keys: Object.keys(parcels[0].props) } : null, sample: parcels.length ? undefined : sample })
  } catch (error) {
    return NextResponse.json({ cell, error: error instanceof Error ? error.message : String(error) })
  }
}

export async function POST(req: NextRequest) {
  if (!await verifiedBearerUserId(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { lat?: number; lon?: number }
  const point = { lat: Number(body.lat), lon: Number(body.lon) }
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) return NextResponse.json({ error: 'lat/lon fehlt' }, { status: 400 })
  if (!cadastreServicesAt(point).length) return NextResponse.json({ ok: true, outside: true, parcels: 0 })
  const cell = parcelCell(point)
  const supabase = createServiceClient()
  const { data: known } = await supabase.from('earth_parcel_cells').select('cell,parcels,error,fetched_at').eq('cell', cell.key).maybeSingle()
  // Erfolgreich geholte Zellen bleiben; gescheiterte frühestens nach einer Stunde erneut.
  if (known && (!known.error || Date.now() - Date.parse(known.fetched_at) < 3600_000)) return NextResponse.json({ ok: !known.error, cached: true, parcels: known.parcels, error: known.error ?? undefined })
  try {
    const { parcels, errors } = await fetchCell(cell)
    // Alle Länder ausgefallen: nichts speichern, später neu versuchen
    if (errors.length && !parcels.length) throw new Error(errors.join(' | '))
    const rows = rowsFor(parcels)
    for (let i = 0; i < rows.length; i += 300) {
      const { error } = await supabase.from('earth_parcels').upsert(rows.slice(i, i + 300), { onConflict: 'id' })
      if (error) throw error
    }
    // Ein Land ausgefallen: Gefundenes bleibt, die Zelle gilt als fehlerhaft und wird nach einer Stunde neu geholt.
    await supabase.from('earth_parcel_cells').upsert({ cell: cell.key, parcels: rows.length, error: errors.length ? errors.join(' | ').slice(0, 500) : null, fetched_at: new Date().toISOString() })
    return NextResponse.json({ ok: true, cached: false, parcels: rows.length, partial: errors.length > 0 || undefined })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[world-lab parcels]', cell.key, message)
    await supabase.from('earth_parcel_cells').upsert({ cell: cell.key, parcels: 0, error: message.slice(0, 500), fetched_at: new Date().toISOString() })
    return NextResponse.json({ ok: false, error: 'Kataster gerade nicht erreichbar.' })
  }
}
