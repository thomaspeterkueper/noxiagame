// app/api/game/chat/route.ts
// Erstellt:     19.07.2026
// Aktualisiert: 19.07.2026 — Direktnachrichten API
// Version:      1.0.0
//
// GET  ?action=history&userId={id}  — Letzte 50 Nachrichten mit Spieler
// GET  ?action=unread               — Anzahl ungelesener Nachrichten
// POST action=send                  — Nachricht senden
// POST action=read&userId={id}      — Nachrichten als gelesen markieren

import { after, NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.split(' ')[1]
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user
}
import { publishDirectMessage } from '@/lib/ably/server'
import { assessRealWorldRisk, needsAiReview, retainUntilFor } from '@/lib/game/safety/realWorldRisk'
import { maskPersonalData } from '@/lib/game/safety/personalData'
import { secureSuspicion } from '@/lib/game/safety/secureSuspicion'
import { aiVerdictIsSuspect, reviewWindow } from '@/lib/game/safety/aiReview'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = createServiceClient()
  const action = req.nextUrl.searchParams.get('action')
  const otherUserId = req.nextUrl.searchParams.get('userId')

  // ── Nachrichtenhistorie ───────────────────────────────────────────────────
  if (action === 'history') {
    if (!otherUserId) return NextResponse.json({ error: 'userId fehlt' }, { status: 400 })
    // Nur eine echte ID: Sonst ließ sich über den Filter fremde Chats lesen (Sicherheitsprüfung 29.10.2026).
    if (!UUID_RE.test(otherUserId)) return NextResponse.json({ error: 'userId ungültig' }, { status: 400 })

    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*, sender:profiles!sender_id(id, username), receiver:profiles!receiver_id(id, username)')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
      .limit(50)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ messages: messages ?? [] })
  }

  // ── Ungelesene Nachrichten ────────────────────────────────────────────────
  if (action === 'unread') {
    const { count } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .is('read_at', null)

    return NextResponse.json({ unread: count ?? 0 })
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = createServiceClient()
  const body = await req.json() as Record<string, unknown>
  const action = body.action as string

  // ── Nachricht senden ──────────────────────────────────────────────────────
  if (action === 'send') {
    const receiverId = body.receiverId as string
    const content    = (body.content as string ?? '').trim()

    if (!receiverId || !UUID_RE.test(receiverId)) return NextResponse.json({ error: 'receiverId fehlt oder ungültig' }, { status: 400 })
    if (!content || content.length > 500)
      return NextResponse.json({ error: 'Nachricht zu lang oder leer' }, { status: 400 })
    if (receiverId === user.id)
      return NextResponse.json({ error: 'Kann nicht an sich selbst senden' }, { status: 400 })

    // Empfänger prüfen
    const { data: receiver } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('id', receiverId)
      .single()
    if (!receiver) return NextResponse.json({ error: 'Empfänger nicht gefunden' }, { status: 404 })

    // Sender-Profil
    const { data: sender } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()

    // Schutzfilter wie im Raum-Chat (NOXIA-SAFETY-0001, 06.11.2026): sichtbar ist nur
    // die geschwärzte Fassung (chat_messages ist für Spieler direkt lesbar). Das Original
    // liegt getrennt in chat_message_originals (nur Server) – für den Schutzfilter und
    // gesicherte Verdachtsfälle; 14 Tage, bei Geldgesprächen ein Jahr.
    const shown = maskPersonalData(content)
    const { data: message, error } = await supabase
      .from('chat_messages')
      .insert({ sender_id: user.id, receiver_id: receiverId, content: shown })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    try {
      const since = new Date(Date.now() - 30 * 60_000).toISOString()
      const { data: recent } = await supabase.from('chat_messages').select('id,sender_id,content,created_at')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user.id})`)
        .gte('created_at', since).lt('created_at', message.created_at).order('created_at', { ascending: false }).limit(9)
      const ids = (recent ?? []).map(m => String(m.id))
      const { data: originals } = ids.length
        ? await supabase.from('chat_message_originals').select('message_id,content').in('message_id', ids)
        : { data: [] as Array<{ message_id: string; content: string }> }
      const original = new Map((originals ?? []).map(o => [String(o.message_id), String(o.content)]))
      const nameOf = (id: string) => id === user.id ? (sender?.username ?? 'Absender') : (receiver.username ?? 'Empfänger')
      const lines = [
        ...(recent ?? []).reverse().map(m => ({ speaker: nameOf(String(m.sender_id)), text: original.get(String(m.id)) ?? String(m.content), at: String(m.created_at) })),
        { speaker: nameOf(user.id), text: content, at: String(message.created_at) },
      ]
      const risk = assessRealWorldRisk(lines.map(l => l.text))
      const retainUntil = retainUntilFor(risk)
      if (shown !== content || retainUntil) {
        await supabase.from('chat_message_originals').insert({ message_id: message.id, content, retain_until: retainUntil })
      }
      if (retainUntil && ids.length) await supabase.from('chat_message_originals').update({ retain_until: retainUntil }).in('message_id', ids)
      const roomKey = 'direct:' + [user.id, receiverId].sort().join(':')
      if (risk.level === 'suspect') {
        // Gesicherter Verdachtsfall: Ausschnitt im Original (Ausnahme von der Schwärzung).
        await secureSuspicion(supabase, { subjectProfileId: user.id, source: 'direct', risk, roomKey, locationName: 'Freundes-Chat', excerpt: lines })
      } else if (needsAiReview(risk, { whisper: true })) {
        after(async () => {
          try {
            const anon = lines.map(l => ({ ...l, speaker: l.speaker === nameOf(user.id) ? 'Person A' : 'Person B', text: maskPersonalData(l.text) }))
            const verdict = await reviewWindow(supabase, { subjectProfileId: user.id, roomKey, whisper: true, risk, lines: anon })
            if (aiVerdictIsSuspect(verdict)) await secureSuspicion(supabase, {
              subjectProfileId: user.id, source: 'direct', roomKey, locationName: 'Freundes-Chat', excerpt: lines,
              risk: { ...risk, level: 'suspect', reasons: [`KI-Prüfung (${verdict!.category}, ${Math.round(verdict!.confidence * 100)} %): ${verdict!.reason}`] },
            })
          } catch (reviewError) {
            console.error('[safety] direct ai review failed', reviewError instanceof Error ? reviewError.message : reviewError)
          }
        })
      }
    } catch (safetyError) {
      console.error('[safety] direct assessment failed', safetyError instanceof Error ? safetyError.message : safetyError)
    }

    // Ably: Empfänger sofort benachrichtigen
    await publishDirectMessage(receiverId, {
      id:             message.id,
      senderId:       user.id,
      senderUsername: sender?.username ?? 'Unbekannt',
      content: shown,
      createdAt:      message.created_at,
    })

    return NextResponse.json({ ok: true, message })
  }

  // ── Als gelesen markieren ─────────────────────────────────────────────────
  if (action === 'read') {
    const otherUserId = body.userId as string
    if (!otherUserId) return NextResponse.json({ error: 'userId fehlt' }, { status: 400 })

    await supabase
      .from('chat_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('receiver_id', user.id)
      .eq('sender_id', otherUserId)
      .is('read_at', null)

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
}
