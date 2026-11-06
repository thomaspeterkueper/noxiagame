'use client'

// lib/multiplayer/sitePresence.ts
// Gemeinsames Erleben im Erlebnis-Studio (Thomas, 06.11.2026): Wer in derselben Gruppe (party_id) im Pod liegt,
// sieht die anderen in der Erlebniswelt. Wie mapPresence über Supabase Realtime Presence, aber je Gruppe
// (`noxia:site:<partyId>`); nichts wird gespeichert. Fällt Realtime aus, sieht man niemanden.

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface SitePeer { profileId: string; name: string; x: number; y: number; at: number }

const MAX_AGE_MS = 20_000
const LIMIT = 8

/** Mitspieler aus dem Anwesenheitsstand: ohne mich, nicht zu alt, gültige Zahlen, je Spieler der neueste Eintrag. Rein, für Tests. */
export function sitePeersFrom(state: Record<string, Array<Partial<SitePeer>>>, me: string, nowMs: number): SitePeer[] {
  const out: SitePeer[] = []
  for (const [key, entries] of Object.entries(state)) {
    if (key === me) continue
    let best: SitePeer | null = null
    for (const e of entries) {
      if (typeof e.x !== 'number' || typeof e.y !== 'number' || !Number.isFinite(e.x) || !Number.isFinite(e.y)) continue
      const at = typeof e.at === 'number' ? e.at : nowMs
      if (nowMs - at > MAX_AGE_MS) continue
      if (best && best.at >= at) continue
      best = { profileId: key, name: String(e.name ?? 'Gast').slice(0, 24), x: Math.round(e.x * 10) / 10, y: Math.round(e.y * 10) / 10, at }
    }
    if (best) out.push(best)
  }
  return out.sort((a, b) => a.name.localeCompare(b.name)).slice(0, LIMIT)
}

export interface SitePresenceAdapter {
  join(channel: string, me: string, onState: (state: Record<string, Array<Partial<SitePeer>>>) => void): { track(state: SitePeer): void; leave(): void }
}

const supabaseAdapter: SitePresenceAdapter = {
  join(name, me, onState) {
    const client = createClient()
    const channel = client.channel(name, { config: { presence: { key: me } } })
    channel.on('presence', { event: 'sync' }, () => onState(channel.presenceState() as Record<string, Array<Partial<SitePeer>>>))
    let ready = false
    let pending: SitePeer | null = null
    channel.subscribe(status => { if (status === 'SUBSCRIBED') { ready = true; if (pending) void channel.track(pending) } })
    return {
      track(state) { pending = state; if (ready) void channel.track(state) },
      leave() { void channel.untrack().catch(() => {}); void client.removeChannel(channel) },
    }
  },
}

function adapter(): SitePresenceAdapter {
  return (globalThis as { __NOXIA_SITE_PRESENCE__?: SitePresenceAdapter }).__NOXIA_SITE_PRESENCE__ ?? supabaseAdapter
}

/**
 * Gruppenmitglieder in der Erlebniswelt. `share(x, y)` meldet die eigene Lage (höchstens alle 400 ms,
 * ohne Bewegung alle 10 s zum Erneuern). Ohne Gruppe oder Namen tut der Hook nichts.
 */
export function useSitePresence(partyId: string | null, me: { profileId: string; name: string } | null) {
  const [peers, setPeers] = useState<SitePeer[]>([])
  const handle = useRef<ReturnType<SitePresenceAdapter['join']> | null>(null)
  const last = useRef<{ x: number; y: number; at: number } | null>(null)
  const mine = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!partyId || !me) return
    try { handle.current = adapter().join(`noxia:site:${partyId}`, me.profileId, state => setPeers(sitePeersFrom(state, me.profileId, Date.now()))) } catch { handle.current = null }
    const refresh = setInterval(() => {
      if (mine.current && handle.current) handle.current.track({ profileId: me.profileId, name: me.name, ...mine.current, at: Date.now() })
      setPeers(prev => prev.filter(peer => Date.now() - peer.at <= MAX_AGE_MS))
    }, 10_000)
    return () => { clearInterval(refresh); handle.current?.leave(); handle.current = null; setPeers([]) }
  }, [partyId, me?.profileId, me?.name]) // eslint-disable-line react-hooks/exhaustive-deps

  const share = useMemo(() => (x: number, y: number) => {
    mine.current = { x, y }
    const now = Date.now()
    if (!me || !handle.current) return
    if (last.current && now - last.current.at < 400) return
    if (last.current && Math.hypot(last.current.x - x, last.current.y - y) < 0.5 && now - last.current.at < 10_000) return
    last.current = { x, y, at: now }
    handle.current.track({ profileId: me.profileId, name: me.name, x, y, at: now })
  }, [me?.profileId, me?.name]) // eslint-disable-line react-hooks/exhaustive-deps

  return { peers, share }
}
