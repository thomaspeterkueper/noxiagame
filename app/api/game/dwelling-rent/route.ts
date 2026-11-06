// app/api/game/dwelling-rent/route.ts
// Erstellt:     06.11.2026
// Aktualisiert: 06.11.2026 — Besitzer privater Wohnungen legen die Miete fest (NOXIA-FIN-0002)
// Version:      1.0.0
//
// Entschieden (Thomas, 06.11.2026): „Bei privaten Objekten legt der Besitzer das fest.“
// GET  ?entityId=… → { rent, purchasePrice } (geltende Miete je Wohnung und Kaufpreis)
// POST { entityId, rent } → Miete je Wohnung und 30 Tage setzen (gilt ab der nächsten Abrechnung)

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

async function getUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/, '')
  if (!token) return null
  const { data: { user } } = await createServiceClient().auth.getUser(token)
  return user
}

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const entityId = req.nextUrl.searchParams.get('entityId')
  if (!entityId) return NextResponse.json({ error: 'Gebäude fehlt.' }, { status: 400 })
  const supabase = createServiceClient()
  const [{ data: rent }, { data: price }] = await Promise.all([
    supabase.rpc('noxia_dwelling_rent', { p_tile_entity_id: entityId }),
    supabase.rpc('noxia_building_purchase_price', { p_tile_entity_id: entityId }),
  ])
  return NextResponse.json({ rent: Number(rent ?? 0), purchasePrice: Number(price ?? 0) })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { entityId?: string; rent?: number }
  const rent = Math.round(Number(body.rent))
  if (!body.entityId || !Number.isFinite(rent)) return NextResponse.json({ error: 'Gebäude oder Miete fehlt.' }, { status: 400 })
  const { data, error } = await createServiceClient().rpc('noxia_set_dwelling_rent', { p_profile_id: user.id, p_tile_entity_id: body.entityId, p_rent: rent })
  if (error) {
    const m = error.message
    if (m.includes('NOXIA_NOT_OWNER')) return NextResponse.json({ error: 'Das Haus gehört dir nicht.' }, { status: 403 })
    if (m.includes('NOXIA_NO_DWELLINGS')) return NextResponse.json({ error: 'In diesem Haus gibt es keine Wohnungen.' }, { status: 400 })
    if (m.includes('NOXIA_RENT_INVALID')) return NextResponse.json({ error: 'Die Miete muss zwischen 0 und 100 000 Cr liegen.' }, { status: 400 })
    return NextResponse.json({ error: 'Die Miete konnte nicht gesetzt werden.' }, { status: 500 })
  }
  return NextResponse.json(data)
}
