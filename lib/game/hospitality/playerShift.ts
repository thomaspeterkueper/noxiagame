// lib/game/hospitality/playerShift.ts
// Spieler arbeiten im Lokal (Thomas, 28.10.2026: „man sollte auch im Club
// arbeiten können“). Entschieden:
//   * echte Tätigkeit statt Einstempeln – eine Schicht ist eine Spielstunde;
//   * Stundenlohn vom Betreiber plus Trinkgeld der Gäste, die man bedient;
//   * Stellen: Türsteher, Barkeeper, DJ, Putzkraft – und in den anderen
//     Lokalen Bedienung, Empfang und Putzkraft.
//
// Aufgaben entstehen aus dem, was wirklich passiert (Gäste aus echten Käufen:
// ankommen, bestellen, gehen) und aus festen Pflichten der Stelle (Gläser
// spülen, Kontrollgang, Musik wählen, Boden wischen). Niemand wird erfunden.
// Lohn und Trinkgeld bucht der Server (Request R-20). Reine Regeln.

import { VISIT_TIMES, VISIT_TOTAL_S, isVenueBlocked, venuePath, type VenueKind, type VenueLayout, type VenuePoint } from './venues'
import { VENUE_WC_DOOR } from './venueServices'

export type ShiftRole = 'door' | 'bar' | 'dj' | 'service' | 'reception' | 'cleaning'

export const SHIFT_S = 60 * 60

export const ROLE_LABEL: Readonly<Record<ShiftRole, string>> = {
  door: 'Türsteher', bar: 'Barkeeper', dj: 'DJ', service: 'Bedienung', reception: 'Empfang', cleaning: 'Putzkraft',
}

/** Was die Stelle tut – ein Satz für die Tafel. */
export const ROLE_DUTY: Readonly<Record<ShiftRole, string>> = {
  door: 'Gäste einlassen, Eintritt kassieren, ab und zu einen Kontrollgang machen',
  bar: 'Bestellungen der Gäste ausgeben und Gläser spülen',
  dj: 'Musik wählen und die Tanzfläche füllen',
  service: 'Bestellungen ausgeben und Tische abräumen',
  reception: 'Gäste begrüßen und Schlüssel ordnen',
  cleaning: 'Tische abwischen, Boden wischen, die Toilette sauber halten',
}

/**
 * Vorschlag Stundenlohn (Credits je Spielstunde) – angelehnt an role_wage_rates
 * (Bedienung 55 Cr am Tag ≈ 7 Cr je Stunde). Verbindlich ist, was der Server zahlt (R-20).
 */
export const PROPOSED_WAGE_PER_HOUR: Readonly<Record<ShiftRole, number>> = {
  door: 9, bar: 8, dj: 10, service: 7, reception: 7, cleaning: 6,
}

/** Lohnschlüssel für role_wage_rates (R-20). */
export const ROLE_WAGE_CODE: Readonly<Record<ShiftRole, string>> = {
  door: 'security', bar: 'service', dj: 'dj', service: 'service', reception: 'service', cleaning: 'cleaning',
}

/** Welche Stellen ein Lokal hat. */
export function shiftRolesFor(kind: VenueKind | string): ShiftRole[] {
  switch (kind) {
    case 'nightclub': return ['door', 'bar', 'dj', 'cleaning']
    case 'bar': return ['bar', 'cleaning']
    case 'hotel': return ['reception', 'cleaning']
    case 'cafe': case 'restaurant': return ['service', 'cleaning']
    default: return []
  }
}

const STATION_SPOT: Readonly<Partial<Record<ShiftRole, readonly string[]>>> = {
  door: ['staff-door'],
  bar: ['staff-counter', 'staff-counter-2'],
  service: ['staff-pass', 'staff-counter'],
  reception: ['staff-desk'],
}

/**
 * Wo man in der Stelle steht: der Personalplatz, wenn man ihn zu Fuß erreicht,
 * sonst davor. Der DJ steht vor dem Pult, die Putzkraft beginnt am Tresen.
 */
export function roleStation(layout: VenueLayout, role: ShiftRole, taken: ReadonlySet<string> = new Set()): VenuePoint & { label: string } {
  if (role === 'dj') {
    const booth = layout.furniture.find(item => item.kind === 'dj-booth')
    if (booth) return { x: booth.x + booth.w / 2, y: booth.y + booth.h + 16, label: 'am DJ-Pult' }
  }
  // Ein freier Personalplatz zuerst; ist alles besetzt, steht man daneben am ersten.
  const ids = STATION_SPOT[role] ?? []
  for (const id of [...ids.filter(id => !taken.has(id)), ...ids.filter(id => taken.has(id))]) {
    const spot = layout.spots.find(s => s.id === id)
    if (spot && !isVenueBlocked(layout, spot) && venuePath(layout, layout.start, spot).length >= 2) return { x: spot.x, y: spot.y, label: spot.label }
  }
  return { x: layout.servicePoint.x, y: layout.servicePoint.y, label: layout.servicePoint.locative }
}

export type ShiftTaskKind = 'admit' | 'serve' | 'greet' | 'wipe' | 'rinse' | 'patrol' | 'music' | 'mop' | 'toilet' | 'clear' | 'keys'

export interface ShiftTask {
  key: string
  kind: ShiftTaskKind
  label: string
  at: VenuePoint
  /** Ein Gast war beteiligt – dafür kann es Trinkgeld geben. */
  guest: boolean
}

/** Ein Besuch aus echten Käufen, wie ihn der Innenraum kennt. */
export interface ShiftVisit {
  personId: string
  /** Beginn des Besuchs (ms). */
  startMs: number
  /** Sitzplatz, auf dem der Gast saß (für das Abwischen). */
  seat?: VenuePoint | null
  label?: string
}

const PERIODS: Readonly<Partial<Record<ShiftRole, Array<{ kind: ShiftTaskKind; everyS: number; label: string }>>>> = {
  bar: [{ kind: 'rinse', everyS: 8 * 60, label: 'Gläser spülen' }],
  door: [{ kind: 'patrol', everyS: 10 * 60, label: 'Kontrollgang über die Tanzfläche' }],
  dj: [{ kind: 'music', everyS: 6 * 60, label: 'Nächste Musik wählen' }],
  service: [{ kind: 'clear', everyS: 9 * 60, label: 'Tische abräumen' }],
  reception: [{ kind: 'keys', everyS: 12 * 60, label: 'Schlüssel ordnen' }],
  cleaning: [{ kind: 'mop', everyS: 7 * 60, label: 'Boden wischen' }, { kind: 'toilet', everyS: 15 * 60, label: 'Toilette putzen' }],
}

function dutyPoint(layout: VenueLayout, role: ShiftRole, kind: ShiftTaskKind, index: number): VenuePoint {
  if (kind === 'toilet') return VENUE_WC_DOOR
  if (kind === 'patrol' && layout.danceFloor) return { x: layout.danceFloor.x + layout.danceFloor.w / 2, y: layout.danceFloor.y + layout.danceFloor.h / 2 }
  if (kind === 'mop' || kind === 'clear') {
    // Reihum über die Plätze der Gäste – nur Stellen, die man erreicht.
    const places = layout.spots.filter(s => s.kind !== 'staff' && !s.id.startsWith('entry-') && !isVenueBlocked(layout, s))
    if (places.length) { const p = places[(index * 7) % places.length]; return { x: p.x, y: p.y } }
  }
  return roleStation(layout, role)
}

/**
 * Was jetzt zu tun ist. Gästeaufgaben aus den Besuchen, Pflichten im Takt der
 * Stelle – von jeder Pflicht nur die jüngste offene, damit sich nichts staut.
 */
export function shiftTasks(input: { role: ShiftRole; layout: VenueLayout; startedAtMs: number; nowMs: number; visits: readonly ShiftVisit[]; done: ReadonlySet<string>; taken?: ReadonlySet<string> }): ShiftTask[] {
  const { role, layout, startedAtMs, nowMs, visits, done } = input
  const tasks: ShiftTask[] = []
  const station = roleStation(layout, role, input.taken)
  for (const visit of visits) {
    if (visit.startMs < startedAtMs - 60_000) continue
    const age = (nowMs - visit.startMs) / 1000
    if (age < 0) continue
    const who = visit.label ? ` (${visit.label})` : ''
    if ((role === 'bar' || role === 'service') && age < VISIT_TIMES.orderS + VISIT_TIMES.walkS) tasks.push({ key: `serve:${visit.personId}:${visit.startMs}`, kind: 'serve', label: 'Bestellung ausgeben' + who, at: station, guest: true })
    if (role === 'door' && age < 3 * 60) tasks.push({ key: `admit:${visit.personId}:${visit.startMs}`, kind: 'admit', label: 'Gast einlassen', at: station, guest: true })
    if (role === 'reception' && age < 3 * 60) tasks.push({ key: `greet:${visit.personId}:${visit.startMs}`, kind: 'greet', label: 'Gast begrüßen', at: station, guest: true })
    if (role === 'cleaning' && visit.seat && age > VISIT_TOTAL_S && age < VISIT_TOTAL_S + 20 * 60) tasks.push({ key: `wipe:${visit.personId}:${visit.startMs}`, kind: 'wipe', label: 'Tisch abwischen', at: visit.seat, guest: false })
  }
  const elapsed = Math.max(0, (nowMs - startedAtMs) / 1000)
  for (const duty of PERIODS[role] ?? []) {
    const slot = Math.floor(elapsed / duty.everyS)
    if (slot < 1) continue
    const key = `${duty.kind}:${slot}`
    if (!done.has(key)) tasks.push({ key, kind: duty.kind, label: duty.label, at: dutyPoint(layout, role, duty.kind, slot), guest: false })
  }
  return tasks.filter(task => !done.has(task.key))
}

/** Lohn für die gearbeitete Zeit – anteilig, höchstens eine Schicht. */
export function shiftWage(wagePerHour: number, startedAtMs: number, endedAtMs: number): number {
  const share = Math.min(1, Math.max(0, (endedAtMs - startedAtMs) / 1000 / SHIFT_S))
  return Math.round(wagePerHour * share)
}

export const MUSIC_STYLES = ['House', 'Techno', 'Charts', 'Achtziger'] as const
export type MusicStyle = typeof MUSIC_STYLES[number]

/** Was jemand im Haus darüber weiß, dass der Spieler hier arbeitet. */
export function workingFact(role: ShiftRole, staff: boolean): string {
  return staff
    ? `Dein Gegenüber arbeitet diese Schicht mit dir, als ${ROLE_LABEL[role]}`
    : `Dein Gegenüber arbeitet hier, als ${ROLE_LABEL[role]}`
}
