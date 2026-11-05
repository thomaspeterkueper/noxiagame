// app/api/game/hospitality/events/route.ts
// Erstellt: 05.11.2026 — Veranstaltungen im Lokal (Second-Life-Mechanik, Teil 5)
// GET  ?tileEntityId=… → { events, elsewhere, canEdit }   Aushang hier und „Was ist los?“ anderswo
// POST { action: 'create', tileEntityId, kind, title, note, startsAt, minutes } → nur der Eigentümer
// POST { action: 'cancel', id }                                               → nur der Eigentümer

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { validateEvent, type VenueEvent } from '@/lib/game/hospitality/venueEvents'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_UPCOMING = 10

const toEvent = (r: any, names: Record<string, string> = {}): VenueEvent => ({ id: r.id, tileEntityId: r.tile_entity_id, kind: r.kind, title: r.title, note: r.note ?? null, startsAt: r.starts_at, endsAt: r.ends_at, venueName: names[r.tile_entity_id] ?? null })

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
  const nowIso = new Date().toISOString()
  const [{ data: here }, { data: other }, canEdit] = await Promise.all([
    supabase.from('venue_events').select('*').eq('tile_entity_id', tileEntityId).eq('cancelled', false).gt('ends_at', nowIso).order('starts_at').limit(MAX_UPCOMING),
    supabase.from('venue_events').select('*').neq('tile_entity_id', tileEntityId).eq('cancelled', false).gt('ends_at', nowIso).order('starts_at').limit(5),
    owns(supabase, profileId, tileEntityId),
  ])
  const ids = [...new Set((other ?? []).map((r: any) => r.tile_entity_id))]
  const { data: tiles } = ids.length ? await supabase.from('tile_entities').select('id,display_name').in('id', ids) : { data: [] as any[] }
  const names = Object.fromEntries((tiles ?? []).map((t: any) => [t.id, t.display_name ? String(t.display_name) : 'ein Lokal']))
  return NextResponse.json({ events: (here ?? []).map(r => toEvent(r)), elsewhere: (other ?? []).map(r => toEvent(r, names)), canEdit }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const supabase = createServiceClient()
  if (body?.action === 'cancel') {
    const id = String(body?.id ?? '')
    if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Termin fehlt.' }, { status: 400 })
    const { data: row } = await supabase.from('venue_events').select('tile_entity_id').eq('id', id).maybeSingle()
    if (!row || !(await owns(supabase, profileId, row.tile_entity_id))) return NextResponse.json({ error: 'Nur der Eigentümer kann absagen.' }, { status: 403 })
    await supabase.from('venue_events').update({ cancelled: true }).eq('id', id)
    return NextResponse.json({ ok: true })
  }
  if (body?.action !== 'create') return NextResponse.json({ error: 'Unbekannte Aktion.' }, { status: 400 })
  const tileEntityId = String(body?.tileEntityId ?? '')
  if (!UUID_RE.test(tileEntityId)) return NextResponse.json({ error: 'Lokal fehlt.' }, { status: 400 })
  if (!(await owns(supabase, profileId, tileEntityId))) return NextResponse.json({ error: 'Ankündigen kann nur, wem das Lokal gehört.' }, { status: 403 })
  const v = validateEvent(body, Date.now())
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
  const { count } = await supabase.from('venue_events').select('id', { count: 'exact', head: true }).eq('tile_entity_id', tileEntityId).eq('cancelled', false).gt('ends_at', new Date().toISOString())
  if ((count ?? 0) >= MAX_UPCOMING) return NextResponse.json({ error: 'Höchstens zehn Termine im Voraus.' }, { status: 429 })
  const { data: row, error } = await supabase.from('venue_events').insert({ tile_entity_id: tileEntityId, kind: v.kind, title: v.title, note: v.note, starts_at: v.startsAt, ends_at: v.endsAt, created_by: profileId }).select('*').single()
  if (error || !row) return NextResponse.json({ error: 'Nicht gespeichert.' }, { status: 500 })
  return NextResponse.json({ ok: true, event: toEvent(row) })
}
