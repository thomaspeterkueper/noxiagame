// app/api/game/hospitality/canteen/route.ts
// GET ?parentEntityId=… → die Hafenkantine in diesem Hafengebäude, falls es
// eine gibt (NOXIA-LIVING-0013: Kind-Gebäude `port_canteen` mit parent_id).
// Liest nur. Ohne Kantine kommt `canteen: null`, nichts wird erfunden.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[89ab0-9a-f]{12}$/i

export async function GET(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parentEntityId = new URL(req.url).searchParams.get('parentEntityId') ?? ''
  if (!UUID_RE.test(parentEntityId)) return NextResponse.json({ error: 'parentEntityId fehlt.' }, { status: 400 })

  const supabase = createServiceClient()
  const [{ data: parent }, { data: canteen }] = await Promise.all([
    supabase.from('tile_entities').select('id,entity_id').eq('id', parentEntityId).maybeSingle(),
    supabase.from('tile_entities').select('id,entity_id,status').eq('parent_id', parentEntityId).eq('entity_id', 'port_canteen').eq('status', 'active').limit(1).maybeSingle(),
  ])
  if (!parent) return NextResponse.json({ error: 'Gebäude nicht gefunden.' }, { status: 404 })
  return NextResponse.json(
    { ok: true, portTypeId: parent.entity_id, canteen: canteen ? { id: canteen.id, name: 'Hafenkantine' } : null },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
