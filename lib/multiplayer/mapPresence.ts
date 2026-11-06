'use client'

// lib/multiplayer/mapPresence.ts
// Andere Spieler auf der Weltkarte (W-16 Punkt 1, Thomas 04.11.2026: „andere Spieler
// sollten gleichzeitig in der gleichen Welt … sein können“).
// Wie `roomPresence.ts` über Supabase Realtime Presence, aber je Kartenzelle
// (`noxia:cell:<i>:<j>`, rund 1,1 × 1,0 km). Man meldet sich in der eigenen Zelle und hört
// die acht Nachbarzellen mit, damit man sich an Zellgrenzen sieht. Gemeldet werden
// nur Name, Lage (auf ~1 m gerundet), Aussehen der Figur und eine kurze Geste –
// nichts wird in der Datenbank gespeichert. Fällt Realtime aus, sieht man niemanden.

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cleanPlayerLook } from '../figures/playerLook'
import type { KieselLook } from '../figures/kiesel'

export const PRESENCE_CELL_LAT = 0.01, PRESENCE_CELL_LON = 0.015
/** Mitspieler weiter weg als das zeigt die Karte nicht */
export const MAP_PEER_RANGE_M = 1500

export interface MapPeer {
  profileId: string
  name: string
  lat: number
  lon: number
  look: KieselLook | null
  emote: { text: string; at: number } | null
  at: number
}

export function presenceCell(lat: number, lon: number) {
  return { i: Math.floor(lat / PRESENCE_CELL_LAT), j: Math.floor(lon / PRESENCE_CELL_LON) }
}
export const cellKey = (cell: { i: number; j: number }) => `${cell.i}:${cell.j}`

/** Eigene Zelle und die acht Nachbarn (eigene zuerst). */
export function cellsAround(lat: number, lon: number) {
  const c = presenceCell(lat, lon)
  const out = [cellKey(c)]
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) if (di || dj) out.push(cellKey({ i: c.i + di, j: c.j + dj }))
  return out
}

const metres = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
  Math.hypot((a.lat - b.lat) * 111_320, (a.lon - b.lon) * 111_320 * Math.cos(a.lat * Math.PI / 180))

/** Mitspieler aus den Anwesenheitslisten mehrerer Zellen: ohne mich, nicht zu alt, nah genug, je Spieler der neueste Eintrag. Rein, für Tests. */
export function mapPeersFrom(states: Array<Record<string, Array<Partial<MapPeer>>>>, me: string, here: { lat: number; lon: number } | null, nowMs: number): MapPeer[] {
  const best = new Map<string, MapPeer>()
  for (const state of states) for (const [key, entries] of Object.entries(state)) {
    if (key === me) continue
    for (const e of entries) {
      if (typeof e.lat !== 'number' || typeof e.lon !== 'number' || !Number.isFinite(e.lat) || !Number.isFinite(e.lon)) continue
      const at = typeof e.at === 'number' ? e.at : nowMs
      if (nowMs - at > 120_000) continue
      if (here && metres(here, { lat: e.lat, lon: e.lon }) > MAP_PEER_RANGE_M) continue
      const known = best.get(key)
      if (known && known.at >= at) continue
      best.set(key, {
        profileId: key, name: String(e.name ?? 'Spieler').slice(0, 24), lat: e.lat, lon: e.lon,
        look: e.look ? cleanPlayerLook(e.look, key) : null,
        emote: e.emote && typeof e.emote.at === 'number' && nowMs - e.emote.at < 8000 ? { text: String(e.emote.text ?? '').slice(0, 30), at: e.emote.at } : null,
        at,
      })
    }
  }
  return [...best.values()].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 30)
}

export interface MapPresenceAdapter {
  /** Zellen abonnieren; `track` meldet in der ersten (eigenen) Zelle. */
  join(cells: string[], me: string, onState: (cell: string, state: Record<string, Array<Partial<MapPeer>>>) => void): { track(state: MapPeer): void; leave(): void }
}

const supabaseAdapter: MapPresenceAdapter = {
  join(cells, me, onState) {
    const client = createClient()
    const channels = cells.map((cell, index) => {
      const channel = client.channel(`noxia:cell:${cell}`, { config: { presence: { key: me } } })
      channel.on('presence', { event: 'sync' }, () => onState(cell, channel.presenceState() as Record<string, Array<Partial<MapPeer>>>))
      return { channel, own: index === 0, ready: false }
    })
    let pending: MapPeer | null = null
    for (const entry of channels) entry.channel.subscribe(status => {
      if (status !== 'SUBSCRIBED') return
      entry.ready = true
      if (entry.own && pending) void entry.channel.track(pending)
    })
    return {
      track(state) {
        pending = state
        const own = channels[0]
        if (own?.ready) void own.channel.track(state)
      },
      leave() { for (const { channel, own } of channels) { if (own) void channel.untrack().catch(() => {}); void client.removeChannel(channel) } },
    }
  },
}

function adapter(): MapPresenceAdapter {
  return (globalThis as { __NOXIA_MAP_PRESENCE__?: MapPresenceAdapter }).__NOXIA_MAP_PRESENCE__ ?? supabaseAdapter
}

/**
 * Mitspieler auf der Karte um `here`. Die eigene Lage geht höchstens jede Sekunde und
 * nur bei mehr als 1 m Bewegung hinaus, sonst alle 30 s zum Erneuern.
 */
export function useMapPresence(here: { lat: number; lon: number } | null, me: { profileId: string; name: string } | null, look: KieselLook | null) {
  const [peers, setPeers] = useState<MapPeer[]>([])
  const states = useRef(new Map<string, Record<string, Array<Partial<MapPeer>>>>())
  const handle = useRef<ReturnType<MapPresenceAdapter['join']> | null>(null)
  const emote = useRef<MapPeer['emote']>(null)
  const latest = useRef({ here, look })
  useEffect(() => { latest.current = { here, look } }, [here, look])
  const sent = useRef<{ lat: number; lon: number; at: number } | null>(null)
  const ownCell = here ? cellKey(presenceCell(here.lat, here.lon)) : null

  const recompute = useMemo(() => () => {
    if (!me) return
    setPeers(mapPeersFrom([...states.current.values()], me.profileId, latest.current.here, Date.now()))
  }, [me?.profileId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Zellen wechseln, wenn man in eine andere Zelle geht
  useEffect(() => {
    if (!ownCell || !me || !latest.current.here) return
    const cells = cellsAround(latest.current.here.lat, latest.current.here.lon)
    states.current = new Map()
    try { handle.current = adapter().join(cells, me.profileId, (cell, state) => { states.current.set(cell, state); recompute() }) } catch { handle.current = null }
    sent.current = null
    return () => { handle.current?.leave(); handle.current = null; states.current = new Map(); setPeers([]) }
  }, [ownCell, me?.profileId, recompute]) // eslint-disable-line react-hooks/exhaustive-deps

  const send = useMemo(() => (force = false) => {
    const position = latest.current.here
    if (!me || !handle.current || !position) return
    const last = sent.current, now = Date.now()
    if (!force && last && now - last.at < 1000) return
    if (!force && last && metres(last, position) < 1 && now - last.at < 30_000) return
    handle.current.track({ profileId: me.profileId, name: me.name, lat: Math.round(position.lat * 1e5) / 1e5, lon: Math.round(position.lon * 1e5) / 1e5, look: latest.current.look, emote: emote.current, at: now })
    sent.current = { lat: position.lat, lon: position.lon, at: now }
  }, [me?.profileId, me?.name]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { send() }, [here?.lat, here?.lon, look, send, ownCell]) // eslint-disable-line react-hooks/exhaustive-deps
  // Erneuern, Abstände neu rechnen und alte Gesten ausblenden
  useEffect(() => { const id = setInterval(() => { send(); recompute() }, 5000); return () => clearInterval(id) }, [send, recompute])

  return {
    peers,
    /** Kurze Geste für alle in der Nähe (z. B. „winkt“). */
    gesture(text: string) { emote.current = { text: text.slice(0, 30), at: Date.now() }; send(true) },
  }
}
