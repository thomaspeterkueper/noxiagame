'use client'

// app/components/ConversationReport.tsx
// NOXIA-PRIVACY-0004 (05.11.2026): „Gespräch melden“ unter jedem NPC-Gespräch.
// Gespräche werden nur automatisch ausgewertet; was ein Spieler hier meldet,
// wird als Ausschnitt für das Team lesbar (90 Tage).

import { useState } from 'react'
import { getSessionInfo } from '@/lib/supabase/auth'

const REASONS = [
  ['error', 'Fehler der Figur'],
  ['harassment', 'Unangenehm / Belästigung'],
  ['feedback', 'Rückmeldung'],
  ['other', 'Sonstiges'],
] as const

export default function ConversationReport({ npcId, compact = false }: { npcId?: string | null; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<string>('error')
  const [comment, setComment] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState('')

  async function send() {
    setState('sending'); setError('')
    try {
      const { token } = await getSessionInfo()
      if (!token) throw Error('Bitte anmelden.')
      const r = await fetch('/api/game/conversation-report', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'npc', npcId: npcId ?? undefined, reason, comment: comment.trim() || undefined }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw Error(j.error ?? 'Meldung nicht gesendet.')
      setState('sent'); setOpen(false); setComment('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e)); setState('idle')
    }
  }

  const muted = { fontSize: compact ? 9 : 10, color: '#8ea3ad', lineHeight: 1.4 }
  return <div style={{ marginTop: 4 }}>
    <p style={{ ...muted, margin: 0 }}>
      Automatisch ausgewertet, kein Mensch liest mit – außer bei Verdacht auf reale Straftaten.{' '}
      {state === 'sent'
        ? <span>Danke – der Ausschnitt ist gemeldet.</span>
        : <button type="button" onClick={() => setOpen(v => !v)} style={{ ...muted, background: 'none', border: 0, padding: 0, textDecoration: 'underline', cursor: 'pointer' }}>Gespräch melden</button>}
      {' · '}<a href="/testbetrieb" style={{ color: 'inherit', textDecoration: 'underline' }}>Mehr dazu</a>
    </p>
    {open && <div style={{ marginTop: 4, display: 'grid', gap: 4, fontSize: 11 }}>
      <span style={muted}>Die letzten Sätze dieses Gesprächs werden an das Team geschickt und sind dann lesbar.</span>
      <select value={reason} onChange={e => setReason(e.target.value)} style={{ padding: 4, background: '#06111a', color: '#eef5f8', border: '1px solid #45657c', borderRadius: 4 }}>
        {REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <input value={comment} maxLength={500} onChange={e => setComment(e.target.value)} placeholder="Kurz beschreiben (freiwillig) …" style={{ padding: 4, background: '#06111a', color: '#eef5f8', border: '1px solid #45657c', borderRadius: 4 }}/>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" disabled={state === 'sending'} onClick={() => void send()}>{state === 'sending' ? '…' : 'Melden'}</button>
        <button type="button" onClick={() => setOpen(false)}>Abbrechen</button>
      </div>
      {error && <span role="alert" style={{ color: '#f1a07a' }}>{error}</span>}
    </div>}
  </div>
}
