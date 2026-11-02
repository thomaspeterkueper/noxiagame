'use client'
// Zustand der offenen Gesprächsrunde (Thomas, 02.11.2026): Verlauf, Lesen, Weiterführen im Takt
// und Mitreden. Eigener Baustein, damit der Raum die Sprechblasen über den Figuren zeichnen
// kann und das Fenster nur den Verlauf zeigt. Server: /api/game/round-talk.

import { useCallback, useEffect, useRef, useState } from 'react'
import { getSessionInfo } from '@/lib/supabase/auth'
import { ROUND_TICK_MS } from '@/lib/game/rounds/roundTalk'

export type RoundLine = { id: number; at?: string; name: string; text: string; speakerId: string | null; mine: boolean }

const EMPTY: RoundLine[] = []

export function useRoundTalk({ enabled, roundKey, placeName, label, people }: {
  enabled: boolean
  roundKey: string
  placeName: string
  label: string
  people: Array<{ id: string; name: string }>
}) {
  const [store, setStore] = useState<{ key: string; list: RoundLine[] }>({ key: roundKey, list: [] })
  const lines = store.key === roundKey ? store.list : EMPTY
  const [sending, setSending] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const after = useRef(0)
  const keyRef = useRef(roundKey)
  const peopleKey = people.map(person => person.id).join(',')

  const merge = useCallback((incoming: RoundLine[]) => {
    if (!incoming.length) return
    setStore(current => {
      // Andere Runde (anderer Raum oder Termin): von vorn beginnen.
      const base = current.key === roundKey ? current.list : []
      after.current = Math.max(after.current, ...incoming.map(line => line.id))
      const known = new Set(base.map(line => line.id))
      return { key: roundKey, list: [...base, ...incoming.filter(line => !known.has(line.id))].slice(-40) }
    })
  }, [roundKey])

  const call = useCallback(async (extra: Record<string, unknown> = {}) => {
    const { token } = await getSessionInfo()
    if (!token) return null
    const response = await fetch('/api/game/round-talk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ roundKey, placeName, label, participants: peopleKey.split(',').filter(Boolean), after: after.current, ...extra }),
    })
    const json = await response.json().catch(() => ({}))
    return { ok: response.ok, status: response.status, json }
  }, [roundKey, placeName, label, peopleKey])

  // Lesen alle paar Sekunden, die Runde weiterführen im Takt – nur solange sie sichtbar ist.
  useEffect(() => {
    if (!enabled) return
    if (keyRef.current !== roundKey) { keyRef.current = roundKey; after.current = 0 }
    let live = true
    const poll = async () => {
      if (document.hidden) return
      try {
        const { token } = await getSessionInfo()
        if (!token) return
        const response = await fetch('/api/game/round-talk?roundKey=' + encodeURIComponent(roundKey) + '&after=' + after.current, { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' })
        const json = await response.json().catch(() => ({}))
        if (live && response.ok) merge(json.lines ?? [])
      } catch { /* nächster Versuch */ }
    }
    const advance = async () => {
      if (document.hidden) return
      try { const result = await call(); if (live && result?.ok) merge(result.json.lines ?? []) } catch { /* nächster Versuch */ }
    }
    void advance()
    const reader = setInterval(poll, 7000)
    const driver = setInterval(advance, ROUND_TICK_MS + 2000)
    return () => { live = false; clearInterval(reader); clearInterval(driver) }
  }, [enabled, roundKey, call, merge])

  /** true, wenn die Eingabe angenommen wurde (Feld leeren). */
  const say = useCallback(async (message: string): Promise<boolean> => {
    const clean = message.trim()
    if (!clean || sending) return false
    setSending(true); setNote(null)
    try {
      const result = await call({ text: clean })
      if (!result) return false
      if (result.status === 429) { setNote('Langsam – gib der Runde einen Moment.'); return false }
      if (!result.ok) { setNote('Die Runde kann gerade nicht antworten.'); return false }
      merge(result.json.lines ?? [])
      if (result.json.help) { setNote(String(result.json.help)); return false }
      return true
    } finally { setSending(false) }
  }, [call, merge, sending])

  return { lines, sending, note, say }
}
