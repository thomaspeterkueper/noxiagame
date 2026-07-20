'use client'

// app/dashboard/ChatOverlay.tsx
// Erstellt:     19.07.2026
// Aktualisiert: 19.07.2026 — Direktnachrichten Overlay
// Version:      1.0.0
//
// Zeigt Konversation mit einem anderen Spieler.
// Lädt letzte 50 Nachrichten aus DB + empfängt neue via Ably.

import React, { useEffect, useRef, useState } from 'react'
import { useAblyChannel } from '@/lib/ably/client'
import { ABLY_CHANNELS, ABLY_EVENTS } from '@/lib/ably/channels'
import { getToken } from '@/lib/supabase/auth'

const C = {
  bg:       '#0a0e16',
  surface:  '#111827',
  border:   'rgba(42,78,122,0.45)',
  accent:   '#2a4e7a',
  gold:     '#c9a961',
  text:     '#cdd6e0',
  textMuted:'#64748b',
  own:      'rgba(42,78,122,0.35)',
  other:    'rgba(30,40,55,0.5)',
}

type Message = {
  id: string
  sender_id: string
  content: string
  created_at: string
  sender?: { username: string }
}

type Props = {
  userId: string
  username: string          // eigener Username
  otherId: string           // Gesprächspartner ID
  otherName: string         // Gesprächspartner Name
  onClose: () => void
  onUnreadChange?: (n: number) => void
}

export default function ChatOverlay({ userId, username, otherId, otherName, onClose, onUnreadChange }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [sending, setSending]   = useState(false)
  const [loading, setLoading]   = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Nachrichten laden
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const token = await getToken()
        const res = await fetch(`/api/game/chat?action=history&userId=${otherId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json() as { messages: Message[] }
        setMessages(data.messages ?? [])
        // Als gelesen markieren
        await fetch('/api/game/chat', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'read', userId: otherId })
        })
        onUnreadChange?.(0)
      } catch {}
      setLoading(false)
    }
    load()
  }, [otherId])

  // Zum Ende scrollen
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Ably: neue Nachrichten empfangen
  useAblyChannel(
    ABLY_CHANNELS.dm(userId),
    ABLY_EVENTS.dm.message,
    (data: any) => {
      if (data?.senderId !== otherId) return // andere Konversation
      const msg: Message = {
        id:         data.id,
        sender_id:  data.senderId,
        content:    data.content,
        created_at: data.createdAt,
        sender:     { username: data.senderUsername },
      }
      setMessages(prev => [...prev, msg])
      // Als gelesen markieren
      getToken().then(token => fetch('/api/game/chat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'read', userId: otherId })
      })).catch(() => {})
    }
  )

  async function send() {
    if (!input.trim() || sending) return
    setSending(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/game/chat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', receiverId: otherId, content: input.trim() })
      })
      const data = await res.json() as { ok: boolean; message: Message }
      if (data.ok) {
        setMessages(prev => [...prev, { ...data.message, sender: { username } }])
        setInput('')
      }
    } catch {}
    setSending(false)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2500, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: '1rem' }}>
      <div style={{ width: 'min(420px, 95vw)', height: 'min(520px, 80vh)', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: '0.58rem', color: C.textMuted, letterSpacing: '0.15em', textTransform: 'uppercase' as const }}>Direktnachricht</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: C.gold }}>💬 {otherName}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', color: C.textMuted, fontSize: '0.9rem' }}>✕</button>
        </div>

        {/* Nachrichten */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {loading && (
            <div style={{ textAlign: 'center', color: C.textMuted, fontSize: '0.75rem', marginTop: '2rem' }}>Lade Nachrichten…</div>
          )}
          {!loading && messages.length === 0 && (
            <div style={{ textAlign: 'center', color: C.textMuted, fontSize: '0.75rem', marginTop: '2rem' }}>
              Noch keine Nachrichten.<br />Schreib {otherName} etwas!
            </div>
          )}
          {messages.map(msg => {
            const isOwn = msg.sender_id === userId
            return (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '75%',
                  background: isOwn ? C.own : C.other,
                  border: `1px solid ${isOwn ? 'rgba(42,78,122,0.6)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: isOwn ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.82rem',
                  color: C.text,
                  lineHeight: 1.5,
                  wordBreak: 'break-word' as const,
                }}>
                  {msg.content}
                </div>
                <div style={{ fontSize: '0.58rem', color: C.textMuted, marginTop: 2, padding: '0 4px' }}>
                  {new Date(msg.created_at).toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Eingabe */}
        <div style={{ padding: '0.75rem', borderTop: `1px solid ${C.border}`, display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Nachricht… (Enter zum Senden)"
            rows={1}
            maxLength={500}
            style={{
              flex: 1, resize: 'none', background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 8, padding: '0.5rem 0.75rem', color: C.text, fontSize: '0.82rem',
              fontFamily: 'inherit', outline: 'none', lineHeight: 1.5,
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            style={{
              background: input.trim() ? C.accent : 'rgba(42,78,122,0.2)',
              border: 'none', borderRadius: 8, padding: '0.5rem 0.85rem',
              color: input.trim() ? '#fff' : C.textMuted,
              cursor: input.trim() ? 'pointer' : 'not-allowed',
              fontSize: '0.85rem', flexShrink: 0,
            }}
          >
            {sending ? '…' : '→'}
          </button>
        </div>
      </div>
    </div>
  )
}
