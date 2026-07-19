// lib/ably/client.ts
// Erstellt:     19.07.2026
// Aktualisiert: 19.07.2026 — authCallback mit Supabase JWT, leerer Channel-Guard
// Version:      1.1.0
//
// useAbly() gibt einen Ably Realtime Client zurück.
// useAblyChannel() subscribed auf einen Channel und feuert einen Callback.
//
// Graceful Degradation: wenn kein Token-Endpoint erreichbar oder
// ABLY_API_KEY nicht gesetzt → keine Subscription, kein Crash.

'use client'

import { useEffect, useRef } from 'react'
import Ably from 'ably'

// Singleton Ably Client pro Browser-Session
let ablyClient: Ably.Realtime | null = null

function getAblyClient(): Ably.Realtime | null {
  if (typeof window === 'undefined') return null
  if (ablyClient) return ablyClient
  try {
    ablyClient = new Ably.Realtime({
      authCallback: async (_data, callback) => {
        try {
          // JWT aus Supabase Session holen
          const { createClient } = await import('@/lib/supabase/client')
          const sb = createClient()
          const { data: { session } } = await sb.auth.getSession()
          if (!session?.access_token) {
            callback(new Error('Keine Session'), null)
            return
          }
          const res = await fetch('/api/ably/token', {
            headers: { Authorization: `Bearer ${session.access_token}` }
          })
          if (!res.ok) { callback(new Error('Token-Fetch fehlgeschlagen'), null); return }
          const tokenRequest = await res.json()
          callback(null, tokenRequest)
        } catch (err) {
          callback(err instanceof Error ? err : new Error(String(err)), null)
        }
      }
    })
    return ablyClient
  } catch (err) {
    console.warn('[ably] client init failed:', err)
    return null
  }
}

export function useAblyChannel(
  channelName: string,
  event: string,
  callback: (data: unknown) => void
): void {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    const client = getAblyClient()
    if (!client) return

    if (!channelName) return  // Kein Channel wenn userId noch nicht gesetzt

    const channel = client.channels.get(channelName)
    const handler = (msg: Ably.Message) => callbackRef.current(msg.data)

    channel.subscribe(event, handler)
    return () => {
      channel.unsubscribe(event, handler)
    }
  }, [channelName, event])
}
