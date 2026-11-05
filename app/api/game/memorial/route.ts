// app/api/game/memorial/route.ts
// W-13: Gedenkort auf dem Friedhof – Kerzen nur für den Spieler selbst sichtbar.
// GET                              → { candles }  die eigenen Kerzen (neueste zuerst)
// POST { placeRef, placeName, name? } → Kerze anzünden (höchstens 12 je Tag)
// POST { action: 'remove', id }   → eigene Kerze entfernen

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const clean = (value: unknown, max: number) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

export async function GET(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await createServiceClient().from('player_memorials').select('id,place_ref,place_name,name,created_at').eq('profile_id', profileId).order('created_at', { ascending: false }).limit(60)
  return NextResponse.json({ candles: (data ?? []).map(row => ({ id: row.id, placeRef: row.place_ref, placeName: row.place_name, name: row.name, at: row.created_at })) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const supabase = createServiceClient()
  if (body.action === 'remove') {
    const id = String(body.id ?? '')
    if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Kerze fehlt.' }, { status: 400 })
    await supabase.from('player_memorials').delete().eq('id', id).eq('profile_id', profileId)
    return NextResponse.json({ ok: true })
  }
  const placeRef = clean(body.placeRef, 120)
  if (!placeRef) return NextResponse.json({ error: 'Ort fehlt.' }, { status: 400 })
  const since = new Date(Date.now() - 86_400_000).toISOString()
  const { count } = await supabase.from('player_memorials').select('id', { count: 'exact', head: true }).eq('profile_id', profileId).gt('created_at', since)
  if ((count ?? 0) >= 12) return NextResponse.json({ error: 'Für heute brennen schon viele Kerzen.' }, { status: 429 })
  const { data, error } = await supabase.from('player_memorials').insert({ profile_id: profileId, place_ref: placeRef, place_name: clean(body.placeName, 120) || null, name: clean(body.name, 80) || null }).select('id,place_ref,place_name,name,created_at').single()
  if (error || !data) { console.error('[memorial]', error?.message); return NextResponse.json({ error: 'Die Kerze ließ sich nicht anzünden.' }, { status: 500 }) }
  return NextResponse.json({ ok: true, candle: { id: data.id, placeRef: data.place_ref, placeName: data.place_name, name: data.name, at: data.created_at } })
}
