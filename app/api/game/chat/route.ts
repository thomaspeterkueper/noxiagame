// app/api/game/chat/route.ts
// Erstellt:     19.07.2026
// Aktualisiert: 19.07.2026 — Direktnachrichten API
// Version:      1.0.0
//
// GET  ?action=history&userId={id}  — Letzte 50 Nachrichten mit Spieler
// GET  ?action=unread               — Anzahl ungelesener Nachrichten
// POST action=send                  — Nachricht senden
// POST action=read&userId={id}      — Nachrichten als gelesen markieren

import { NextRequest, NextResponse } from 'next/server'
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

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = createServiceClient()
  const action = req.nextUrl.searchParams.get('action')
  const otherUserId = req.nextUrl.searchParams.get('userId')

  // ── Nachrichtenhistorie ───────────────────────────────────────────────────
  if (action === 'history') {
    if (!otherUserId) return NextResponse.json({ error: 'userId fehlt' }, { status: 400 })

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

    if (!receiverId) return NextResponse.json({ error: 'receiverId fehlt' }, { status: 400 })
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

    // Nachricht speichern
    const { data: message, error } = await supabase
      .from('chat_messages')
      .insert({ sender_id: user.id, receiver_id: receiverId, content })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Ably: Empfänger sofort benachrichtigen
    await publishDirectMessage(receiverId, {
      id:             message.id,
      senderId:       user.id,
      senderUsername: sender?.username ?? 'Unbekannt',
      content,
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
