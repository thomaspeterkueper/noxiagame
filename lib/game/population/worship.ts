// lib/game/population/worship.ts
// Gottesdienste und Gebete als erlebbare Termine (Thomas, 28.10.2026: „alle 4“).
//
// Reine Regeln ohne Datenbank: wer zur Gemeinde eines Termins kommt, wann der
// nächste Termin ist, wie ein Termin abläuft und welche Sondertermine gelten.
// Es gibt nur die eine Spieluhr (Tick = eine Stunde, Woche ab Montag 0 Uhr).
// Teilnahme bedeutet nie Glauben oder Zugehörigkeit.

export type ActivityKind =
  | 'open_community' | 'service' | 'resonance_round'
  | 'friday_prayer' | 'shabbat' | 'aarti' | 'dharma_service'

export type Tradition = 'catholic' | 'protestant' | 'muslim' | 'jewish' | 'hindu' | 'buddhist' | 'omnizedenz'

export interface ActivityWindow { kind: ActivityKind; label: string; startTick: number; endTick: number }

// ── Gemeinde ──────────────────────────────────────────────────────────

/** Höchstzahl der Besucher je Anlass (ohne Gastgeber). */
export const CONGREGATION_CAP: Record<ActivityKind, number> = {
  service: 10, friday_prayer: 10, shabbat: 8, aarti: 8, dharma_service: 6, resonance_round: 6, open_community: 2,
}
/** Wer so nah wohnt, gehört zur Nachbarschaft des Ortes. */
export const NEIGHBOUR_RADIUS_M = 900
/** Anteil der Nachbarschaft, der zu einem Termin kommt (nach Nähe abgestuft). */
export const NEIGHBOUR_SHARE = 0.3

/** Fester Zufall je Person und Termin (FNV-1a), damit jeder Tick dieselbe Gemeinde ergibt. */
export function seededShare(key: string) {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619) }
  return ((h >>> 0) % 100000) / 100000
}

/**
 * Wer zu einem Termin kommt: Menschen mit enger Beziehung zur Gastgeberin oder
 * zum Gastgeber (Zuneigung ≥ 0,5) und ein Teil der Nachbarschaft – je näher,
 * desto eher. Keine erfundene Konfession, keine Zufallsreligion: nur Beziehung
 * und Nähe. Ergebnis nach festem Zufall sortiert und gedeckelt.
 */
export function pickCongregation(input: {
  kind: ActivityKind
  windowStart: number
  relations: ReadonlyArray<{ id: string; affinity: number }>
  neighbours: ReadonlyArray<{ id: string; distanceM: number }>
  exclude?: ReadonlySet<string>
}): string[] {
  const cap = CONGREGATION_CAP[input.kind]
  const exclude = input.exclude ?? new Set<string>()
  const chosen = new Map<string, number>()
  for (const relation of input.relations) {
    if (exclude.has(relation.id) || relation.affinity < 0.5) continue
    const roll = seededShare(`${relation.id}:${input.windowStart}:rel`)
    // Enge Beziehungen kommen meist; ganz sicher ist niemand.
    if (roll < 0.35 + relation.affinity * 0.6) chosen.set(relation.id, roll - 1)
  }
  for (const neighbour of input.neighbours) {
    if (exclude.has(neighbour.id) || chosen.has(neighbour.id) || neighbour.distanceM > NEIGHBOUR_RADIUS_M) continue
    const roll = seededShare(`${neighbour.id}:${input.windowStart}:nb`)
    const share = NEIGHBOUR_SHARE * (1 - 0.6 * neighbour.distanceM / NEIGHBOUR_RADIUS_M)
    if (roll < share) chosen.set(neighbour.id, roll)
  }
  return [...chosen.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).slice(0, cap).map(([id]) => id)
}

// ── Termine ───────────────────────────────────────────────────────────

const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

/** „So 10 Uhr“ für den Beginn eines Termins. */
export function windowStartLabel(startTick: number) {
  const day = Math.floor(startTick / 24) % 7, hour = ((startTick % 24) + 24) % 24
  return `${DAY_NAMES[day]} ${hour} Uhr`
}

/** Laufender Termin und nächster Beginn (bis eine Woche voraus). */
export function scheduleAt(windows: (tick: number) => ActivityWindow[], tick: number, extra: readonly ActivityWindow[] = []) {
  const active = (t: number) => [...windows(t), ...extra.filter(window => t >= window.startTick && t < window.endTick)]
  const running = active(tick)[0] ?? null
  let next: ActivityWindow | null = null
  for (let t = tick + 1; t <= tick + 168 && !next; t++) next = active(t).find(window => window.startTick === t) ?? null
  return { running, next }
}

// ── Wandernde Termine (Thomas, 29.10.2026) ──────────────────────────────
// Probe-Gottesdienste zweimal täglich (zuerst 11 und 17 Uhr deutscher Zeit). Kommt
// zu einem Termin niemand, rückt er beim nächsten Mal eine Stunde weiter, bis er
// eine Zeit findet, zu der Menschen kommen. Gut besuchte Zeiten bleiben. Nie nach
// 22 Uhr (`latestEnd`), nie vor 7 Uhr (`earliest`).

/** Ein täglicher Termin in Uhrzeit (deutsche Zeit, siehe lib/game/gameClock.ts). */
export interface ActivitySlot { id: string; kind: ActivityKind; label: string; hour: number; duration: number; earliest: number; latestEnd: number }

const mod = (value: number, base: number) => ((value % base) + base) % base

/** Laufender Termin eines Slots zu einem Uhr-Tick (clockTick), sonst null. Start/Ende in Uhr-Ticks. */
export function slotWindowAt(slot: ActivitySlot, clock: number): ActivityWindow | null {
  const start = lastSlotStart(slot, clock)
  return clock >= start && clock < start + slot.duration ? { kind: slot.kind, label: slot.label, startTick: start, endTick: start + slot.duration } : null
}

/** Letzter Beginn des Slots zu oder vor einem Uhr-Tick. */
export function lastSlotStart(slot: { hour: number }, clock: number) {
  return clock - mod(clock - slot.hour, 24)
}

/**
 * Nächste Stunde für einen leer gebliebenen Termin: eine Stunde später, innerhalb
 * von `earliest` … `latestEnd`, mit mindestens einer freien Stunde Abstand zu den
 * anderen Terminen derselben Person (`otherHours`).
 */
export function nextSlotHour(slot: Pick<ActivitySlot, 'hour' | 'duration' | 'earliest' | 'latestEnd'>, otherHours: readonly number[]): number {
  const fits = (h: number) => h >= slot.earliest && h + slot.duration <= slot.latestEnd
    && otherHours.every(o => Math.abs(o - h) >= slot.duration + 1)
  let h = slot.hour
  for (let step = 0; step < 24; step++) {
    h = h + 1 + slot.duration > slot.latestEnd + 1 ? slot.earliest : h + 1
    if (fits(h)) return h
  }
  return slot.hour
}

/**
 * Sondertermine (z. B. ein Probe-Gottesdienst) stehen als population_events
 * `place_activity_scheduled` mit Personenschlüssel, Art, Titel, Beginn und Ende.
 */
export type ScheduledRow = { payload: { personKey?: unknown; kind?: unknown; label?: unknown; startsTick?: unknown; endsTick?: unknown; cancelled?: unknown } | null }
const KINDS: readonly ActivityKind[] = ['open_community', 'service', 'resonance_round', 'friday_prayer', 'shabbat', 'aarti', 'dharma_service']
export function scheduledWindowsFor(rows: readonly ScheduledRow[], personKey: string): ActivityWindow[] {
  return rows.flatMap(row => {
    const p = row.payload ?? {}
    const kind = String(p.kind ?? '') as ActivityKind
    const start = Number(p.startsTick), end = Number(p.endsTick)
    if (p.cancelled === true || p.personKey !== personKey || !KINDS.includes(kind) || !Number.isFinite(start) || !(end > start)) return []
    return [{ kind, label: String(p.label ?? 'Sondertermin').slice(0, 80), startTick: start, endTick: end }]
  })
}

// ── Ablauf ────────────────────────────────────────────────────────────

/** Ein Abschnitt eines Termins in Minuten ab Beginn. `speak`: Predigt oder Ansprache. */
export interface LiturgyPhase { from: number; to: number; title: string; text: string; speak?: boolean }

const CATHOLIC: LiturgyPhase[] = [
  { from: 0, to: 8, title: 'Einzug und Eröffnung', text: 'Orgel, Einzug, Kreuzzeichen und Begrüßung.' },
  { from: 8, to: 14, title: 'Kyrie und Gloria', text: 'Gemeinsamer Ruf um Erbarmen und das Gloria.' },
  { from: 14, to: 24, title: 'Lesungen und Evangelium', text: 'Lesung, Antwortpsalm und das Evangelium; zum Evangelium steht man.' },
  { from: 24, to: 34, title: 'Predigt', text: 'Der Pfarrer legt die Lesungen aus.', speak: true },
  { from: 34, to: 38, title: 'Glaubensbekenntnis und Fürbitten', text: 'Credo und Bitten für die Welt, den Ort und die Menschen.' },
  { from: 38, to: 55, title: 'Eucharistiefeier', text: 'Gabenbereitung, Hochgebet, Vaterunser, Friedensgruß und Kommunion. Wer nicht zur Kommunion geht, bleibt einfach sitzen.' },
  { from: 55, to: 60, title: 'Segen und Entlassung', text: 'Schlussgebet, Segen, Auszug.' },
  { from: 60, to: 120, title: 'Begegnung danach', text: 'Man steht noch zusammen und redet.' },
]
const PROTESTANT: LiturgyPhase[] = [
  { from: 0, to: 8, title: 'Eingangslied und Begrüßung', text: 'Glocken, Orgel, Lied und Votum.' },
  { from: 8, to: 14, title: 'Psalm und Gebet', text: 'Psalm im Wechsel und Eingangsgebet.' },
  { from: 14, to: 22, title: 'Lesung', text: 'Lesung aus der Bibel, danach ein Lied.' },
  { from: 22, to: 37, title: 'Predigt', text: 'Die Pfarrerin legt einen Bibeltext aus.', speak: true },
  { from: 37, to: 47, title: 'Lied und Fürbitten', text: 'Predigtlied, Abkündigungen und Fürbitten.' },
  { from: 47, to: 55, title: 'Vaterunser', text: 'Gemeinsames Vaterunser; an manchen Sonntagen Abendmahl.' },
  { from: 55, to: 60, title: 'Segen', text: 'Schlusslied und Segen.' },
  { from: 60, to: 120, title: 'Kirchcafé', text: 'Kaffee und Gespräch im Anschluss.' },
]
const OPEN: LiturgyPhase[] = [
  { from: 0, to: 120, title: 'Offene Gesprächszeit', text: 'Die Tür steht offen: zum Reden, Zuhören oder einfach Dasitzen.' },
]
const FRIDAY_PRAYER: LiturgyPhase[] = [
  { from: 0, to: 12, title: 'Ankommen', text: 'Rituelle Waschung, Schuhe ablegen, Platz in den Reihen suchen.' },
  { from: 12, to: 16, title: 'Gebetsruf', text: 'Der Ezan ruft zum Gebet.' },
  { from: 16, to: 36, title: 'Freitagspredigt (Hutbe)', text: 'Der Imam spricht von der Kanzel (Minbar).', speak: true },
  { from: 36, to: 46, title: 'Gemeinschaftsgebet', text: 'Zwei Gebetseinheiten in Reihen, Schulter an Schulter. Gäste sitzen hinten und schauen zu.' },
  { from: 46, to: 120, title: 'Begegnung', text: 'Tee und Gespräch im Vorraum.' },
]
const SHABBAT_EVENING: LiturgyPhase[] = [
  { from: 0, to: 30, title: 'Kabbalat Schabbat', text: 'Psalmen und das Lied „Lecha Dodi“ begrüßen den Schabbat.' },
  { from: 30, to: 50, title: 'Abendgebet (Maariv)', text: 'Schma Israel und Amida, das stille Gebet.' },
  { from: 50, to: 60, title: 'Kurze Ansprache', text: 'Ein paar Gedanken des Rabbiners zum Wochenabschnitt.', speak: true },
  { from: 60, to: 120, title: 'Kiddusch', text: 'Segen über Wein und Brot, Schabbat schalom.' },
]
const SHABBAT_MORNING: LiturgyPhase[] = [
  { from: 0, to: 30, title: 'Morgengebet (Schacharit)', text: 'Psalmen, Schma und Amida.' },
  { from: 30, to: 60, title: 'Toralesung', text: 'Die Torarolle wird aus dem Schrein gehoben und am Lesepult (Bima) gelesen.' },
  { from: 60, to: 75, title: 'Predigt (Drascha)', text: 'Der Rabbiner legt den Wochenabschnitt aus.', speak: true },
  { from: 75, to: 100, title: 'Mussaf', text: 'Das zusätzliche Gebet des Schabbat.' },
  { from: 100, to: 120, title: 'Kiddusch', text: 'Segen und gemeinsames Essen.' },
]
const AARTI: LiturgyPhase[] = [
  { from: 0, to: 10, title: 'Vorbereitung', text: 'Glocken, Blumen und Lampen werden vorbereitet.' },
  { from: 10, to: 40, title: 'Aarti', text: 'Der Pujari schwenkt die Lichter vor der Gottheit, alle singen mit.' },
  { from: 40, to: 50, title: 'Ein Wort des Pujari', text: 'Ein paar Sätze zum Tag und zur Geschichte Krishnas.', speak: true },
  { from: 50, to: 60, title: 'Prasad', text: 'Gesegnete Speise wird verteilt.' },
]
const DHARMA: LiturgyPhase[] = [
  { from: 0, to: 10, title: 'Ankommen', text: 'Verneigung, Räucherstäbchen, Platz auf dem Kissen.' },
  { from: 10, to: 30, title: 'Rezitation', text: 'Gemeinsames Rezitieren eines Sutras.' },
  { from: 30, to: 50, title: 'Meditation', text: 'Stilles Sitzen, Gong zu Beginn und Ende.' },
  { from: 50, to: 75, title: 'Dharma-Vortrag', text: 'Die Ordensfrau spricht über eine Lehre des Buddha.', speak: true },
  { from: 75, to: 85, title: 'Widmung', text: 'Das Gute wird allen Wesen gewidmet.' },
  { from: 85, to: 120, title: 'Tee und Gespräch', text: 'Vegetarischer Tee und Gespräch.' },
]
const RESONANCE: LiturgyPhase[] = [
  { from: 0, to: 10, title: 'Ankommen', text: 'Tee, Platz im Kreis, niemand muss etwas sagen.' },
  { from: 10, to: 20, title: 'Stille', text: 'Ein paar Minuten gemeinsam still werden.' },
  { from: 20, to: 30, title: 'Impuls', text: 'Ein kurzer Gedanke zum Einstieg – eine Frage, kein Lehrsatz.', speak: true },
  { from: 30, to: 95, title: 'Runde', text: 'Wer mag, spricht; die anderen hören zu, ohne zu bewerten.' },
  { from: 95, to: 120, title: 'Ausklang', text: 'Was nehme ich mit? Danach Gespräch.' },
]

/** Ablauf eines Termins nach Art, Tradition und Titel. */
export function liturgyFor(kind: ActivityKind, tradition: Tradition | null, label = ''): LiturgyPhase[] {
  switch (kind) {
    case 'service': return tradition === 'catholic' ? CATHOLIC : PROTESTANT
    case 'friday_prayer': return FRIDAY_PRAYER
    case 'shabbat': return /beginn|abend/i.test(label) ? SHABBAT_EVENING : SHABBAT_MORNING
    case 'aarti': return AARTI
    case 'dharma_service': return DHARMA
    case 'resonance_round': return RESONANCE
    default: return OPEN
  }
}

/** Abschnitt zu einer Minute ab Beginn (danach der letzte Abschnitt). */
export function phaseAt(phases: readonly LiturgyPhase[], minute: number): LiturgyPhase | null {
  if (!phases.length || minute < 0) return null
  return phases.find(phase => minute >= phase.from && minute < phase.to) ?? phases[phases.length - 1]
}

/** Wie die Ansprache heißt (für Knopf und Anweisung). */
export function speechNoun(kind: ActivityKind) {
  if (kind === 'resonance_round') return 'Impuls'
  if (kind === 'dharma_service') return 'Dharma-Vortrag'
  if (kind === 'aarti') return 'Wort des Pujari'
  if (kind === 'friday_prayer') return 'Hutbe'
  return 'Predigt'
}

/** Für die Karte: wie man den Anlass nennt. */
export const ACTIVITY_GROUP_LABEL: Record<ActivityKind, string> = {
  service: 'Gottesdienst', open_community: 'Offene Gesprächszeit', friday_prayer: 'Freitagsgebet', shabbat: 'Schabbat',
  aarti: 'Aarti', dharma_service: 'Andacht', resonance_round: 'Resonanzrunde',
}
