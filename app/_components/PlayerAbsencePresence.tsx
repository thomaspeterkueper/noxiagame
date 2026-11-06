'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'
import { ABSENCE_POLICY } from '@/lib/game/absenceAutopilot'

type PresenceMode = 'online' | 'idle-warning' | 'away-autopilot'
const API = '/api/game/presence'
const SESSION_KEY = 'noxia-absence-session'

function sessionId(): string {
  let value = sessionStorage.getItem(SESSION_KEY)
  if (!value) {
    value = crypto.randomUUID().replace(/-/g, '')
    sessionStorage.setItem(SESSION_KEY, value)
  }
  return value
}

export default function PlayerAbsencePresence() {
  const [mode, setMode] = useState<PresenceMode>('online')
  const [remainingMs, setRemainingMs] = useState<number | null>(null)
  const [enabled, setEnabled] = useState(false)
  const lastAction = useRef(Date.now())
  const lastSent = useRef(0)
  const inFlight = useRef(false)
  const modeRef = useRef<PresenceMode>('online')
  const session = useRef('')
  const mounted = useRef(false)

  const syncMode = useCallback((next: PresenceMode) => {
    modeRef.current = next
    setMode(next)
  }, [])

  const send = useCallback(async (signal: 'resume' | 'activity' | 'logout' | 'disconnect') => {
    if (inFlight.current || !session.current) return
    inFlight.current = true
    try {
      const token = await getToken()
      if (!token) { setEnabled(false); return }
      const response = await fetch(API, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ signal, sessionId: session.current }),
        cache: 'no-store',
      })
      if (!response.ok) return
      const data = await response.json()
      if (data.presence?.mode) syncMode(data.presence.mode)
      setEnabled(true)
      lastSent.current = Date.now()
    } catch {
      // Losing connection never authorizes unbounded local autonomy.
    } finally { inFlight.current = false }
  }, [syncMode])

  useEffect(() => {
    if (mounted.current) return
    mounted.current = true
    session.current = sessionId()
    void send('resume')

    // Only meaningful actions refresh server presence. No mousemove, fetch polling
    // or passive page visibility events can keep an unattended character online.
    const interaction = () => {
      if (document.visibilityState !== 'visible') return
      lastAction.current = Date.now()
      setRemainingMs(null)
      if (modeRef.current === 'idle-warning') syncMode('online')
      if (modeRef.current === 'away-autopilot') void send('resume')
      else if (Date.now() - lastSent.current >= 30_000) void send('activity')
    }
    document.addEventListener('pointerdown', interaction, { capture: true, passive: true })
    document.addEventListener('keydown', interaction, { capture: true, passive: true })
    const explicitLogout = () => { void send('logout') }
    window.addEventListener('noxia:player-logout', explicitLogout)

    const timer = setInterval(() => {
      if (!enabled || document.visibilityState !== 'visible' || modeRef.current === 'away-autopilot') return
      const elapsed = Date.now() - lastAction.current
      setRemainingMs(elapsed >= ABSENCE_POLICY.warnAfterMs
        ? Math.max(0, ABSENCE_POLICY.handoffAfterMs - elapsed) : null)
      if (elapsed >= ABSENCE_POLICY.handoffAfterMs) syncMode('away-autopilot')
    }, 1000)
    const poll = setInterval(async () => {
      try {
        const token = await getToken()
        if (!token) { setEnabled(false); return }
        const response = await fetch(API, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
        if (response.ok) {
          const data = await response.json()
          if (data.presence?.mode) syncMode(data.presence.mode)
        }
      } catch { /* the server's cron remains authoritative */ }
    }, 60_000)
    return () => {
      clearInterval(timer)
      clearInterval(poll)
      document.removeEventListener('pointerdown', interaction, true)
      document.removeEventListener('keydown', interaction, true)
      window.removeEventListener('noxia:player-logout', explicitLogout)
      mounted.current = false
    }
  }, [send, syncMode, enabled])

  if (!enabled || remainingMs === null || mode === 'away-autopilot') return null
  const seconds = Math.ceil(remainingMs / 1000)
  return (
    <div role="status" aria-live="polite" className="fixed bottom-5 right-5 z-[100] max-w-sm rounded-xl border border-amber-500/50 bg-slate-950 p-4 text-white shadow-xl">
      <p className="font-semibold">Du bist seit einiger Zeit inaktiv.</p>
      <p className="mt-1 text-sm">In {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')} Minuten übernimmt die Simulation deine Figur.</p>
      <button type="button" className="mt-3 rounded-lg bg-amber-400 px-4 py-2 font-semibold text-slate-950"
        onClick={() => { lastAction.current = Date.now(); setRemainingMs(null); void send('resume') }}>
        Weiter spielen
      </button>
    </div>
  )
}
