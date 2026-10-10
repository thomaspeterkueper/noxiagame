// app/api/game/hospitality/order/route.ts
// Karte und Bestellung in einem Lokal (NOXIA-FIN-0001).
// GET  ?tileEntityId=…  → Karte mit `affordable` je Posten: Was der Gast nicht
//                         bezahlen kann, ist gar nicht erst bestellbar.
// POST { tileEntityId, itemCode, requestId } → besteuerter Transfer Gast → Betreiber.

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
}

async function menuFor(supabase: any, tileEntityId: string) {
  const { data: tile } = await supabase.from('tile_entities').select('id,entity_id,status,entity_type').eq('id', tileEntityId).maybeSingle()
  if (!tile || tile.status !== 'active' || tile.entity_type !== 'building') return null
  const { data: items } = await supabase.from('hospitality_menu').select('item_code,label,price_credits').eq('entity_id', tile.entity_id).eq('active', true).order('price_credits')
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
  const { data: profile } = await supabase.from('profiles').select('credits').eq('id', profileId).maybeSingle()
  const credits = Number(profile?.credits ?? 0)
  return NextResponse.json({
    ok: true,
    credits,
    items: items.map((item: any) => ({
      itemCode: item.item_code, label: item.label, priceCredits: item.price_credits,
      affordable: credits >= Number(item.price_credits),
    })),
  })
}

export async function POST(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
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
  if (error) {
    const code = Object.keys(ERRORS).find((key) => String(error.message ?? '').includes(key))
    if (code) return NextResponse.json({ error: ERRORS[code].error, code }, { status: ERRORS[code].status })
    return NextResponse.json({ error: 'Bestellung konnte nicht gebucht werden.' }, { status: 500 })
  }
  return NextResponse.json({
    ok: true,
    duplicate: Boolean(data?.duplicate),
    orderId: data?.order_id,
    label: data?.label ?? null,
    priceCredits: data?.price_credits,
    taxCredits: data?.tax_credits,
    credits: data?.credits,
  })
}
