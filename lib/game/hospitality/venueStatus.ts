// lib/game/hospitality/venueStatus.ts
// Eine Zeile für die Gebäudetafel der Weltkarte (Aufgabe 11): Ist das Lokal
// jetzt offen? Nach denselben Regeln wie drinnen (venueService): Öffnungszeit
// nach Koloniezeit bzw. beim Startcafé nach Ortszeit des Spielers, ohne
// Personal zu – nur das Café läuft dann als Automatencafé. Reine Regeln.

import { clockLabel, venueHoursText, venueOpenAt, type VenueHours, type VenueKind } from './venues'

export const VENUE_TYPE_IDS: ReadonlySet<string> = new Set(['cafe', 'bar', 'restaurant', 'hotel'])

export interface VenueStatusInput {
  kind: VenueKind
  hours: VenueHours
  /** Stunde auf der Uhr, die für das Lokal gilt; null = unbekannt. */
  hour: number | null
  /** Wie viele hier arbeiten; null = unbekannt. */
  staffCount: number | null
}

export interface VenueStatus { open: boolean | null; text: string }

export function venueStatusLine(input: VenueStatusInput): VenueStatus {
  const { kind, hours, hour, staffCount } = input
  const when = venueHoursText(kind, hours)
  if (staffCount === 0) {
    return kind === 'cafe'
      ? { open: true, text: 'Kein Personal da – Automatencafé, bedienen selbst' }
      : { open: false, text: 'Geschlossen – hier arbeitet gerade niemand' }
  }
  if (hour == null) return { open: null, text: `Geöffnet ${when} (${clockLabel(hours)})` }
  const h = ((Math.trunc(hour) % 24) + 24) % 24
  return venueOpenAt(kind, h, hours)
    ? { open: true, text: `Geöffnet – jetzt ${h} Uhr ${clockLabel(hours)}, ${when}` }
    : { open: false, text: `Geschlossen – jetzt ${h} Uhr ${clockLabel(hours)}, geöffnet ${when}` }
}
