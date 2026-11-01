// app/api/world-lab/parcels/route.ts
// Flurstücke für die Erdkarte aus den Katastern der Länder holen (WFS ALKIS
// Vereinfacht, Liste und Lizenzen in lib/worldlab/alkis.ts) und speichern – je
// Zelle (~450 × 420 m) einmal. An Landesgrenzen fragen wir beide Länder.
//
// POST { lat, lon } (angemeldet): Zelle um den Punkt holen, falls noch nicht da.
// GET  ?lat=…&lon=…&dry=1: nur abrufen und lesen, nichts speichern – zur Prüfung des Dienstes.

import { NextRequest, NextResponse } from 'next/server'
import { PARCEL_INITIAL_IMPORT_UPSERT } from '@/lib/worldlab/parcelImportPolicy'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { cadastreServicesAt, cadastreSource, parcelCell, parcelKey, parcelLabel, parcelRequestUrl, parcelUsage, parseParcels, parseUsePieces, usesByParcel, type CadastreService, type Parcel, type ParcelUsePiece } from '@/lib/worldlab/alkis'

/** Zellen dieser Fassung haben Nutzungsart und -bezeichnung je Flurstück (NOXIA-MAT-0001); ältere werden einmal neu geholt. */
// v3: Kennzeichen beim Zuordnen vereinheitlicht (Hessen hatte keine Nutzung, 28.10.2026) – Zellen werden einmal neu geholt.
const CELL_VERSION = 'v3-nutzung'

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
  // Nutzung je Flurstück (Wald/Nadelholz, Landwirtschaft/Grünland …), wo der Dienst sie anbietet.
  // Fehlt sie, bleiben die Flurstücke trotzdem (Nutzung dann aus tntxt oder unbekannt).
  if (service.usageLayer && parcels.length) {
    try {
      const pieces: ParcelUsePiece[] = []
      for (let page = 0; page < MAX_PAGES; page++) {
        const response = await fetch(parcelRequestUrl(cell, page * PAGE, PAGE, service, 'ave:NutzungFlurstueck'), { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: 'application/gml+xml, application/xml, text/xml' } })
        const text = await response.text()
        if (!response.ok || /ExceptionReport/.test(text)) break
        const found = parseUsePieces(text)
        pieces.push(...found)
        if (Math.max(Number(text.match(/numberReturned="(\d+)"/)?.[1] ?? 0), found.length) < PAGE) break
      }
      const uses = usesByParcel(pieces)
      for (const parcel of parcels) {
        const list = uses.get(parcelKey(parcel.props.flstkennz ?? parcel.id))
        if (!list?.length) continue
        parcel.props.nutzart = list[0].art
        if (list[0].bez) parcel.props.nutzbez = list[0].bez
        parcel.props.nutzung = list.slice(0, 5).map(use => `${use.art}${use.bez ? '/' + use.bez : ''}:${Math.round(use.m2)}`).join('|')
      }
    } catch (error) { console.error('[world-lab parcels] Nutzung', service.key, error instanceof Error ? error.message : error) }
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
      label: parcelLabel(parcel.props), usage: parcel.props.nutzart || parcelUsage(parcel.props), props: parcel.props, fetched_at: new Date().toISOString(),
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
  // &usage=1: nur die Nutzungsschicht prüfen (Hessen lieferte am 28.10.2026 keine Nutzungsart)
  if (req.nextUrl.searchParams.get('usage') === '1') {
    const out: Array<Record<string, unknown>> = []
    for (const service of services) {
      const url = parcelRequestUrl({ ...cell, north: cell.south + (cell.north - cell.south) / 4, east: cell.west + (cell.east - cell.west) / 4 }, 0, 20, service, 'ave:NutzungFlurstueck')
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: 'application/gml+xml, application/xml, text/xml' } })
        const text = await response.text()
        out.push({ service: service.key, status: response.status, exception: text.match(/<(?:\w+:)?ExceptionText>([^<]{0,300})/)?.[1] ?? null, returned: text.match(/numberReturned="(\d+)"/)?.[1] ?? null, pieces: parseUsePieces(text).slice(0, 3), parcels: parseParcels(await (await fetch(parcelRequestUrl(cell, 0, 3, service), { signal: AbortSignal.timeout(TIMEOUT_MS) })).text(), service.zone).map(parcel => parcel.props.flstkennz ?? parcel.id) })
      } catch (error) { out.push({ service: service.key, error: error instanceof Error ? error.message : String(error) }) }
    }
    return NextResponse.json({ cell, usage: out })
  }
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
  const { data: known } = await supabase.from('earth_parcel_cells').select('cell,parcels,error,fetched_at,source').eq('cell', cell.key).maybeSingle()
  // Erfolgreich geholte Zellen bleiben; gescheiterte frühestens nach einer Stunde erneut; ältere Fassung einmal neu.
  if (known && known.source === CELL_VERSION && (!known.error || Date.now() - Date.parse(known.fetched_at) < 3600_000)) return NextResponse.json({ ok: !known.error, cached: true, parcels: known.parcels, error: known.error ?? undefined })
  try {
    const { parcels, errors } = await fetchCell(cell)
    // Alle Länder ausgefallen: nichts speichern, später neu versuchen
    if (errors.length && !parcels.length) throw new Error(errors.join(' | '))
    const rows = rowsFor(parcels)
    // Preserve every existing cadastral snapshot and any later NOXIA edits.
    // Only previously unknown IDs may be inserted by another provider fetch.
    for (let i = 0; i < rows.length; i += 300) {
      const { error } = await supabase.from('earth_parcels').upsert(rows.slice(i, i + 300), PARCEL_INITIAL_IMPORT_UPSERT)
      if (error) throw error
    }
    // Ein Land ausgefallen: Gefundenes bleibt, die Zelle gilt als fehlerhaft und wird nach einer Stunde neu geholt.
    await supabase.from('earth_parcel_cells').upsert({ cell: cell.key, source: CELL_VERSION, parcels: rows.length, error: errors.length ? errors.join(' | ').slice(0, 500) : null, fetched_at: new Date().toISOString() })
    return NextResponse.json({ ok: true, cached: false, parcels: rows.length, partial: errors.length > 0 || undefined })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[world-lab parcels]', cell.key, message)
    await supabase.from('earth_parcel_cells').upsert({ cell: cell.key, source: CELL_VERSION, parcels: 0, error: message.slice(0, 500), fetched_at: new Date().toISOString() })
    return NextResponse.json({ ok: false, error: 'Kataster gerade nicht erreichbar.' })
  }
}
