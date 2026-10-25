// app/api/game/parcel-offer/route.ts
// Flurstück der Erdkarte ansehen und kaufen (samt Häusern und Bewohnern darauf).
// GET ?id=… (Anmeldung freiwillig: dann „gehört dir“) · POST { id } kaufen.
// Preis und Häuser rechnet der Server (lib/worldlab/parcelOffer.server.ts).

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { parcelOffer } from '@/lib/worldlab/parcelOffer.server'

const ERRORS: Record<string, [number, string]> = {
  NOXIA_CREDITS_INSUFFICIENT: [400, 'Nicht genug Credits.'],
  NOXIA_PARCEL_OWNED: [409, 'Das Flurstück gehört bereits jemandem.'],
  NOXIA_BUILDING_OWNED: [409, 'Ein Haus darauf gehört bereits jemandem.'],
  NOXIA_PARCEL_NOT_FOUND: [404, 'Flurstück nicht gefunden.'],
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
  const body = await req.json().catch(() => ({})) as { id?: string }
  const supabase = createServiceClient()
  const offer = body.id ? await parcelOffer(supabase, String(body.id).slice(0, 64), profileId) : null
  if (!offer) return NextResponse.json({ error: 'Flurstück nicht gefunden.' }, { status: 404 })
  if (!offer.forSale || !offer.price) return NextResponse.json({ error: `Nicht verkäuflich: ${offer.reason ?? 'unbekannt'}` }, { status: 409 })
  const { data, error } = await supabase.rpc('buy_earth_parcel', { p_profile_id: profileId, p_parcel_id: offer.id, p_price: offer.price, p_buildings: offer.items ?? [] })
  if (error) {
    const code = Object.keys(ERRORS).find(key => error.message.includes(key))
    const [status, text] = code ? ERRORS[code] : [500, 'Kauf fehlgeschlagen.']
    console.error('[parcel-offer]', error.message)
    return NextResponse.json({ error: text }, { status })
  }
  return NextResponse.json(data)
}
