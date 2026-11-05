// lib/game/hospitality/venueEvents.ts
// Veranstaltungen im Lokal (Second-Life-Mechanik, Teil 5; Thomas, 04.11.2026: „alles
// nacheinander“). Der Eigentümer kündigt DJ-Abend, Konzert, Lesung, Quiz, Feier oder
// Stammtisch an – in echter Uhrzeit, damit sich Spieler verabreden können. Im Lokal
// hängt der Aushang, „Was ist los?“ zeigt, was anderswo läuft, und die Figuren wissen
// nur, was am Aushang steht oder was gerade stattfindet. Reine Regeln.

export type VenueEventKind = 'dj' | 'konzert' | 'lesung' | 'quiz' | 'feier' | 'stammtisch'
export const VENUE_EVENT_KINDS: Readonly<Record<VenueEventKind, { label: string; icon: string }>> = {
  dj: { label: 'DJ-Abend', icon: '🎧' },
  konzert: { label: 'Konzert', icon: '🎸' },
  lesung: { label: 'Lesung', icon: '📖' },
  quiz: { label: 'Quizabend', icon: '❓' },
  feier: { label: 'Feier', icon: '🎉' },
  stammtisch: { label: 'Stammtisch', icon: '🍺' },
}

export interface VenueEvent { id: string; tileEntityId: string; kind: VenueEventKind; title: string; note: string | null; startsAt: string; endsAt: string; venueName?: string | null }

export const EVENT_MIN_MS = 30 * 60_000
export const EVENT_MAX_MS = 8 * 60 * 60_000
export const EVENT_AHEAD_MS = 60 * 24 * 60 * 60_000

export type EventInput = { kind?: unknown; title?: unknown; note?: unknown; startsAt?: unknown; minutes?: unknown }

/** Prüft eine Ankündigung; liefert die bereinigten Werte oder einen Satz, was nicht passt. */
export function validateEvent(input: EventInput, nowMs: number): { ok: true; kind: VenueEventKind; title: string; note: string | null; startsAt: string; endsAt: string } | { ok: false; error: string } {
  const kind = String(input.kind ?? '') as VenueEventKind
  if (!(kind in VENUE_EVENT_KINDS)) return { ok: false, error: 'Welche Art von Veranstaltung?' }
  const title = String(input.title ?? '').replace(/\s+/g, ' ').trim().slice(0, 60) || VENUE_EVENT_KINDS[kind].label
  if (title.length < 3) return { ok: false, error: 'Der Titel ist zu kurz.' }
  const note = String(input.note ?? '').replace(/\s+/g, ' ').trim().slice(0, 160) || null
  const start = Date.parse(String(input.startsAt ?? ''))
  if (!Number.isFinite(start)) return { ok: false, error: 'Wann soll es losgehen?' }
  if (start < nowMs - 10 * 60_000) return { ok: false, error: 'Der Beginn liegt in der Vergangenheit.' }
  if (start > nowMs + EVENT_AHEAD_MS) return { ok: false, error: 'Höchstens zwei Monate im Voraus.' }
  const ms = Math.round(Number(input.minutes) || 0) * 60_000
  if (ms < EVENT_MIN_MS || ms > EVENT_MAX_MS) return { ok: false, error: 'Dauer zwischen einer halben Stunde und acht Stunden.' }
  return { ok: true, kind, title, note, startsAt: new Date(start).toISOString(), endsAt: new Date(start + ms).toISOString() }
}

export const eventRunning = (e: VenueEvent, nowMs: number) => Date.parse(e.startsAt) <= nowMs && nowMs < Date.parse(e.endsAt)

/** Laufende zuerst, dann nach Beginn; vorbei ist vorbei. */
export function upcoming(events: readonly VenueEvent[], nowMs: number, limit = 6): VenueEvent[] {
  return events.filter(e => Date.parse(e.endsAt) > nowMs)
    .sort((a, b) => Number(eventRunning(b, nowMs)) - Number(eventRunning(a, nowMs)) || Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .slice(0, limit)
}

const TZ = 'Europe/Berlin'
/** „heute 21:00“, „morgen 20:30“, „Sa., 8.11. 19:00“ – in deutscher Zeit. */
export function whenText(iso: string, nowMs: number): string {
  const d = new Date(iso)
  const day = (t: Date) => new Intl.DateTimeFormat('de-DE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(t)
  const time = new Intl.DateTimeFormat('de-DE', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(d)
  if (day(d) === day(new Date(nowMs))) return 'heute ' + time
  if (day(d) === day(new Date(nowMs + 86_400_000))) return 'morgen ' + time
  return new Intl.DateTimeFormat('de-DE', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'numeric' }).format(d) + ' ' + time
}

export function eventTitle(e: VenueEvent): string {
  const k = VENUE_EVENT_KINDS[e.kind]
  return e.title === k.label ? k.label : `${k.label}: ${e.title}`
}

export function eventLine(e: VenueEvent, nowMs: number): string {
  const title = eventTitle(e)
  return eventRunning(e, nowMs) ? `${title} – läuft gerade (bis ${whenText(e.endsAt, nowMs).replace(/^heute /, '')})` : `${title} – ${whenText(e.startsAt, nowMs)}`
}

/**
 * Was eine Figur weiß: Personal kennt das Programm, Gäste sehen, was gerade läuft,
 * und haben den Aushang gelesen (nur die nächste Ankündigung).
 */
export function eventFacts(events: readonly VenueEvent[], staff: boolean, nowMs: number): string[] {
  const list = upcoming(events, nowMs, 3)
  if (!list.length) return []
  const running = list.find(e => eventRunning(e, nowMs))
  const facts: string[] = []
  if (running) facts.push(`Gerade läuft hier: ${eventTitle(running)}, bis ${whenText(running.endsAt, nowMs).replace(/^heute /, '')}${running.note ? ' – ' + running.note : ''}`)
  const next = list.filter(e => !eventRunning(e, nowMs))
  if (staff && next.length) facts.push(`Am Aushang angekündigt: ${next.map(e => eventLine(e, nowMs)).join('; ')}`)
  else if (next[0]) facts.push(`Am Aushang hängt: ${eventLine(next[0], nowMs)}`)
  return facts.map(f => f.length > 180 ? f.slice(0, 179) + '…' : f)
}
