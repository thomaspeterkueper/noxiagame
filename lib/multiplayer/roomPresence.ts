'use client'

// lib/multiplayer/roomPresence.ts
// Andere Spieler im selben Raum (Thomas, 04.11.2026: „andere Spieler sollten
// gleichzeitig in der gleichen Welt, Bar, Orten usw. sein können“).
// Über Supabase Realtime Presence: Jeder Spieler im Raum meldet Name, Stelle im Raum,
// ob er sitzt, und eine kurze Geste (winkt, prostet zu). Kein Speicher in der
// Datenbank, keine Inhalte außer diesen. Fällt Realtime aus, sieht man niemanden –
// das Spiel läuft weiter.
// Für Tests lässt sich über `globalThis.__NOXIA_PRESENCE__` eine Attrappe einsetzen.

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface PeerState {
  profileId: string
  name: string
  x: number
  y: number
  seated: boolean
  /** Arbeitet der Spieler hier gerade (Schicht)? */
  role: string | null
  /** Kurze Geste, z. B. „winkt“ – mit Zeitpunkt, damit sie wieder verschwindet. */
  emote: { text: string; at: number } | null
  at: number
}

export interface PresenceAdapter {
  join(room: string, me: string, onPeers: (peers: PeerState[]) => void): { track(state: PeerState): void; leave(): void }
}

/** Andere, nicht zu alte Einträge – ohne den Spieler selbst. Rein, für Tests. */
export function peersFrom(state: Record<string, Array<Partial<PeerState>>>, me: string, nowMs: number): PeerState[] {
  const out: PeerState[] = []
  for (const [key, entries] of Object.entries(state)) {
    if (key === me) continue
    const e = entries[entries.length - 1]
    if (!e || typeof e.x !== 'number' || typeof e.y !== 'number') continue
    if (typeof e.at === 'number' && nowMs - e.at > 120_000) continue
    out.push({ profileId: key, name: String(e.name ?? 'Spieler').slice(0, 24), x: e.x, y: e.y, seated: Boolean(e.seated), role: e.role ? String(e.role).slice(0, 24) : null, emote: e.emote && typeof e.emote.at === 'number' ? { text: String(e.emote.text ?? '').slice(0, 30), at: e.emote.at } : null, at: Number(e.at ?? nowMs) })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 12)
}

const supabaseAdapter: PresenceAdapter = {
  join(room, me, onPeers) {
    const channel = createClient().channel(`noxia:room:${room}`, { config: { presence: { key: me } } })
    const sync = () => onPeers(peersFrom(channel.presenceState() as any, me, Date.now()))
    let ready = false
    let pending: PeerState | null = null
    channel.on('presence', { event: 'sync' }, sync).subscribe(status => {
      if (status !== 'SUBSCRIBED') return
      ready = true
      if (pending) void channel.track(pending)
    })
    return {
      track(state) { if (ready) void channel.track(state); else pending = state },
      leave() { void channel.untrack().catch(() => {}); void createClient().removeChannel(channel) },
    }
  },
}

function adapter(): PresenceAdapter {
  return (globalThis as any).__NOXIA_PRESENCE__ ?? supabaseAdapter
}

/**
 * Wer außer mir im Raum ist. `room` = Kennung des Hauses; `me` = eigenes Profil.
 * Die eigene Lage wird höchstens alle 400 ms gemeldet.
 */
export function useRoomPresence(room: string | null, me: { profileId: string; name: string } | null, state: { x: number; y: number; seated: boolean; role: string | null }) {
  const [peers, setPeers] = useState<PeerState[]>([])
  const handle = useRef<ReturnType<PresenceAdapter['join']> | null>(null)
  const emote = useRef<PeerState['emote']>(null)
  const last = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(state)
  latest.current = state

  useEffect(() => {
    if (!room || !me) return
    try { handle.current = adapter().join(room, me.profileId, setPeers) } catch { handle.current = null }
    return () => { handle.current?.leave(); handle.current = null; setPeers([]) }
  }, [room, me?.profileId])

  const send = useMemo(() => () => {
    if (!me || !handle.current) return
    const s = latest.current
    handle.current.track({ profileId: me.profileId, name: me.name, x: Math.round(s.x), y: Math.round(s.y), seated: s.seated, role: s.role, emote: emote.current, at: Date.now() })
    last.current = Date.now()
  }, [me?.profileId, me?.name])

  useEffect(() => {
    if (!handle.current) return
    const wait = Math.max(0, 400 - (Date.now() - last.current))
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(send, wait)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [state.x, state.y, state.seated, state.role, send])

  // Alle 30 s erneuern, damit man nicht als „weg“ gilt, wenn man still steht.
  useEffect(() => { const id = setInterval(send, 30_000); return () => clearInterval(id) }, [send])

  return {
    peers,
    gesture(text: string) { emote.current = { text, at: Date.now() }; send() },
  }
}
