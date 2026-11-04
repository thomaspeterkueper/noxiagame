'use client'

import { useEffect } from 'react'
import { getToken } from '@/lib/supabase/auth'

// Approximate presence: a visible dashboard sends a timestamp every 45 seconds.
// A missed heartbeat expires naturally on the admin side. No background tracking.
export default function PlayerPresenceHeartbeat() {
  useEffect(() => {
    let stopped = false
    async function send() {
      if (stopped || document.visibilityState !== 'visible') return
      try {
        const token = await getToken()
        if (!token || stopped) return
        await fetch('/api/game/presence-heartbeat', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
      } catch { /* telemetry must never interrupt gameplay */ }
    }
    void send()
    const interval = window.setInterval(() => void send(), 45_000)
    const visible = () => { if (document.visibilityState === 'visible') void send() }
    document.addEventListener('visibilitychange', visible)
    return () => {
      stopped = true
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [])
  return null
}
