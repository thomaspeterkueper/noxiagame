// lib/ably/server.ts
// Erstellt:     19.07.2026
// Aktualisiert: 19.07.2026 — Server-seitiges Ably Publishing
// Version:      1.1.0
//
// Wird in API-Routes und Cron-Jobs importiert.
// Schlägt lautlos fehl wenn ABLY_API_KEY nicht gesetzt — kein Hard Crash.

import Ably from 'ably'
import { ABLY_CHANNELS, ABLY_EVENTS } from './channels'

function getClient(): Ably.Rest | null {
  const key = process.env.ABLY_API_KEY
  if (!key) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[ably] ABLY_API_KEY nicht gesetzt — Realtime deaktiviert')
    }
    return null
  }
  return new Ably.Rest({ key })
}

async function publish(channel: string, event: string, data: unknown): Promise<void> {
  const client = getClient()
  if (!client) return
  try {
    await client.channels.get(channel).publish(event, data)
  } catch (err) {
    console.error('[ably] publish error:', channel, event, err)
  }
}

// ── Preise aktualisiert ────────────────────────────────────────────────────
export async function publishPricesUpdated(locationCount: number): Promise<void> {
  await publish(ABLY_CHANNELS.prices, ABLY_EVENTS.prices.updated, {
    ts: Date.now(),
    locationCount,
  })
}

// ── Neue Transaktion ───────────────────────────────────────────────────────
export async function publishTransaction(tx: {
  profileId: string
  username?: string
  resource: string
  amount: number
  profit: number
  fromLocation: string
  toLocation: string
}): Promise<void> {
  await publish(ABLY_CHANNELS.transactions, ABLY_EVENTS.transaction.new, {
    ...tx,
    ts: Date.now(),
  })
}

// ── Bau fertig ────────────────────────────────────────────────────────────
export async function publishBuildCompleted(userId: string, data: {
  entityId: string
  entityName: string
  locationSlug: string
}): Promise<void> {
  await publish(ABLY_CHANNELS.builds(userId), ABLY_EVENTS.build.completed, {
    ...data,
    ts: Date.now(),
  })
}

// ── Verkauf fertig ────────────────────────────────────────────────────────
export async function publishBuildSold(userId: string, data: {
  entityId: string
  payout: number
}): Promise<void> {
  await publish(ABLY_CHANNELS.builds(userId), ABLY_EVENTS.build.sold, {
    ...data,
    ts: Date.now(),
  })
}

// ── Direktnachricht ──────────────────────────────────────────────────────
export async function publishDirectMessage(receiverId: string, msg: {
  id: string
  senderId: string
  senderUsername: string
  content: string
  createdAt: string
}): Promise<void> {
  await publish(ABLY_CHANNELS.dm(receiverId), ABLY_EVENTS.dm.message, msg)
}

// ── Weltdaten aktualisiert ────────────────────────────────────────────────
export async function publishWorldUpdated(): Promise<void> {
  await publish(ABLY_CHANNELS.world, ABLY_EVENTS.world.updated, {
    ts: Date.now(),
  })
}
