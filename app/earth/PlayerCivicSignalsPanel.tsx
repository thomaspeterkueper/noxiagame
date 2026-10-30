'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'
import { readPlayerCivicSignalsPayload, type PlayerCivicSignalView } from '@/lib/game/civic/playerCivicSignalView'

type Phase = 'idle' | 'loading' | 'ready' | 'signed_out' | 'error'
const kindLabel: Record<PlayerCivicSignalView['kind'], string> = {
  blocked: 'Hindernis', missing: 'Fehlt', wish: 'Wunsch',
  seeking: 'Gesucht', how_to: 'Frage',
}

/** Optional private Earth-page reader; never submits, votes or mutates world state. */
export default function PlayerCivicSignalsPanel() {
  const [expanded, setExpanded] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [signals, setSignals] = useState<PlayerCivicSignalView[]>([])
  const currentRequest = useRef<AbortController | null>(null)

  const load = useCallback(async (signal: AbortSignal) => {
    setPhase('loading')
    try {
      const token = await getToken()
      if (signal.aborted) return
      if (!token) {
        setSignals([])
        setPhase('signed_out')
        return
      }
      const response = await fetch('/api/game/civic-signals?limit=20', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
        signal,
      })
      if (signal.aborted) return
      if (response.status === 401) {
        setSignals([])
        setPhase('signed_out')
        return
      }
      if (!response.ok) throw new Error('signals_unavailable')
      const payload: unknown = await response.json()
      if (signal.aborted) return
      const parsed = readPlayerCivicSignalsPayload(payload)
      if (!parsed.ok) throw new Error('invalid_signals_response')
      setSignals(parsed.signals)
      setPhase('ready')
    } catch {
      if (!signal.aborted) {
        setSignals([])
        setPhase('error')
      }
    }
  }, [])

  useEffect(() => {
    if (!expanded) return
    const controller = new AbortController()
    currentRequest.current = controller
    void load(controller.signal)
    return () => {
      controller.abort()
      if (currentRequest.current === controller) currentRequest.current = null
    }
  }, [expanded, load])

  const refresh = () => {
    currentRequest.current?.abort()
    const controller = new AbortController()
    currentRequest.current = controller
    void load(controller.signal)
  }

  return (
    <section aria-label="Private Gesprächshinweise" style={{
      maxWidth: 1400, margin: '18px auto', padding: 16,
      background: '#f2efe7', color: '#25363b', border: '1px solid #c9c3b5',
      borderRadius: 13, fontFamily: 'system-ui, sans-serif',
    }}>
      <h2 style={{ margin: '0 0 5px', fontSize: 22, fontFamily: 'Georgia, serif' }}>
        Deine Gesprächshinweise
      </h2>
      <p style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.5 }}>
        Privat: Hinweise aus deinen gespeicherten NPC-Gesprächen. Keine öffentlichen Anträge,
        Abstimmungen oder Beschlüsse. Ortsangaben sind ungeprüft.
      </p>
      <button type="button" aria-expanded={expanded} onClick={() => {
        if (expanded) {
          currentRequest.current?.abort()
          setSignals([])
          setPhase('idle')
        }
        setExpanded(!expanded)
      }} style={{ cursor: 'pointer', padding: '8px 12px', borderRadius: 7,
        background: '#17383a', color: '#fff', border: 'none' }}>
        {expanded ? 'Hinweise schließen' : 'Eigene Hinweise ansehen'}
      </button>
      {expanded && (
        <div style={{ marginTop: 12 }} aria-live="polite">
          <button type="button" onClick={refresh} disabled={phase === 'loading'}
            style={{ padding: '6px 10px', cursor: phase === 'loading' ? 'wait' : 'pointer' }}>
            Aktualisieren
          </button>
          {phase === 'loading' && <p>Hinweise werden geladen …</p>}
          {phase === 'signed_out' && <p>Bitte melde dich an, um deine eigenen Hinweise zu sehen.</p>}
          {phase === 'error' && <p>Hinweise derzeit nicht verfügbar. Bitte später erneut versuchen.</p>}
          {phase === 'ready' && signals.length === 0 && <p>In deinen gespeicherten Gesprächen wurden noch keine Hinweise erkannt.</p>}
          {phase === 'ready' && signals.length > 0 && (
            <ul style={{ paddingLeft: 22, display: 'grid', gap: 10 }}>
              {signals.map(item => (
                <li key={item.id} style={{ lineHeight: 1.45 }}>
                  <strong>{kindLabel[item.kind]}: {item.subject}</strong>
                  <div style={{ fontSize: 12 }}>
                    Ungeprüft · {new Date(item.occurredAt).toLocaleString('de-DE')}
                    {item.unverifiedPlaceLabel && ` · Ortsangabe (ungeprüft): ${item.unverifiedPlaceLabel}`}
                  </div>
                  <small>Beleg: {item.sourceRef}{item.npcDenied ? ' · NPC hat widersprochen' : ''}</small>
                </li>
              ))}
            </ul>
          )}
          <p style={{ fontSize: 11, color: '#617075' }}>
            Gesprächshinweise lösen keine Veränderungen der Spielwelt aus.
          </p>
        </div>
      )}
    </section>
  )
}
