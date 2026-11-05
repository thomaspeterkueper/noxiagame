'use client'

// lib/multiplayer/useRoomChat.ts
// Raum-Chat zwischen Spielern (04.11.2026). Gesendet wird über den Server
// (/api/game/room-chat: gespeichert, Kontaktdaten entfernt, höchstens sechs je
// Minute); zugestellt über Ably (`noxia:room:<Haus>`, nur lesen). Dazu werden
// Kommen, Gehen und Gesten protokolliert – ausgewertet nur automatisch, Wortlaut
// wird nach 14 Tagen gelöscht (NOXIA-PRIVACY-0004).

import { useCallback, useEffect, useRef, useState } from 'react'
import { getSessionInfo } from '@/lib/supabase/auth'
import { useAblyChannel } from '@/lib/ably/client'
import { ABLY_CHANNELS, ABLY_EVENTS } from '@/lib/ably/channels'

export interface RoomMessage { id: string; senderId: string; senderName: string; text: string; at: string; range?: 'whisper' | 'say' | 'shout'; toId?: string | null; x?: number | null; y?: number | null; room?: string }

async function post(body: Record<string, unknown>, keepalive = false) {
  const { token } = await getSessionInfo()
  if (!token) return null
  const response = await fetch('/api/game/room-chat', { method: 'POST', keepalive, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return { ok: response.ok, data: await response.json().catch(() => ({})) }
}

export function useRoomChat(room: string | null, roomName: string, peers: number, myId: string | null = null) {
  const [messages, setMessages] = useState<RoomMessage[]>([])
  const peersRef = useRef(peers)
  peersRef.current = peers
  const add = useCallback((m: RoomMessage) => setMessages(list => list.some(x => x.id === m.id) ? list : [...list, m].slice(-40)), [])

  useEffect(() => {
    if (!room) return
    let live = true
    ;(async () => {
      try {
        const { token } = await getSessionInfo()
        if (!token) return
        const response = await fetch('/api/game/room-chat?room=' + encodeURIComponent(room), { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' })
        const data = await response.json().catch(() => ({}))
        if (live && Array.isArray(data.messages)) setMessages(data.messages)
      } catch { /* ohne Verlauf beginnt der Raum leer */ }
    })()
    void post({ action: 'event', room, roomName, kind: 'join', peers: peersRef.current }).catch(() => {})
    return () => { live = false; void post({ action: 'event', room, roomName, kind: 'leave', peers: peersRef.current }, true).catch(() => {}) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room])

  useAblyChannel(room ? ABLY_CHANNELS.room(room) : '', ABLY_EVENTS.room.message, data => {
    const m = data as RoomMessage
    if (m && typeof m.id === 'string' && typeof m.text === 'string') add(m)
  })
  // Geflüstertes kommt über den eigenen Kanal – nur, wenn es in diesem Raum gesagt wurde.
  useAblyChannel(room && myId ? ABLY_CHANNELS.dm(myId) : '', ABLY_EVENTS.room.whisper, data => {
    const m = data as RoomMessage
    if (m && typeof m.id === 'string' && typeof m.text === 'string' && m.room === room) add(m)
  })

  return {
    messages,
    async say(text: string, opts: { range?: 'whisper' | 'say' | 'shout'; toProfileId?: string; x?: number; y?: number } = {}): Promise<{ ok: boolean; error?: string; cleaned?: boolean }> {
      if (!room) return { ok: false }
      const r = await post({ action: 'say', room, roomName, text, peers: peersRef.current, ...opts }).catch(() => null)
      if (!r) return { ok: false, error: 'Keine Verbindung.' }
      if (!r.ok) return { ok: false, error: String(r.data.error ?? 'Nicht gesendet.') }
      if (r.data.message) add(r.data.message)
      return { ok: true, cleaned: Boolean(r.data.cleaned) }
    },
    // Meldung mit Ausschnitt: nur was gemeldet wird, ist für Admins lesbar (NOXIA-PRIVACY-0004).
    report(messageId: string, reason: 'harassment' | 'error' | 'feedback' | 'other' = 'harassment', comment?: string) {
      if (!room) return
      void (async () => {
        const { token } = await getSessionInfo()
        if (!token) return
        await fetch('/api/game/conversation-report', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'room', room, messageId, reason, comment }) })
      })().catch(() => {})
    },
    logGesture(detail: string) { if (room) void post({ action: 'event', room, roomName, kind: 'gesture', detail, peers: peersRef.current }).catch(() => {}) },
  }
}
