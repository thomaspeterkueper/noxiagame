// lib/game/hospitality/playerShift.ts
// Spieler arbeiten im Lokal (Thomas, 28.10.2026: „man sollte auch im Club
// arbeiten können“). Entschieden:
//   * echte Tätigkeit statt Einstempeln;
//   * Zeit (Thomas, 28.10.2026: „kein Spieler wartet 4 echte Stunden als
//     Türsteher“): Man spielt einen kurzen, dichten Einsatz (EINSATZ_S, fünf
//     echte Minuten); gebucht wird eine ganze Schicht von SHIFT_GAME_HOURS
//     Spielstunden – wie Begegnungen in NOXIA-TIME-0001 (Echtzeit-Ereignis
//     fester Dauer). Die echten Käufe dieser Stunden werden in den Einsatz
//     verdichtet; es kommt kein Gast hinzu, den es nicht gab;
//   * Stundenlohn vom Betreiber plus Trinkgeld der Gäste, die man bedient;
//   * Stellen: Türsteher, Barkeeper, DJ, Putzkraft – und in den anderen
//     Lokalen Bedienung, Empfang und Putzkraft.
//
// Aufgaben entstehen aus dem, was wirklich passiert (Gäste aus echten Käufen:
// ankommen, bestellen, gehen) und aus festen Pflichten der Stelle (Gläser
// spülen, Kontrollgang, Musik wählen, Boden wischen). Niemand wird erfunden.
// Lohn und Trinkgeld bucht der Server (Request R-20). Reine Regeln.

import { isVenueBlocked, venuePath, type VenueKind, type VenueLayout, type VenuePoint } from './venues'
import { VENUE_WC_DOOR } from './venueServices'

export type ShiftRole = 'door' | 'bar' | 'dj' | 'service' | 'reception' | 'cleaning'

/** Wie lange man spielt (echte Sekunden). */
export const EINSATZ_S = 5 * 60

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
/** Wie viele Spielstunden ein Einsatz als Schicht zählt. */
export const SHIFT_GAME_HOURS: Readonly<Record<ShiftRole, number>> = {
  door: 4, bar: 4, dj: 4, service: 4, reception: 4, cleaning: 3,
}

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

/** Ein Gast im Einsatz – aus einem echten Kauf, auf die Einsatzzeit verdichtet. */
export interface ShiftVisit {
  personId: string
  /** Beginn des Besuchs im Einsatz (ms). */
  startMs: number
  /** Sitzplatz, auf dem der Gast saß (für das Abwischen); sonst ein fester Platz je Person. */
  seat?: VenuePoint | null
  label?: string
}

export interface ShiftPurchase { personId: string; atMs: number; label?: string }

/**
 * Die echten Käufe der letzten Spielstunden der Schicht, verdichtet auf den
 * Einsatz: Ein Kauf vor drei Stunden kommt früh im Einsatz, einer von eben spät.
 * Zwischen dem ersten und letzten Gast bleibt Luft für die Pflichten.
 */
export function compressPurchases(purchases: readonly ShiftPurchase[], einsatzStartMs: number, gameHours: number): ShiftVisit[] {
  const windowMs = gameHours * 3600_000
  const from = einsatzStartMs - windowMs
  const lead = 15_000, tail = 45_000
  const span = EINSATZ_S * 1000 - lead - tail
  return purchases
    .filter(p => p.atMs >= from && p.atMs <= einsatzStartMs)
    .sort((a, b) => a.atMs - b.atMs)
    .map(p => ({ personId: p.personId, label: p.label, startMs: einsatzStartMs + lead + Math.round(((p.atMs - from) / windowMs) * span) }))
}

/** Pflichten im verdichteten Takt (echte Sekunden). */
const PERIODS: Readonly<Partial<Record<ShiftRole, Array<{ kind: ShiftTaskKind; everyS: number; label: string }>>>> = {
  bar: [{ kind: 'rinse', everyS: 40, label: 'Gläser spülen' }],
  door: [{ kind: 'patrol', everyS: 60, label: 'Kontrollgang über die Tanzfläche' }],
  dj: [{ kind: 'music', everyS: 35, label: 'Nächste Musik wählen' }],
  service: [{ kind: 'clear', everyS: 45, label: 'Tische abräumen' }],
  reception: [{ kind: 'keys', everyS: 60, label: 'Schlüssel ordnen' }],
  cleaning: [{ kind: 'mop', everyS: 40, label: 'Boden wischen' }, { kind: 'toilet', everyS: 90, label: 'Toilette putzen' }],
}
/** Wie lange eine Gästeaufgabe offen bleibt (echte Sekunden im Einsatz). */
const GUEST_TASK_S = 30
const WIPE_AFTER_S = 45
const WIPE_OPEN_S = 75

function guestPlaces(layout: VenueLayout) {
  return layout.spots.filter(s => s.kind !== 'staff' && !s.id.startsWith('entry-') && !isVenueBlocked(layout, s))
}

function hashIndex(value: string, n: number): number {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0
  return n > 0 ? h % n : 0
}

function dutyPoint(layout: VenueLayout, role: ShiftRole, kind: ShiftTaskKind, index: number): VenuePoint {
  if (kind === 'toilet') return VENUE_WC_DOOR
  if (kind === 'patrol' && layout.danceFloor) return { x: layout.danceFloor.x + layout.danceFloor.w / 2, y: layout.danceFloor.y + layout.danceFloor.h / 2 }
  if (kind === 'mop' || kind === 'clear') {
    // Reihum über die Plätze der Gäste – nur Stellen, die man erreicht.
    const places = guestPlaces(layout)
    if (places.length) { const p = places[(index * 7) % places.length]; return { x: p.x, y: p.y } }
  }
  return roleStation(layout, role)
}

/**
 * Was jetzt zu tun ist. Gästeaufgaben aus den verdichteten Besuchen, Pflichten
 * im Takt der Stelle – von jeder Pflicht nur die jüngste offene, damit sich nichts staut.
 */
export function shiftTasks(input: { role: ShiftRole; layout: VenueLayout; startedAtMs: number; nowMs: number; visits: readonly ShiftVisit[]; done: ReadonlySet<string>; taken?: ReadonlySet<string> }): ShiftTask[] {
  const { role, layout, startedAtMs, nowMs, visits, done } = input
  const tasks: ShiftTask[] = []
  const station = roleStation(layout, role, input.taken)
  const places = guestPlaces(layout)
  for (const visit of visits) {
    const age = (nowMs - visit.startMs) / 1000
    if (age < 0 || visit.startMs < startedAtMs) continue
    const who = visit.label ? ` (${visit.label})` : ''
    if ((role === 'bar' || role === 'service') && age < GUEST_TASK_S) tasks.push({ key: `serve:${visit.personId}:${visit.startMs}`, kind: 'serve', label: 'Bestellung ausgeben' + who, at: station, guest: true })
    if (role === 'door' && age < GUEST_TASK_S) tasks.push({ key: `admit:${visit.personId}:${visit.startMs}`, kind: 'admit', label: 'Gast einlassen', at: station, guest: true })
    if (role === 'reception' && age < GUEST_TASK_S) tasks.push({ key: `greet:${visit.personId}:${visit.startMs}`, kind: 'greet', label: 'Gast begrüßen', at: station, guest: true })
    if (role === 'cleaning' && age > WIPE_AFTER_S && age < WIPE_AFTER_S + WIPE_OPEN_S) {
      const seat = visit.seat ?? (places.length ? places[hashIndex(visit.personId, places.length)] : station)
      tasks.push({ key: `wipe:${visit.personId}:${visit.startMs}`, kind: 'wipe', label: 'Tisch abwischen', at: { x: seat.x, y: seat.y }, guest: false })
    }
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

/**
 * Lohn: die ganze Schicht (Spielstunden × Stundenlohn), wenn man den Einsatz
 * zu Ende spielt; wer früher geht, bekommt den Anteil.
 */
export function shiftWage(wagePerHour: number, gameHours: number, startedAtMs: number, endedAtMs: number): number {
  const share = Math.min(1, Math.max(0, (endedAtMs - startedAtMs) / 1000 / EINSATZ_S))
  return Math.round(wagePerHour * gameHours * share)
}

export const MUSIC_STYLES = ['House', 'Techno', 'Charts', 'Achtziger'] as const
export type MusicStyle = typeof MUSIC_STYLES[number]

/** Was jemand im Haus darüber weiß, dass der Spieler hier arbeitet. */
export function workingFact(role: ShiftRole, staff: boolean): string {
  return staff
    ? `Dein Gegenüber arbeitet diese Schicht mit dir, als ${ROLE_LABEL[role]}`
    : `Dein Gegenüber arbeitet hier, als ${ROLE_LABEL[role]}`
}
