// lib/worldlab/worshipTypes.ts
// Antwort von /api/world-lab/worship – gemeinsam für Karte, Tafel und Innenraum.

import type { ActivityKind, Tradition } from '@/lib/game/population/worship'

export interface WorshipItem {
  id: string
  location: string | null
  name: string
  source: string | null
  at: { lat: number; lon: number } | null
  tradition: Tradition
  host: { id: string; name: string; role: string }
  running: { kind: ActivityKind; label: string; group: string; startedAt: string; endsAt: string; attendees: number } | null
  next: { kind: ActivityKind; label: string; group: string; when: string; startsAt: string } | null
  /** Wandernde Termine (deutsche Zeit): Stunde, Titel, Besucher beim letzten Mal. */
  slots?: Array<{ hour: number; label: string; lastAttendance: number | null }>
}

const metres = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
  Math.hypot((a.lat - b.lat) * 111320, (a.lon - b.lon) * 111320 * Math.cos(a.lat * Math.PI / 180))

/** Termin eines Ortes: gleiche OSM-Kennung oder höchstens 45 m entfernt. */
export function worshipAt(items: readonly WorshipItem[], place: { source?: string | null; at: { lat: number; lon: number } }) {
  return items.find(item => (place.source && item.source === place.source) || (item.at && metres(item.at, place.at) <= 45)) ?? null
}

/** Kurztext für Listen: „jetzt: Gottesdienst“ oder „Gottesdienst So 10 Uhr“. */
export function worshipWhen(item: WorshipItem) {
  if (item.running) return `jetzt: ${item.running.label}`
  return item.next ? `${item.next.group} ${item.next.when}` : ''
}
