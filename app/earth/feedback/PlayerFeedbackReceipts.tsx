'use client'

import { useEffect, useRef, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'
import { readPlayerFeedbackReceiptsPayload, type PlayerFeedbackReceiptView } from '@/lib/game/evolution/feedbackReceiptResponse'

type Phase = 'idle' | 'loading' | 'ready' | 'signed_out' | 'unavailable'

/** Private, read-only receipt panel. No submission, publication or world action. */
export default function PlayerFeedbackReceipts() {
  const [expanded, setExpanded] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [receipts, setReceipts] = useState<PlayerFeedbackReceiptView[]>([])
  const active = useRef<AbortController | null>(null)

  useEffect(() => () => active.current?.abort(), [])

  async function load(controller: AbortController) {
    setPhase('loading')
    setReceipts([])
    try {
      const token = await getToken()
      if (controller.signal.aborted) return
      if (!token) { setPhase('signed_out'); return }
      const response = await fetch('/api/game/feedback?limit=20', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      if (response.status === 401) { setPhase('signed_out'); return }
      if (!response.ok) throw new Error('feedback_unavailable')
      const payload: unknown = await response.json()
      if (controller.signal.aborted) return
      const parsed = readPlayerFeedbackReceiptsPayload(payload)
      if (!parsed.ok) throw new Error('invalid_feedback_receipts')
      setReceipts(parsed.receipts)
      setPhase('ready')
    } catch {
      if (!controller.signal.aborted) {
        setReceipts([])
        setPhase('unavailable')
      }
    }
  }

  function refresh() {
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    void load(controller)
  }

  function toggle() {
    if (expanded) {
      active.current?.abort()
      active.current = null
      setReceipts([])
      setPhase('idle')
      setExpanded(false)
    } else {
      setExpanded(true)
      refresh()
    }
  }

  return <section aria-label="Meine Feedback-Einreichungen" style={{ marginTop: 24, borderTop: '1px solid #ccc', paddingTop: 16 }}>
    <h2>Meine Vorschläge</h2>
    <p>Hier erscheinen ausschließlich deine eigenen, tatsächlich gespeicherten Einreichungen.
      Der lokale Entwurf oben wird nicht automatisch gespeichert oder eingereicht.
      Ein Bearbeitungsstatus ist weder eine Abstimmung noch eine Genehmigung zur Änderung der Spielwelt.</p>
    <button type="button" aria-expanded={expanded} onClick={toggle}>
      {expanded ? 'Einreichungen ausblenden' : 'Eigene Einreichungen ansehen'}
    </button>
    {expanded && <div aria-live="polite">
      <button type="button" onClick={refresh} disabled={phase === 'loading'} style={{ marginLeft: 8 }}>
        Aktualisieren
      </button>
      {phase === 'loading' && <p>Einreichungen werden geladen …</p>}
      {phase === 'signed_out' && <p>Bitte melde dich an, um deine Einreichungen zu sehen.</p>}
      {phase === 'unavailable' && <p role="alert">Einreichungen derzeit nicht verfügbar. Die Datenbankanbindung ist möglicherweise noch nicht freigegeben.</p>}
      {phase === 'ready' && receipts.length === 0 && <p>Du hast noch keine gespeicherten Einreichungen.</p>}
      {phase === 'ready' && receipts.length > 0 && <ul>
        {receipts.map(receipt => <li key={receipt.id} style={{ marginBottom: 12 }}>
          <strong>{receipt.title}</strong><br />
          <span>{receipt.label}</span> · <time dateTime={receipt.createdAt}>
            {new Date(receipt.createdAt).toLocaleString('de-DE')}
          </time>
        </li>)}
      </ul>}
    </div>}
  </section>
}
