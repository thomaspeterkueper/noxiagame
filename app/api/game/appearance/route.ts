// app/api/game/appearance/route.ts
// Erstellt: 05.11.2026 — eigene Figur gestalten (Kiesel; Second-Life-Mechanik)
// GET  → { look, saved }          eigenes Aussehen (oder die Vorgabe aus der Kennung)
// POST { look } → { ok, look }    nur erlaubte Werte (cleanPlayerLook), höchstens alle 3 s

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { cleanPlayerLook, defaultPlayerLook } from '@/lib/figures/playerLook'

export async function GET(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const [{ data }, { data: profile }] = await Promise.all([
    supabase.from('player_appearance').select('look').eq('profile_id', profileId).maybeSingle(),
    // Ohne eigene Einstellung: die Figur zum Dienstfoto aus dem Onboarding.
    supabase.from('profiles').select('avatar').eq('id', profileId).maybeSingle(),
  ])
  const avatar = typeof profile?.avatar === 'string' ? profile.avatar : null
  return NextResponse.json({ look: data?.look ? cleanPlayerLook(data.look, profileId, avatar) : defaultPlayerLook(profileId, avatar), saved: Boolean(data?.look) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null) as { look?: unknown } | null
  const look = cleanPlayerLook(body?.look, profileId)
  const supabase = createServiceClient()
  const { data: before } = await supabase.from('player_appearance').select('updated_at').eq('profile_id', profileId).maybeSingle()
  if (before?.updated_at && Date.now() - Date.parse(String(before.updated_at)) < 3000) return NextResponse.json({ error: 'Einen Moment – gerade eben gespeichert.' }, { status: 429 })
  const { error } = await supabase.from('player_appearance').upsert({ profile_id: profileId, look, updated_at: new Date().toISOString() })
  if (error) return NextResponse.json({ error: 'Nicht gespeichert.' }, { status: 500 })
  return NextResponse.json({ ok: true, look })
}
