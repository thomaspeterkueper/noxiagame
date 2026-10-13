// app/api/game/hospitality/canteen/route.ts
// GET ?parentEntityId=… → die Hafenkantine in diesem Hafengebäude, falls es
// eine gibt (NOXIA-LIVING-0013: Kind-Gebäude `port_canteen` mit parent_id),
// und das Gedächtnis des Kantinenschwarms dieses Ortes: nur, was die Roboter
// selbst gesehen haben – Bestellungen dieses Spielers, Gäste und Notrationen
// der letzten 24 Stunden in den Kantinen des Ortes. Liest nur, erfindet nichts.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import type { SwarmMemory } from '@/lib/game/hospitality/canteen'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[89ab0-9a-f]{12}$/i
const DAY_S = 24 * 60 * 60

export async function GET(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parentEntityId = new URL(req.url).searchParams.get('parentEntityId') ?? ''
  if (!UUID_RE.test(parentEntityId)) return NextResponse.json({ error: 'parentEntityId fehlt.' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: parent } = await supabase.from('tile_entities').select('id,entity_id,location_id').eq('id', parentEntityId).maybeSingle()
  if (!parent) return NextResponse.json({ error: 'Gebäude nicht gefunden.' }, { status: 404 })
  const { data: canteen } = await supabase.from('tile_entities').select('id').eq('parent_id', parentEntityId).eq('entity_id', 'port_canteen').eq('status', 'active').limit(1).maybeSingle()
  const headers = { 'Cache-Control': 'private, no-store' }
  if (!canteen) return NextResponse.json({ ok: true, portTypeId: parent.entity_id, canteen: null, memory: null }, { headers })

  // Ein Schwarm je Ort: alle Kantinen dieses Ortes teilen ihr Gedächtnis.
  const { data: swarmCanteens } = await supabase.from('tile_entities').select('id').eq('location_id', parent.location_id).eq('entity_id', 'port_canteen').eq('status', 'active')
  const ids = (swarmCanteens ?? []).map((row: any) => row.id as string)
  if (!ids.includes(canteen.id)) ids.push(canteen.id)
  const since = new Date(Date.now() - DAY_S * 1000).toISOString()
  const [{ data: own }, { data: labels }, { data: events }] = await Promise.all([
    supabase.from('player_hospitality_orders').select('item_code,created_at').eq('profile_id', profileId).in('tile_entity_id', ids).order('created_at', { ascending: false }).limit(200),
    supabase.from('hospitality_menu').select('item_code,label').eq('entity_id', 'port_canteen'),
    supabase.from('person_consumption_events').select('person_id,service_code').in('tile_entity_id', ids).gte('created_at', since).limit(500),
  ])
  const labelByCode = new Map((labels ?? []).map((row: any) => [row.item_code, row.label]))
  const last = own?.[0]
  const memory: SwarmMemory = {
    visits: own?.length ?? 0,
    lastVisitAgoS: last ? Math.max(0, Math.round((Date.now() - new Date(last.created_at).getTime()) / 1000)) : null,
    lastItem: last ? String(labelByCode.get(last.item_code) ?? last.item_code) : null,
    guestsToday: new Set((events ?? []).map((row: any) => row.person_id)).size,
    rationsToday: (events ?? []).filter((row: any) => row.service_code === 'canteen_emergency_ration').length,
  }
  return NextResponse.json({ ok: true, portTypeId: parent.entity_id, canteen: { id: canteen.id, name: 'Hafenkantine' }, memory }, { headers })
}
