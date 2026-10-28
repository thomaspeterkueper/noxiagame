// app/components/useConversationEnd.ts
// Erstellt:     28.10.2026 — Gesprächsende in allen Gesprächsfenstern sichtbar machen
// Version:      1.0.0
//
// Nach einem Abbruch (Wiederholung, Grenztest) weist die Figur den Spieler
// eine Weile ab; der Server setzt das durch. Dieser Hook merkt sich, bis wann
// das Gespräch mit welcher Figur beendet ist, damit das Fenster das
// Eingabefeld sperrt und „Gespräch beendet“ zeigt, statt weiter Abweisungen
// einzusammeln. Nach Ablauf gibt es das Feld von selbst wieder frei.

import { useCallback, useEffect, useState } from 'react'
import { BREAKOFF_COOLDOWN_MS } from '@/lib/game/cognition/conversationRepeat'

/** Platzhalter für das gesperrte Eingabefeld. */
export const CONVERSATION_ENDED_PLACEHOLDER = 'Gespräch beendet'

type EndSignal = { conversationEnded?: unknown; retryAfterMs?: unknown } | null | undefined

export function useConversationEnd() {
  const [endedUntil, setEndedUntil] = useState<Record<string, number>>({})
  const [now, setNow] = useState(() => Date.now())

  // Zum frühesten Ablauf neu rendern, damit das Feld wieder frei wird.
  useEffect(() => {
    const pending = Object.values(endedUntil).filter(until => until > now)
    if (!pending.length) return
    const timer = setTimeout(() => setNow(Date.now()), Math.max(250, Math.min(...pending) - Date.now()))
    return () => clearTimeout(timer)
  }, [endedUntil, now])

  /** Antwort der Gesprächsroute auswerten; true, wenn das Gespräch damit endet. */
  const noteReply = useCallback((figureId: string | null | undefined, data: EndSignal) => {
    if (!figureId || data?.conversationEnded !== true) return false
    const wait = Number(data.retryAfterMs)
    const at = Date.now()
    const until = at + (Number.isFinite(wait) && wait > 0 ? Math.min(wait, BREAKOFF_COOLDOWN_MS) : BREAKOFF_COOLDOWN_MS)
    setNow(at)
    setEndedUntil(current => ({ ...current, [figureId]: until }))
    return true
  }, [])

  const isEnded = useCallback((figureId: string | null | undefined) => Boolean(figureId && (endedUntil[figureId] ?? 0) > now), [endedUntil, now])

  return { isEnded, noteReply }
}
