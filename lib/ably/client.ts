// lib/ably/client.ts
// Erstellt:     19.07.2026
// Aktualisiert: 19.07.2026 — Client-seitiger Ably Hook
// Version:      1.0.0
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
    ablyClient = new Ably.Realtime({ authUrl: '/api/ably/token' })
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

    const channel = client.channels.get(channelName)
    const handler = (msg: Ably.Message) => callbackRef.current(msg.data)

    channel.subscribe(event, handler)
    return () => {
      channel.unsubscribe(event, handler)
    }
  }, [channelName, event])
}
