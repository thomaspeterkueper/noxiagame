// lib/game/chronicle.ts
// Erstellt:     09.10.2026 — Kolonie-Chronik: macht bereits simulierte NPC-Ereignisse im Feed sichtbar
// Aktualisiert: 10.10.2026 — Name und Symbol des Guts `energy` aus lib/constants (NOXIA-ENERGY-0001)
// Version:      1.0.1
//
// Reine Projektion: liest vorhandene Zeilen aus population_events und
// npc_ledger und formuliert sie als Feed-Zeilen. Kein eigener Zustand, keine
// erfundenen Ereignisse – gibt es nichts zu berichten, bleibt die Chronik leer.

import { ENERGY_GOOD_LABEL } from '@/lib/constants'
export type ChronicleItem = { type: 'info' | 'success' | 'warning'; icon: string; text: string }

export type ChroniclePersonEvent = {
  tick: number
  event_type: string
  actor_person_id: string | null
  related_person_id: string | null
  location_id: string | null
  payload: { encounterId?: string; tileEntityId?: string; outcome?: string } | null
}

export type ChronicleLedgerRow = {
  tick: number
  kind: string
  resource: string | null
  goods_delta: number | null
  credit_delta: number | null
  actor_id: string
  location_id: string | null
}

export type ChronicleLookups = {
  currentTick: number
  personName: (id: string | null) => string | undefined
  actorName: (id: string) => string | undefined
  locationName: (id: string | null) => string | undefined
  buildingName: (tileEntityId: string | undefined) => string | undefined
}

const RESOURCE_DE: Record<string, string> = { water: 'Wasser', energy: ENERGY_GOOD_LABEL, metal: 'Metall', components: 'Komponenten' }

function ago(currentTick: number, tick: number): string {
  const hours = Math.max(0, currentTick - tick)
  if (hours === 0) return ''
  return hours < 24 ? ` · vor ${hours} Std.` : ` · vor ${Math.floor(hours / 24)} ${Math.floor(hours / 24) === 1 ? 'Tag' : 'Tagen'}`
}

function place(l: ChronicleLookups, locationId: string | null, tileEntityId?: string): string {
  const parts = [l.buildingName(tileEntityId), l.locationName(locationId)].filter(Boolean)
  return parts.length ? ` · ${parts.join(', ')}` : ''
}

/** Begegnungen und Konflikte; jede Begegnung erzeugt zwei Zeilen (je Person) und wird hier zusammengeführt. */
export function personChronicle(events: ChroniclePersonEvent[], l: ChronicleLookups, maxEncounters = 2): ChronicleItem[] {
  const seen = new Set<string>()
  const conflicts: ChronicleItem[] = []
  const encounters: ChronicleItem[] = []
  const encounterLocations = new Set<string>()
  const sorted = [...events].sort((a, b) => b.tick - a.tick)

  for (const e of sorted) {
    const pair = [e.actor_person_id, e.related_person_id].filter(Boolean).sort().join(':')
    const key = e.payload?.encounterId ?? `${e.tick}:${pair}`
    if (seen.has(key)) continue
    seen.add(key)

    const a = l.personName(e.actor_person_id)
    const b = l.personName(e.related_person_id)
    if (!a || !b) continue
    const where = place(l, e.location_id, e.payload?.tileEntityId)

    if (e.event_type === 'person_conflict') {
      conflicts.push({ type: 'warning', icon: '⚡', text: `Streit zwischen ${a} und ${b}${where}${ago(l.currentTick, e.tick)}` })
    } else if (e.event_type === 'social_interaction') {
      const loc = e.location_id ?? ''
      if (encounterLocations.has(loc) || encounters.length >= maxEncounters) continue
      encounterLocations.add(loc)
      encounters.push({ type: 'info', icon: '👥', text: `${a} und ${b} sind sich begegnet${where}${ago(l.currentTick, e.tick)}` })
    }
  }
  return [...conflicts.slice(0, 2), ...encounters]
}

/** Firmenereignisse: Verkäufe und Bauten einzeln, Produktion je Firma/Gut/Ort und Tick summiert. */
export function economyChronicle(rows: ChronicleLedgerRow[], l: ChronicleLookups): ChronicleItem[] {
  const sales: ChronicleItem[] = []
  const builds: ChronicleItem[] = []
  const produced = new Map<string, { tick: number; actor: string; resource: string; location: string | null; amount: number }>()
  const sorted = [...rows].sort((a, b) => b.tick - a.tick)
  const latestTick = sorted[0]?.tick

  for (const r of sorted) {
    const actor = l.actorName(r.actor_id)
    if (!actor) continue
    const loc = l.locationName(r.location_id)
    const res = r.resource ? (RESOURCE_DE[r.resource] ?? r.resource) : ''
    const amount = Math.abs(Number(r.goods_delta ?? 0))

    if (r.kind === 'sell' && amount > 0) {
      sales.push({ type: 'info', icon: '📦', text: `${actor} verkaufte ${amount} t ${res}${loc ? ` · ${loc}` : ''}${ago(l.currentTick, r.tick)}` })
    } else if (r.kind === 'build') {
      builds.push({ type: 'success', icon: '🏗️', text: `${actor} baut neu${loc ? ` · ${loc}` : ''}${ago(l.currentTick, r.tick)}` })
    } else if (r.kind === 'produce' && amount > 0 && r.tick === latestTick) {
      const key = `${r.actor_id}:${r.resource}:${r.location_id}`
      const entry = produced.get(key) ?? { tick: r.tick, actor, resource: res, location: r.location_id, amount: 0 }
      entry.amount += amount
      produced.set(key, entry)
    }
  }

  const production = [...produced.values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 1)
    .map(p => {
      const loc = l.locationName(p.location)
      return { type: 'info' as const, icon: '⚙️', text: `${p.actor} erzeugte ${p.amount} t ${p.resource}${loc ? ` · ${loc}` : ''}${ago(l.currentTick, p.tick)}` }
    })

  return [...builds.slice(0, 1), ...sales.slice(0, 2), ...production]
}
