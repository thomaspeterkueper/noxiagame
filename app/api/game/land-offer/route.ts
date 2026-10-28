// app/api/game/land-offer/route.ts
// Freies Land abstecken und kaufen, wo es kein offenes Kataster gibt (Thomas, 28.10.2026).
// GET  ?lat=…&lon=…&w=…&d=…&rot=…           Angebot: frei? Preis? Warum nicht?
// POST { lat, lon, w, d, rotation, price }    kaufen – wird ein eigenes Flurstück (earth_parcels, Quelle noxia_land)
// Prüfung und Preis: lib/worldlab/landOffer.server.ts.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { landOffer, LAND_SOURCE, type LandRequest } from '@/lib/worldlab/landOffer.server'
import { areaM2, boundsOf, centreOf } from '@/lib/worldlab/parcelGeometry'

const ERRORS: Record<string, [number, string]> = {
  NOXIA_CREDITS_INSUFFICIENT: [400, 'Nicht genug Credits.'],
  NOXIA_PARCEL_OWNED: [409, 'Das Grundstück gehört bereits jemandem.'],
}

function readRequest(input: { lat?: unknown; lon?: unknown; w?: unknown; d?: unknown; rotation?: unknown; rot?: unknown }): LandRequest | null {
  const at = { lat: Number(input.lat), lon: Number(input.lon) }
  const w = Math.round(Number(input.w)), d = Math.round(Number(input.d))
  const rotation = Number(input.rotation ?? input.rot ?? 0)
  if (![at.lat, at.lon, w, d, rotation].every(Number.isFinite) || Math.abs(at.lat) > 85) return null
  return { at, w, d, rotation: ((rotation % 360) + 360) % 360 }
}

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams)
  const request = readRequest(params)
  if (!request) return NextResponse.json({ error: 'lat, lon, w, d fehlen' }, { status: 400 })
  const offer = await landOffer(createServiceClient(), request)
  return NextResponse.json(offer, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const request = readRequest(body)
  if (!request) return NextResponse.json({ error: 'Lage oder Größe fehlt.' }, { status: 400 })
  const supabase = createServiceClient()
  const offer = await landOffer(supabase, request)
  if (!offer.available || !offer.price) return NextResponse.json({ error: offer.reason ?? 'Hier kann man kein Land kaufen.' }, { status: 409 })
  if (Number(body.price) !== offer.price) return NextResponse.json({ error: 'Der Preis hat sich geändert – bitte neu ansehen.', price: offer.price }, { status: 409 })

  const centre = centreOf(offer.ring)
  const id = 'nl-' + crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  const label = offer.place ? `Grundstück bei ${offer.place}` : 'Abgestecktes Grundstück'
  const { error: insertError } = await supabase.from('earth_parcels').insert({
    id, source: LAND_SOURCE, ring: offer.ring, centre_lat: centre.lat, centre_lon: centre.lon, ...boundsOf(offer.ring),
    area_m2: Math.round(areaM2(offer.ring)), label, usage: offer.usage,
    // Gemeinde: Verwaltungsbezirk für die Steuer beim Weiterverkauf
    props: { gemeinde: offer.place ?? null, abgesteckt: { w: request.w, d: request.d, rotation: request.rotation } },
  })
  if (insertError) { console.error('[land-offer]', insertError.message); return NextResponse.json({ error: 'Grundstück konnte nicht angelegt werden.' }, { status: 500 }) }
  const { data, error } = await supabase.rpc('buy_earth_parcel', { p_profile_id: profileId, p_parcel_id: id, p_price: offer.price, p_buildings: [] })
  if (error) {
    // Kauf gescheitert: das abgesteckte Grundstück wieder entfernen
    await supabase.from('earth_parcels').delete().eq('id', id)
    const code = Object.keys(ERRORS).find(key => error.message.includes(key))
    if (!code) console.error('[land-offer]', error.message)
    const [status, text] = code ? ERRORS[code] : [500, 'Kauf fehlgeschlagen.']
    return NextResponse.json({ error: text }, { status })
  }
  return NextResponse.json({ ...(data as object), parcel: { id, label, areaM2: offer.areaM2 } })
}
