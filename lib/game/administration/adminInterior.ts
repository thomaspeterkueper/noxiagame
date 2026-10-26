// lib/game/administration/adminInterior.ts
// Grundriss und Wissen der Verwaltung für den allgemeinen Innenraum
// (NOXIA-INTERIOR-0001): Foyer mit Schalter, Wartebank, Anschlagtafel,
// Besprechungstisch; die Büros dahinter. Reine Regeln.

import { CIVIC_STANDARD_INTERIOR } from '../buildings/interiors/templates/civicStandard'
import { VENUE_HEIGHT, VENUE_WIDTH, staffSpot, standingSpot, tableWithChairs, type VenueLayout, type VenueSpot } from '../hospitality/venues'

const meeting = tableWithChairs(1, 420, 300)
const bench = (id: string, x: number, y: number, n: number) => ({
  furniture: { id, kind: 'chair' as const, x, y, w: 26 * n, h: 18 },
  spots: Array.from({ length: n }, (_, i): VenueSpot => ({ id: `${id}-${i + 1}`, kind: 'seat', x: x + 13 + i * 26, y: y + 9, roomId: 'service', label: 'auf der Wartebank', posture: 'sitting' })),
})
const waiting = bench('bench', 160, 300, 4)

export const ADMIN_LAYOUT: VenueLayout = {
  kind: 'administration',
  template: CIVIC_STANDARD_INTERIOR,
  noun: 'Verwaltung',
  locative: 'in der Verwaltung',
  width: VENUE_WIDTH,
  height: VENUE_HEIGHT,
  start: { x: 90, y: 390 },
  exit: { x: 90, y: 410 },
  playerRoomId: 'service',
  servicePoint: { x: 560, y: 176, label: 'AM SCHALTER', locative: 'am Schalter' },
  windows: [{ x: 120, w: 100 }, { x: 280, w: 100 }],
  furniture: [
    { id: 'board', kind: 'board', x: 150, y: 46, w: 200, h: 22 },
    { id: 'counter', kind: 'counter', x: 470, y: 104, w: 180, h: 40 },
    { id: 'shelf', kind: 'shelf', x: 700, y: 110, w: 16, h: 200 },
    waiting.furniture,
    ...meeting.furniture.map(item => ({ ...item, id: item.id.replace(/-1(-|$)/, '-meeting$1') })),
  ],
  spots: [
    staffSpot('staff-counter', 560, 92, 'service', 'am Schalter'),
    staffSpot('staff-counter-2', 610, 92, 'service', 'am Schalter'),
    staffSpot('staff-office', 650, 300, 'operations', 'im Büro'),
    { ...standingSpot('entry-1', 150, 395, 'beim Eingang'), roomId: 'service' },
    ...waiting.spots,
    ...meeting.spots.map(spot => ({ ...spot, id: spot.id.replace('table-1', 'meeting'), roomId: 'meeting', label: 'am Besprechungstisch' })),
  ],
  roomFact: 'Das Foyer hat einen Schalter, eine Wartebank, eine Anschlagtafel und einen Besprechungstisch; der Ausgang liegt beim Eingang',
  guestBackFact: 'Hinter dem Schalter liegen die Büros; was dort geschieht, siehst du nicht',
  staffBackFact: 'Hinter dem Schalter liegen die Büros mit den Akten des Ortes; Besucher haben dort keinen Zutritt',
}

export interface AdminPublicFacts {
  locationName: string
  population: number
  populationMax: number
  governorName: string | null
  taxProperty: number
  taxTransaction: number
  taxLanding: number
  /** Heimatort des Spielers, falls bekannt. */
  playerHome?: string | null
  /** Ist der Spieler hier als Heimatort gemeldet? */
  playerRegisteredHere?: boolean
}

/** Was die Verwaltung öffentlich weiß – aus den echten Ortsdaten, nichts Geheimes. */
export function adminKnowledge(input: AdminPublicFacts | null): string[] {
  if (!input) return ['Die Zahlen des Ortes liegen dir gerade nicht vor; verweise auf den Schalter']
  const pct = (v: number) => `${Math.round(v * 1000) / 10} %`
  return [
    `Der Ort ${input.locationName} hat ${input.population} Einwohner bei Platz für ${input.populationMax}`,
    input.governorName ? `Gouverneur des Ortes ist ${input.governorName}` : 'Der Ort hat zurzeit keinen Gouverneur',
    `Steuern: Grundsteuer ${input.taxProperty} Cr je Gebäude und Tick, Konsumsteuer ${pct(input.taxTransaction)}, Landegebühr ${input.taxLanding} Cr`,
    input.playerRegisteredHere ? 'Dein Gegenüber ist hier als Einwohner gemeldet' : input.playerHome ? `Dein Gegenüber ist in ${input.playerHome} gemeldet; ummelden kann es sich hier am Schalter` : 'Ob dein Gegenüber hier gemeldet ist, siehst du erst, wenn es den Namen nennt',
    'Am Schalter: Heimatort anmelden oder ummelden; wer Gouverneur ist, stellt hier Steuern ein und sieht die Kasse. Mehr Anträge gibt es noch nicht',
    'Über Kontostände einzelner Personen, Käufe oder Gespräche anderswo weißt du nichts',
  ]
}

export const ADMIN_INTRODUCTION = {
  style: 'administration',
  stance: 'Du bist korrekt, geduldig und genau; du sagst, was geht und was nicht, und nennst die Zahl, wenn du sie hast. Neuen erklärst du zuerst das Formale: anmelden, dann Arbeit oder eigenes Gebäude.',
  leads: [
    'Wer bleiben will, meldet hier seinen Heimatort an; das geht nur vor Ort',
    'Wer bauen will, braucht ein Grundstück oder ein Haus; Lokale entstehen durch Kauf und Umbau bestehender Häuser',
    'Wer lernen will, geht in die Akademie; wer Arbeit sucht, fragt in den Betrieben am Ort',
  ],
}
