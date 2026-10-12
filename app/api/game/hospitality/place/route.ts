// app/api/game/hospitality/place/route.ts
// GET ?tileEntityId=… → Ortswissen für die Figuren in einem Lokal: reale
// Geographie aus den Kartendaten und NOXIA-Einrichtungen am Ort. Nur lesend.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { loadPlaceKnowledge } from '@/lib/game/hospitality/placeKnowledge.server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const tileEntityId = new URL(req.url).searchParams.get('tileEntityId') ?? ''
  if (!UUID_RE.test(tileEntityId)) return NextResponse.json({ error: 'tileEntityId fehlt.' }, { status: 400 })

  const knowledge = await loadPlaceKnowledge(createServiceClient(), tileEntityId)
  if (!knowledge) return NextResponse.json({ error: 'Lokal nicht gefunden.' }, { status: 404 })
  return NextResponse.json({ ok: true, placeLabel: knowledge.placeLabel, facts: knowledge.facts }, {
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  })
}
