// app/api/game/room-chat/route.ts
// Erstellt: 04.11.2026 — Spieler reden im Raum miteinander; alles wird für die Auswertung gespeichert
// GET  ?room=… → { messages: [{ id, senderId, senderName, text, at }] } (letzte 30 Minuten)
// POST { action: 'say', room, roomName, text, peers, range, toProfileId, x, y } → speichern; Sagen/Rufen an den Raum,
//      Flüstern nur an den einen Spieler (05.11.2026)
// POST { action: 'event', room, roomName, kind, detail, peers } → join, leave, gesture
// POST { action: 'report', room, roomName, messageId, detail } → Meldung einer Nachricht

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { prepareRoomMessage, ROOM_MESSAGES_PER_MINUTE } from '@/lib/multiplayer/roomChat'
import { publishRoomMessage, publishWhisper } from '@/lib/ably/server'
import { CHAT_RANGES, type ChatRange } from '@/lib/multiplayer/roomChat'

const ROOM_RE = /^[A-Za-z0-9:_-]{3,80}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : null) || null
const count = (v: unknown) => Math.max(0, Math.min(50, Math.round(Number(v) || 0)))

export async function GET(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const room = req.nextUrl.searchParams.get('room') ?? ''
  if (!ROOM_RE.test(room)) return NextResponse.json({ error: 'Raum fehlt.' }, { status: 400 })
  const { data } = await createServiceClient().from('player_room_messages').select('id,sender_id,sender_name,shown_text,created_at,range,to_profile_id,pos_x,pos_y')
    .eq('room_key', room).or(`range.neq.whisper,sender_id.eq.${profileId},to_profile_id.eq.${profileId}`).gte('created_at', new Date(Date.now() - 30 * 60_000).toISOString()).order('created_at', { ascending: false }).limit(30)
  return NextResponse.json({ messages: (data ?? []).reverse().map((m: any) => ({ id: m.id, senderId: m.sender_id, senderName: m.sender_name, text: m.shown_text, at: m.created_at, range: m.range ?? 'say', toId: m.to_profile_id ?? null, x: m.pos_x, y: m.pos_y })) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const room = String(body?.room ?? '')
  if (!ROOM_RE.test(room)) return NextResponse.json({ error: 'Raum fehlt.' }, { status: 400 })
  const supabase = createServiceClient()
  const roomName = clip(body?.roomName, 80)
  const peers = count(body?.peers)

  if (body?.action === 'event') {
    const kind = String(body?.kind ?? '')
    if (!['join', 'leave', 'gesture'].includes(kind)) return NextResponse.json({ error: 'Unbekannt.' }, { status: 400 })
    await supabase.from('player_room_events').insert({ room_key: room, room_name: roomName, profile_id: profileId, kind, detail: clip(body?.detail, 80), peers })
    return NextResponse.json({ ok: true })
  }

  if (body?.action === 'report') {
    const messageId = String(body?.messageId ?? '')
    if (!UUID_RE.test(messageId)) return NextResponse.json({ error: 'Nachricht fehlt.' }, { status: 400 })
    await supabase.from('player_room_events').insert({ room_key: room, room_name: roomName, profile_id: profileId, kind: 'report', detail: clip(body?.detail, 200), message_id: messageId, peers })
    return NextResponse.json({ ok: true })
  }

  if (body?.action !== 'say') return NextResponse.json({ error: 'Unbekannte Aktion.' }, { status: 400 })
  const prepared = prepareRoomMessage(String(body?.text ?? ''))
  if (!prepared) return NextResponse.json({ error: 'Nachricht fehlt.' }, { status: 400 })
  const range: ChatRange = CHAT_RANGES.includes(body?.range as ChatRange) ? body!.range as ChatRange : 'say'
  const toId = range === 'whisper' ? String(body?.toProfileId ?? '') : null
  if (range === 'whisper' && (!toId || !UUID_RE.test(toId) || toId === profileId)) return NextResponse.json({ error: 'Flüstern geht nur an einen anderen Spieler.' }, { status: 400 })
  const at = (v: unknown) => Number.isFinite(Number(v)) ? Math.max(-100, Math.min(2000, Math.round(Number(v)))) : null
  const posX = at(body?.x), posY = at(body?.y)
  const { count: recent } = await supabase.from('player_room_messages').select('id', { count: 'exact', head: true })
    .eq('sender_id', profileId).gte('created_at', new Date(Date.now() - 60_000).toISOString())
  if ((recent ?? 0) >= ROOM_MESSAGES_PER_MINUTE) return NextResponse.json({ error: 'Langsam – höchstens sechs Nachrichten in der Minute.' }, { status: 429 })
  const { data: profile } = await supabase.from('profiles').select('username').eq('id', profileId).maybeSingle()
  const senderName = String(profile?.username ?? 'Spieler').slice(0, 24)
  const { data: row, error } = await supabase.from('player_room_messages').insert({
    room_key: room, room_name: roomName, sender_id: profileId, sender_name: senderName,
    text: prepared.text, shown_text: prepared.shown, topic: prepared.topic, flags: prepared.flags, peers,
    range, to_profile_id: toId, pos_x: posX, pos_y: posY,
  }).select('id,created_at').single()
  if (error || !row) return NextResponse.json({ error: 'Nicht gesendet.' }, { status: 500 })
  const message = { id: String(row.id), senderId: profileId, senderName, text: prepared.shown, at: String(row.created_at), range, toId, x: posX, y: posY, room }
  if (range === 'whisper') await publishWhisper(toId!, message)
  else await publishRoomMessage(room, message)
  return NextResponse.json({ ok: true, message, cleaned: prepared.shown !== prepared.text })
}
