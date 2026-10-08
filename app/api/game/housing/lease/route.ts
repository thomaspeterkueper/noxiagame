// app/api/game/housing/lease/route.ts
// Owner-facing lease offer control. Does not move any person.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'

const MAX_LEASE = 100000

export async function POST(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const tileEntityId = String(body?.tileEntityId ?? '')
  const raw = body?.leasePrice
  const leasePrice = raw == null || raw === '' ? null : Number.parseInt(String(raw), 10)

  if (!tileEntityId) {
    return NextResponse.json({ error: 'tileEntityId fehlt.' }, { status: 400 })
  }
  if (leasePrice != null && (!Number.isFinite(leasePrice) || leasePrice < 1 || leasePrice > MAX_LEASE)) {
    return NextResponse.json({ error: `Miete muss zwischen 1 und ${MAX_LEASE} Credits liegen oder leer sein.` }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: tile, error: tileError } = await supabase
    .from('tile_entities')
    .select('id,profile_id,owner_class,residential_capacity,status,lease_price')
    .eq('id', tileEntityId)
    .maybeSingle()

  if (tileError) return NextResponse.json({ error: 'Wohnobjekt konnte nicht geladen werden.' }, { status: 500 })
  if (!tile || tile.profile_id !== profileId || tile.owner_class !== 'PLAYER') {
    return NextResponse.json({ error: 'Wohnobjekt nicht gefunden oder gehört dir nicht.' }, { status: 404 })
  }
  if (tile.status !== 'active' || Number(tile.residential_capacity ?? 0) < 1) {
    return NextResponse.json({ error: 'Dieses Objekt kann nicht vermietet werden.' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('tile_entities')
    .update({ lease_price: leasePrice })
    .eq('id', tileEntityId)
    .eq('profile_id', profileId)
    .select('id,lease_price,residential_capacity')
    .single()

  if (error) return NextResponse.json({ error: 'Mietangebot konnte nicht gespeichert werden.' }, { status: 500 })

  return NextResponse.json({
    ok: true,
    tileEntityId: data.id,
    leasePrice: data.lease_price,
    residentialCapacity: data.residential_capacity,
    offered: data.lease_price != null,
  })
}
