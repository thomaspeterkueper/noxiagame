import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'

export async function POST(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Anmeldung erforderlich' }, { status: 401 })
  const db = createServiceClient()
  const { error } = await db.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', profileId)
  if (error) return NextResponse.json({ error: 'Präsenz nicht gespeichert' }, { status: 503 })
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
