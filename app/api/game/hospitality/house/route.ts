// app/api/game/hospitality/house/route.ts
// Erstellt: 05.11.2026 — Einrichten und Hausrecht (Second-Life-Mechanik, Teil 6)
// GET  ?tileEntityId=… → { furnishing, canEdit, banned, bans }   bans nur für den Eigentümer
// POST { action: 'furnish', tileEntityId, furnishing }             → nur der Eigentümer
// POST { action: 'ban', tileEntityId, profileId, hours, reason }  → nur der Eigentümer, nicht sich selbst
// POST { action: 'lift', tileEntityId, profileId }                 → nur der Eigentümer

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { BAN_HOURS, EMPTY_FURNISHING, sanitizeFurnishing } from '@/lib/game/hospitality/furnishing'
import { activeBanUntil } from '@/lib/game/hospitality/houseBans'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function owns(supabase: any, profileId: string, tileEntityId: string) {
  const { data } = await supabase.rpc('venue_owned_by', { p_profile_id: profileId, p_tile_entity_id: tileEntityId })
  return data === true
}

export async function GET(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const tileEntityId = req.nextUrl.searchParams.get('tileEntityId') ?? ''
  if (!UUID_RE.test(tileEntityId)) return NextResponse.json({ error: 'Lokal fehlt.' }, { status: 400 })
  const supabase = createServiceClient()
  const [{ data: row }, canEdit, banned] = await Promise.all([
    supabase.from('venue_furnishing').select('furnishing').eq('tile_entity_id', tileEntityId).maybeSingle(),
    owns(supabase, profileId, tileEntityId),
    activeBanUntil(supabase, tileEntityId, profileId),
  ])
  let bans: Array<{ profileId: string; name: string; until: string; reason: string | null }> = []
  if (canEdit) {
    const { data } = await supabase.from('venue_bans').select('profile_id,until,reason').eq('tile_entity_id', tileEntityId).eq('lifted', false).gt('until', new Date().toISOString()).order('created_at', { ascending: false }).limit(20)
    const ids = [...new Set((data ?? []).map((b: any) => b.profile_id))]
    const { data: names } = ids.length ? await supabase.from('profiles').select('id,username').in('id', ids) : { data: [] as any[] }
    const nameOf = Object.fromEntries((names ?? []).map((n: any) => [n.id, String(n.username ?? 'Spieler')]))
    bans = (data ?? []).map((b: any) => ({ profileId: b.profile_id, name: nameOf[b.profile_id] ?? 'Spieler', until: b.until, reason: b.reason ?? null }))
  }
  return NextResponse.json({ furnishing: row?.furnishing ? sanitizeFurnishing(row.furnishing) : EMPTY_FURNISHING, canEdit, banned, bans }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const tileEntityId = String(body?.tileEntityId ?? '')
  if (!UUID_RE.test(tileEntityId)) return NextResponse.json({ error: 'Lokal fehlt.' }, { status: 400 })
  const supabase = createServiceClient()
  if (!(await owns(supabase, profileId, tileEntityId))) return NextResponse.json({ error: 'Das darf nur, wem das Lokal gehört.' }, { status: 403 })

  if (body?.action === 'furnish') {
    const furnishing = sanitizeFurnishing(body?.furnishing)
    const { error } = await supabase.from('venue_furnishing').upsert({ tile_entity_id: tileEntityId, furnishing, updated_by: profileId, updated_at: new Date().toISOString() })
    if (error) return NextResponse.json({ error: 'Nicht gespeichert.' }, { status: 500 })
    return NextResponse.json({ ok: true, furnishing })
  }
  const target = String(body?.profileId ?? '')
  if (!UUID_RE.test(target)) return NextResponse.json({ error: 'Spieler fehlt.' }, { status: 400 })
  if (body?.action === 'ban') {
    if (target === profileId) return NextResponse.json({ error: 'Sich selbst kann man kein Hausverbot geben.' }, { status: 400 })
    const hours = BAN_HOURS.includes(Number(body?.hours) as never) ? Number(body?.hours) : BAN_HOURS[0]
    const reason = typeof body?.reason === 'string' ? body.reason.replace(/\s+/g, ' ').trim().slice(0, 160) || null : null
    const until = new Date(Date.now() + hours * 3600e3).toISOString()
    const { error } = await supabase.from('venue_bans').insert({ tile_entity_id: tileEntityId, profile_id: target, banned_by: profileId, reason, until })
    if (error) return NextResponse.json({ error: 'Nicht gespeichert.' }, { status: 500 })
    await supabase.from('player_room_events').insert({ room_key: tileEntityId, profile_id: profileId, kind: 'gesture', detail: ('Hausverbot ' + hours + ' h' + (reason ? ': ' + reason : '')).slice(0, 80), peers: 0 })
    return NextResponse.json({ ok: true, until })
  }
  if (body?.action === 'lift') {
    await supabase.from('venue_bans').update({ lifted: true }).eq('tile_entity_id', tileEntityId).eq('profile_id', target).eq('lifted', false)
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Unbekannte Aktion.' }, { status: 400 })
}
