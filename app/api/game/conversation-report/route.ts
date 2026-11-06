// app/api/game/conversation-report/route.ts
// NOXIA-PRIVACY-0004 (05.11.2026): „Gespräch melden“. Nur was der Spieler hier
// selbst schickt, wird für Admins lesbar – als Kopie, 90 Tage lang.
//
// POST { source: 'npc', npcId?, reason, comment? }
//   → die eigenen Wortmeldungen der letzten zwei Stunden mit dieser Figur
//     (ohne npcId: das zuletzt geführte NPC-Gespräch)
// POST { source: 'room', room, messageId, reason, comment? }
//   → die gemeldete Nachricht und was der Spieler davor im Raum sehen konnte

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { clipExcerpt, type ExcerptLine } from '@/lib/game/conversationInsights'
import { maskPersonalData } from '@/lib/game/safety/personalData'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const KEY_RE = /^[A-Za-z0-9:_.\-]{1,120}$/
const ROOM_RE = /^[A-Za-z0-9:_-]{3,80}$/
const REASONS = ['error', 'harassment', 'feedback', 'other'] as const
const REPORTS_PER_HOUR = 10

export async function POST(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Anmeldung erforderlich' }, { status: 401 })
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const reason = REASONS.includes(body?.reason as typeof REASONS[number]) ? body!.reason as string : 'other'
  const comment = typeof body?.comment === 'string' ? maskPersonalData(body.comment.replace(/\s+/g, ' ').trim()).slice(0, 500) || null : null
  const db = createServiceClient()

  const { count } = await db.from('conversation_reports').select('id', { count: 'exact', head: true })
    .eq('reporter_profile_id', profileId).gte('created_at', new Date(Date.now() - 3_600_000).toISOString())
  if ((count ?? 0) >= REPORTS_PER_HOUR) return NextResponse.json({ error: 'Zu viele Meldungen – bitte später noch einmal.' }, { status: 429 })

  const since = new Date(Date.now() - 2 * 3_600_000).toISOString()

  if (body?.source === 'room') {
    const room = String(body?.room ?? '')
    const messageId = String(body?.messageId ?? '')
    if (!ROOM_RE.test(room) || !UUID_RE.test(messageId)) return NextResponse.json({ error: 'Nachricht fehlt.' }, { status: 400 })
    const { data: target } = await db.from('player_room_messages').select('created_at,room_name,range,sender_id,to_profile_id')
      .eq('id', messageId).eq('room_key', room).maybeSingle()
    if (!target) return NextResponse.json({ error: 'Nachricht nicht gefunden.' }, { status: 404 })
    if (target.range === 'whisper' && target.sender_id !== profileId && target.to_profile_id !== profileId)
      return NextResponse.json({ error: 'Nachricht nicht gefunden.' }, { status: 404 })
    // Nur, was der Meldende selbst gesehen hat: Raumnachrichten und eigenes Flüstern.
    const { data: lines } = await db.from('player_room_messages').select('sender_name,shown_text,created_at')
      .eq('room_key', room).lte('created_at', target.created_at)
      .gte('created_at', new Date(Date.parse(target.created_at) - 10 * 60_000).toISOString())
      .or(`range.neq.whisper,sender_id.eq.${profileId},to_profile_id.eq.${profileId}`)
      .order('created_at', { ascending: false }).limit(8)
    const excerpt = clipExcerpt((lines ?? []).reverse().map(l => ({ speaker: String(l.sender_name), text: String(l.shown_text), at: String(l.created_at) })))
    const { error } = await db.from('conversation_reports').insert({
      reporter_profile_id: profileId, source: 'room', reason, comment, room_key: room, location_name: target.room_name ?? null, excerpt,
    })
    if (error) return NextResponse.json({ error: 'Meldung nicht gespeichert.' }, { status: 500 })
    await db.from('player_room_events').insert({ room_key: room, room_name: target.room_name ?? null, profile_id: profileId, kind: 'report', detail: reason, message_id: messageId, peers: 0 })
    return NextResponse.json({ ok: true })
  }

  if (body?.source !== 'npc') return NextResponse.json({ error: 'Unbekannte Quelle.' }, { status: 400 })
  const npcId = typeof body?.npcId === 'string' ? body.npcId.trim() : ''
  if (npcId && !KEY_RE.test(npcId)) return NextResponse.json({ error: 'Ungültige Figur.' }, { status: 400 })

  let query = db.from('npc_conversation_log').select('created_at,npc_person_id,npc_key,npc_name,location_name,player_text,npc_reply,opening')
    .eq('player_profile_id', profileId).gte('created_at', since).order('created_at', { ascending: false }).limit(8)
  if (npcId) query = UUID_RE.test(npcId) ? query.eq('npc_person_id', npcId) : query.eq('npc_key', npcId)
  const { data: turns, error: readError } = await query
  if (readError) return NextResponse.json({ error: 'Gespräch nicht verfügbar.' }, { status: 503 })
  if (!turns?.length) return NextResponse.json({ error: 'Kein Gespräch der letzten zwei Stunden gefunden.' }, { status: 404 })
  // Ohne npcId nur das zuletzt geführte Gespräch.
  const latest = turns[0]
  const own = turns.filter(t => t.npc_key === latest.npc_key).reverse()
  const npcName = latest.npc_name ?? 'NPC'
  const lines: ExcerptLine[] = []
  for (const t of own) {
    if (!t.opening && t.player_text) lines.push({ speaker: 'Spieler', text: t.player_text, at: t.created_at })
    if (t.npc_reply) lines.push({ speaker: npcName, text: t.npc_reply, at: t.created_at })
  }
  const { error } = await db.from('conversation_reports').insert({
    reporter_profile_id: profileId, source: 'npc', reason, comment,
    npc_person_id: latest.npc_person_id ?? null, npc_name: npcName, location_name: latest.location_name ?? null,
    excerpt: clipExcerpt(lines),
  })
  if (error) return NextResponse.json({ error: 'Meldung nicht gespeichert.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
