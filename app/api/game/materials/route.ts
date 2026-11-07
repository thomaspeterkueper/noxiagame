// app/api/game/materials/route.ts
// Baustofflager des Spielers auf der Erde (NOXIA-MAT-0001).
// GET                                   → Bestand je Gut
// POST { action: 'sell', resource, amount } → an die Gemeinde verkaufen (Rundholz, Schnittholz)
// POST { action: 'saw', amount }            → Lohnschnitt: Rundholz → Schnittholz (60 %)
// POST { action: 'crush', amount }          → Lohnbrechen: Bruchstein → Schotter (1 : 1)
// Ankauf auch von Getreide, Kartoffeln, Bruchstein und Schotter (lib/worldlab/landWork.ts).
// Preise und Gebühren rechnet der Server (lib/game/construction/materials.ts).

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { FORESTRY, MATERIALS, materialForResource } from '@/lib/game/construction/materials'
import { crushFee, FARM_BUY_PRICES, QUARRY } from '@/lib/worldlab/landWork'

/** Was die Gemeinde ankauft und zu welchem Preis je Einheit */
const BUY_PRICES: Record<string, number> = { roundwood: FORESTRY.roundwoodBuyPrice, lumber: MATERIALS.schnittholz.price - 2, ...FARM_BUY_PRICES }
/** Güter, die keine Baustoffe sind (Name, Einheit) */
const OTHER_GOODS: Record<string, { name: string; unit: string }> = { grain: { name: 'Getreide', unit: 't' }, potatoes: { name: 'Kartoffeln', unit: 't' }, cattle: { name: 'Rinder', unit: 'Stück' } }

const ERRORS: Record<string, [number, string]> = {
  NOXIA_INVENTORY_STOCK_INSUFFICIENT: [409, 'So viel liegt nicht im Lager.'],
  NOXIA_BUYER_FUNDS: [409, 'Die Gemeinde kauft gerade nichts an – ihre Kasse reicht nicht.'],
  NOXIA_CREDITS_INSUFFICIENT: [400, 'Nicht genug Credits.'],
  NOXIA_AMOUNT_INVALID: [400, 'Ungültige Menge.'],
}
function failure(message: string) {
  const code = Object.keys(ERRORS).find(key => message.includes(key))
  const [status, text] = code ? ERRORS[code] : [500, 'Vorgang fehlgeschlagen.']
  if (!code) console.error('[materials]', message)
  return NextResponse.json({ error: text, code: code ?? null }, { status })
}

export async function GET(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const { data: depot } = await supabase.from('logistics_inventories').select('id').eq('storage_kind', 'native').eq('subject_type', 'profile_earth_depot').eq('subject_id', profileId).maybeSingle()
  const { data: items } = depot ? await supabase.from('logistics_inventory_items').select('resource,amount').eq('inventory_id', depot.id) : { data: [] }
  const stock = (items ?? []).filter(item => Number(item.amount) > 0).map(item => {
    const material = materialForResource(String(item.resource))
    const other = OTHER_GOODS[String(item.resource)]
    return { resource: String(item.resource), name: material?.name ?? other?.name ?? String(item.resource), unit: material?.unit ?? other?.unit ?? '', amount: Number(item.amount), buyPrice: BUY_PRICES[String(item.resource)] ?? null }
  })
  return NextResponse.json({ stock, sawFeePerM3: FORESTRY.sawFeePerM3, crushFeePer2t: QUARRY.crushFeePer2t }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { action?: string; resource?: string; amount?: number }
  const amount = Math.floor(Number(body.amount))
  if (!Number.isFinite(amount) || amount < 1) return NextResponse.json({ error: 'Ungültige Menge.' }, { status: 400 })
  const supabase = createServiceClient()
  if (body.action === 'sell') {
    const resource = String(body.resource ?? '')
    const price = BUY_PRICES[resource]
    if (!price) return NextResponse.json({ error: 'Das kauft die Gemeinde nicht an.' }, { status: 400 })
    const { data, error } = await supabase.rpc('sell_earth_material', { p_profile_id: profileId, p_resource: resource, p_amount: amount, p_unit_price: price })
    if (error) return failure(error.message)
    return NextResponse.json(data)
  }
  if (body.action === 'saw') {
    const { data, error } = await supabase.rpc('saw_earth_roundwood', { p_profile_id: profileId, p_amount: amount, p_fee_per_m3: FORESTRY.sawFeePerM3 })
    if (error) return failure(error.message)
    return NextResponse.json(data)
  }
  if (body.action === 'crush') {
    const { data, error } = await supabase.rpc('convert_earth_material', { p_profile_id: profileId, p_from: 'stone', p_to: 'gravel', p_amount: amount, p_out: amount, p_fee: crushFee(amount), p_note: 'Lohnbrechen (Bruchstein zu Schotter)' })
    if (error) return failure(error.message)
    return NextResponse.json(data)
  }
  return NextResponse.json({ error: 'Unbekannte Aktion.' }, { status: 400 })
}
