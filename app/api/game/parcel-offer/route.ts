// app/api/game/parcel-offer/route.ts
// Flurstück der Erdkarte ansehen, kaufen, anbieten, teilen, zusammenlegen.
// GET  ?id=…                         (Anmeldung freiwillig: dann „gehört dir“)
// POST { id }                         kaufen – von der Gemeinde oder, wenn ein Spieler es anbietet, von ihm
// POST { action: 'list', id, price }  eigenes Flurstück zum Verkauf anbieten · { action: 'unlist', id } zurückziehen
// POST { action: 'split', id, at: {lat, lon}, direction: 'across'|'along' }  teilen (Vermessungsgebühr)
// POST { action: 'merge', id, with }  mit eigenem Nachbarflurstück zusammenlegen (Vermessungsgebühr)
// Preis, Häuser und neue Grenzen rechnet der Server (lib/worldlab/parcelOffer.server.ts, parcelGeometry.ts).

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { insideRing, parcelOffer } from '@/lib/worldlab/parcelOffer.server'
import { areaM2, boundsOf, centreOf, mergeRings, splitRing, type GeoPoint } from '@/lib/worldlab/parcelGeometry'

/** Vermessungsgebühr für Teilen und Zusammenlegen – geht an die Gemeinde. */
const SURVEY_FEE = 200
/** Kleinstes Flurstück nach dem Teilen (m²). */
const MIN_PART_M2 = 30

const ERRORS: Record<string, [number, string]> = {
  NOXIA_CREDITS_INSUFFICIENT: [400, 'Nicht genug Credits.'],
  NOXIA_PARCEL_OWNED: [409, 'Das Flurstück gehört bereits jemandem.'],
  NOXIA_BUILDING_OWNED: [409, 'Ein Haus darauf gehört bereits jemandem.'],
  NOXIA_PARCEL_NOT_FOUND: [404, 'Flurstück nicht gefunden.'],
  NOXIA_PROPERTY_NOT_OWNED: [403, 'Das Flurstück gehört dir nicht.'],
  NOXIA_LISTING_NOT_FOUND: [409, 'Das Angebot gibt es nicht mehr.'],
  NOXIA_OWN_LISTING: [409, 'Das ist dein eigenes Angebot.'],
  NOXIA_PRICE_CHANGED: [409, 'Der Preis hat sich geändert – bitte neu ansehen.'],
  NOXIA_PRICE_INVALID: [400, 'Ungültiger Preis.'],
  NOXIA_CONSTRUCTION_RUNNING: [409, 'Auf dem Flurstück wird noch gebaut.'],
  NOXIA_SHAPE_INVALID: [400, 'Die neue Grenze passt nicht.'],
}

function failure(message: string, fallback: string) {
  const code = Object.keys(ERRORS).find(key => message.includes(key))
  const [status, text] = code ? ERRORS[code] : [500, fallback]
  if (!code) console.error('[parcel-offer]', message)
  return NextResponse.json({ error: text, code: code ?? null }, { status })
}

const newId = () => 'nx-' + crypto.randomUUID().replace(/-/g, '').slice(0, 16)
const baseLabel = (label: string) => label.replace(/\s+–\s+(Teil \d+|zusammengelegt)$/, '')
function parcelRow(ring: GeoPoint[], label: string, usage: string | null, props: Record<string, unknown>) {
  const centre = centreOf(ring)
  return { id: newId(), ring, centre_lat: centre.lat, centre_lon: centre.lon, ...boundsOf(ring), area_m2: Math.round(areaM2(ring)), label, usage, props }
}

export async function GET(req: NextRequest) {
  const id = String(req.nextUrl.searchParams.get('id') ?? '').slice(0, 64)
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })
  const profileId = req.headers.get('authorization') ? await verifiedBearerUserId(req) : null
  const offer = await parcelOffer(createServiceClient(), id, profileId)
  if (!offer) return NextResponse.json({ error: 'Flurstück nicht gefunden' }, { status: 404 })
  const { items: _items, ...visible } = offer
  void _items
  return NextResponse.json(visible, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { id?: string; action?: string; price?: number; at?: GeoPoint; direction?: string; with?: string }
  const supabase = createServiceClient()
  const id = String(body.id ?? '').slice(0, 64)
  if (!id) return NextResponse.json({ error: 'Flurstück fehlt.' }, { status: 400 })

  if (body.action === 'list' || body.action === 'unlist') {
    const price = body.action === 'list' ? Math.round(Number(body.price)) : null
    if (body.action === 'list' && !(Number.isFinite(price) && price! >= 1)) return NextResponse.json({ error: 'Bitte einen Preis angeben.' }, { status: 400 })
    const { data, error } = await supabase.rpc('list_earth_property', { p_profile_id: profileId, p_kind: 'parcel', p_ref: id, p_price: price })
    if (error) return failure(error.message, 'Angebot fehlgeschlagen.')
    return NextResponse.json(data)
  }

  if (body.action === 'split' || body.action === 'merge') {
    const { data: row } = await supabase.from('earth_parcels').select('id,ring,label,usage,area_m2').eq('id', id).is('retired_at', null).maybeSingle()
    if (!row) return NextResponse.json({ error: 'Flurstück nicht gefunden.' }, { status: 404 })
    const ring = row.ring as GeoPoint[]
    let retire: string[], parts: ReturnType<typeof parcelRow>[]
    if (body.action === 'split') {
      const at = { lat: Number(body.at?.lat), lon: Number(body.at?.lon) }
      if (!Number.isFinite(at.lat) || !Number.isFinite(at.lon) || !insideRing(at, ring)) return NextResponse.json({ error: 'Die Teilungslinie muss durch das Flurstück gehen.' }, { status: 400 })
      const pieces = splitRing(ring, at, body.direction === 'along' ? 'along' : 'across')
      if (!pieces) return NextResponse.json({ error: 'Hier lässt sich das Flurstück nicht teilen.' }, { status: 400 })
      const small = pieces.find(piece => areaM2(piece) < MIN_PART_M2)
      if (small) return NextResponse.json({ error: `Jeder Teil braucht mindestens ${MIN_PART_M2} m².` }, { status: 400 })
      const label = baseLabel(String(row.label ?? 'Flurstück'))
      retire = [id]
      parts = pieces.map((piece, i) => parcelRow(piece, `${label} – Teil ${i + 1}`, row.usage, { split_from: id }))
    } else {
      const otherId = String(body.with ?? '').slice(0, 64)
      if (!otherId || otherId === id) return NextResponse.json({ error: 'Zweites Flurstück fehlt.' }, { status: 400 })
      const { data: other } = await supabase.from('earth_parcels').select('id,ring,label,usage,area_m2').eq('id', otherId).is('retired_at', null).maybeSingle()
      if (!other) return NextResponse.json({ error: 'Zweites Flurstück nicht gefunden.' }, { status: 404 })
      const merged = mergeRings(ring, other.ring as GeoPoint[])
      if (!merged) return NextResponse.json({ error: 'Die Flurstücke haben keine gemeinsame Grenze.' }, { status: 400 })
      const larger = Number(row.area_m2 ?? 0) >= Number(other.area_m2 ?? 0) ? row : other
      retire = [id, otherId]
      parts = [parcelRow(merged, `${baseLabel(String(larger.label ?? 'Flurstück'))} – zusammengelegt`, larger.usage, { merged_from: retire })]
    }
    const { data, error } = await supabase.rpc('reshape_earth_parcels', { p_profile_id: profileId, p_retire: retire, p_new: parts, p_fee: SURVEY_FEE })
    if (error) return failure(error.message, 'Vermessung fehlgeschlagen.')
    return NextResponse.json({ ...(data as object), parcels: parts.map(part => ({ id: part.id, label: part.label, areaM2: part.area_m2 })) })
  }

  const offer = await parcelOffer(supabase, id, profileId)
  if (!offer) return NextResponse.json({ error: 'Flurstück nicht gefunden.' }, { status: 404 })
  if (!offer.forSale || !offer.price) return NextResponse.json({ error: `Nicht verkäuflich: ${offer.reason ?? 'unbekannt'}` }, { status: 409 })
  if (offer.listed) {
    const { data, error } = await supabase.rpc('buy_listed_earth_property', { p_buyer_id: profileId, p_kind: 'parcel', p_ref: offer.id, p_price: Number.isFinite(Number(body.price)) && body.price ? Math.round(Number(body.price)) : offer.price })
    if (error) return failure(error.message, 'Kauf fehlgeschlagen.')
    return NextResponse.json(data)
  }
  const { data, error } = await supabase.rpc('buy_earth_parcel', { p_profile_id: profileId, p_parcel_id: offer.id, p_price: offer.price, p_buildings: offer.items ?? [] })
  if (error) return failure(error.message, 'Kauf fehlgeschlagen.')
  return NextResponse.json(data)
}
