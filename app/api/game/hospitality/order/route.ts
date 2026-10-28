// app/api/game/hospitality/order/route.ts
// Aktualisiert: 28.10.2026 — Hauspreise (venue_menu), Toilette als Posten, Eintritt im Nachtclub, Hausregeln ändern (R-18, R-19)
// Version:      1.1.0
// Karte und Bestellung in einem Lokal (NOXIA-FIN-0001).
// GET  ?tileEntityId=…  → Karte mit `affordable` je Posten: Was der Gast nicht
//                         bezahlen kann, ist gar nicht erst bestellbar.
// POST { tileEntityId, itemCode, requestId } → besteuerter Transfer Gast → Betreiber.
//      itemCode 'toilet' → Toilette nach Hausregel (frei, nur für Gäste oder mit Gebühr).
// POST { action: 'set_price', tileEntityId, itemCode, priceCredits | null, active }
//      { action: 'set_service', tileEntityId, service: 'toilet', available, priceCredits, guestsOnly }
//      → Hausregeln ändern; nur der Eigentümer des Hauses (R-18).

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const ERRORS: Record<string, { status: number; error: string }> = {
  NOXIA_CREDITS_INSUFFICIENT: { status: 402, error: 'Dafür reichen deine Credits nicht.' },
  NOXIA_ORDER_ITEM_NOT_OFFERED: { status: 404, error: 'Das steht hier nicht auf der Karte.' },
  NOXIA_ORDER_VENUE_NOT_FOUND: { status: 404, error: 'Lokal nicht gefunden.' },
  NOXIA_ORDER_SELLER_ACCOUNT_MISSING: { status: 409, error: 'Dieses Lokal kann gerade nicht kassieren.' },
  NOXIA_ORDER_REQUEST_CONFLICT: { status: 409, error: 'Diese Bestellung gehört zu einem anderen Konto.' },
  NOXIA_ROOM_NONE_HERE: { status: 404, error: 'Dieses Haus hat keine Gästezimmer.' },
  NOXIA_ROOM_NONE_FREE: { status: 409, error: 'Kein Zimmer frei.' },
  NOXIA_ROOM_ALREADY_BOOKED: { status: 409, error: 'Du hast hier schon ein Zimmer.' },
  NOXIA_ENTRY_REQUIRED: { status: 403, error: 'Erst Eintritt bezahlen.' },
  NOXIA_SERVICE_UNAVAILABLE: { status: 409, error: 'Die Toilette ist hier nicht benutzbar.' },
  NOXIA_SERVICE_GUESTS_ONLY: { status: 403, error: 'Die Toilette ist nur für Gäste.' },
  NOXIA_SERVICE_UNKNOWN: { status: 400, error: 'Diese Dienstleistung gibt es nicht.' },
  NOXIA_VENUE_NOT_OWNED: { status: 403, error: 'Das Haus gehört dir nicht.' },
  NOXIA_PRICE_INVALID: { status: 400, error: 'Ungültiger Preis.' },
}

function mapError(error: any) {
  const code = Object.keys(ERRORS).find((key) => String(error?.message ?? '').includes(key))
  return code ? NextResponse.json({ error: ERRORS[code].error, code }, { status: ERRORS[code].status }) : null
}

/** Karte des Hauses: Karte der Lokalart mit Hauspreisen, abbestellte Posten fehlen (venue_menu). */
async function menuFor(supabase: any, tileEntityId: string) {
  const { data: tile } = await supabase.from('tile_entities').select('id,entity_id,status,entity_type').eq('id', tileEntityId).maybeSingle()
  if (!tile || tile.status !== 'active' || tile.entity_type !== 'building') return null
  const { data: items } = await supabase.rpc('venue_menu', { p_tile_entity_id: tileEntityId })
  return items ?? []
}

export async function GET(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const tileEntityId = new URL(req.url).searchParams.get('tileEntityId') ?? ''
  if (!UUID_RE.test(tileEntityId)) return NextResponse.json({ error: 'tileEntityId fehlt.' }, { status: 400 })

  const supabase = createServiceClient()
  const items = await menuFor(supabase, tileEntityId)
  if (!items) return NextResponse.json({ error: 'Lokal nicht gefunden.' }, { status: 404 })
  const [{ data: profile }, { data: services }, { data: owner }] = await Promise.all([
    supabase.from('profiles').select('credits').eq('id', profileId).maybeSingle(),
    supabase.rpc('venue_service_rules', { p_tile_entity_id: tileEntityId }),
    supabase.rpc('venue_owned_by', { p_profile_id: profileId, p_tile_entity_id: tileEntityId }),
  ])
  const credits = Number(profile?.credits ?? 0)
  return NextResponse.json({
    ok: true,
    credits,
    items: items.map((item: any) => ({
      itemCode: item.item_code, label: item.label, priceCredits: item.price_credits,
      basePriceCredits: item.base_price_credits, housePrice: Boolean(item.house_price),
      affordable: credits >= Number(item.price_credits),
    })),
    services: services ?? null,
    canEditHouse: owner === true,
  })
}

export async function POST(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  if (body?.action === 'set_price' || body?.action === 'set_service') return setHouseRule(profileId, body)
  const tileEntityId = String(body?.tileEntityId ?? '')
  const itemCode = String(body?.itemCode ?? '').slice(0, 64)
  const requestId = String(body?.requestId ?? '')
  if (!UUID_RE.test(tileEntityId) || !itemCode || !UUID_RE.test(requestId)) {
    return NextResponse.json({ error: 'tileEntityId, itemCode und requestId (UUID) sind nötig.' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: tickRow } = await supabase.from('tick_log').select('tick_number').order('tick_number', { ascending: false }).limit(1).maybeSingle()
  const { data, error } = await supabase.rpc('order_hospitality_item', {
    p_profile_id: profileId, p_tile_entity_id: tileEntityId, p_item_code: itemCode,
    p_request_id: requestId, p_tick: Number(tickRow?.tick_number ?? 0),
  })
  if (error) return mapError(error) ?? NextResponse.json({ error: 'Bestellung konnte nicht gebucht werden.' }, { status: 500 })
  return NextResponse.json({
    ok: true,
    duplicate: Boolean(data?.duplicate),
    orderId: data?.order_id,
    label: data?.label ?? null,
    priceCredits: data?.price_credits,
    taxCredits: data?.tax_credits,
    credits: data?.credits,
    free: Boolean(data?.free),
  })
}

/** Hausregeln ändern: Preis eines Postens oder die Toilette (nur Eigentümer, geprüft in der Datenbank). */
async function setHouseRule(profileId: string, body: any) {
  const tileEntityId = String(body?.tileEntityId ?? '')
  if (!UUID_RE.test(tileEntityId)) return NextResponse.json({ error: 'tileEntityId fehlt.' }, { status: 400 })
  const supabase = createServiceClient()
  const price = body?.priceCredits === null || body?.priceCredits === undefined ? null : Math.round(Number(body.priceCredits))
  if (price !== null && !Number.isFinite(price)) return NextResponse.json({ error: 'Ungültiger Preis.' }, { status: 400 })
  const { data, error } = body.action === 'set_price'
    ? await supabase.rpc('set_venue_price', {
        p_profile_id: profileId, p_tile_entity_id: tileEntityId, p_item_code: String(body?.itemCode ?? '').slice(0, 64),
        p_price_credits: price, p_active: body?.active !== false,
      })
    : await supabase.rpc('set_venue_service', {
        p_profile_id: profileId, p_tile_entity_id: tileEntityId, p_service_code: String(body?.service ?? 'toilet'),
        p_available: body?.available !== false, p_price_credits: price ?? 0, p_guests_only: body?.guestsOnly === true,
      })
  if (error) return mapError(error) ?? NextResponse.json({ error: 'Hausregel konnte nicht gespeichert werden.' }, { status: 500 })
  return NextResponse.json({ ok: true, ...(data ?? {}) })
}
