// lib/game/spaceport/spaceportInterior.ts
// Grundriss und Wissen des Raumhafens für den allgemeinen Innenraum
// (NOXIA-INTERIOR-0001): Ankunftshalle mit Schalter der Flugleitung,
// Anzeigetafel, Wartebänken und dem Gang zur Hafenkantine; Fracht, Wartung
// und Dock dahinter. Reine Regeln.

import { SPACEPORT_STANDARD_INTERIOR } from '../buildings/interiors/templates/spaceportStandard'
import { VENUE_HEIGHT, VENUE_WIDTH, staffSpot, standingSpot, type VenueLayout, type VenueSpot } from '../hospitality/venues'

const bench = (id: string, x: number, y: number, n: number) => ({
  furniture: { id, kind: 'chair' as const, x, y, w: 26 * n, h: 18 },
  spots: Array.from({ length: n }, (_, i): VenueSpot => ({ id: `${id}-${i + 1}`, kind: 'seat', x: x + 13 + i * 26, y: y + 9, roomId: 'arrival', label: 'auf der Wartebank', posture: 'sitting' })),
})
const benches = [bench('bench-1', 160, 230, 4), bench('bench-2', 160, 300, 4), bench('bench-3', 320, 230, 4), bench('bench-4', 320, 300, 4)]

export const SPACEPORT_LAYOUT: VenueLayout = {
  kind: 'spaceport',
  template: SPACEPORT_STANDARD_INTERIOR,
  noun: 'Raumhafen',
  locative: 'im Raumhafen',
  width: VENUE_WIDTH,
  height: VENUE_HEIGHT,
  start: { x: 90, y: 390 },
  exit: { x: 90, y: 410 },
  playerRoomId: 'arrival',
  servicePoint: { x: 580, y: 176, label: 'AN DER FLUGLEITUNG', locative: 'am Schalter der Flugleitung' },
  windows: [{ x: 120, w: 160 }, { x: 320, w: 160 }],
  furniture: [
    { id: 'board', kind: 'board', x: 470, y: 46, w: 240, h: 22 },
    { id: 'counter', kind: 'counter', x: 490, y: 104, w: 180, h: 40 },
    { id: 'wall-cargo', kind: 'wall', x: 690, y: 200, w: 10, h: 236 },
    { id: 'pass', kind: 'pass', x: 688, y: 160, w: 14, h: 40 },
    ...benches.map(b => b.furniture),
  ],
  spots: [
    staffSpot('staff-control', 580, 92, 'arrival', 'am Schalter der Flugleitung'),
    staffSpot('staff-control-2', 630, 92, 'arrival', 'am Schalter der Flugleitung'),
    staffSpot('staff-cargo', 720, 300, 'cargo', 'im Cargo-Terminal'),
    staffSpot('staff-service', 720, 380, 'service', 'in der Wartung'),
    { ...standingSpot('entry-1', 150, 395, 'beim Eingang'), roomId: 'arrival' },
    ...benches.flatMap(b => b.spots),
  ],
  roomFact: 'Die Ankunftshalle hat eine Anzeigetafel, den Schalter der Flugleitung, vier Wartebänke und einen Durchgang zum Cargo-Terminal; der Ausgang liegt beim Eingang',
  guestBackFact: 'Hinter dem Durchgang liegen Cargo-Terminal, Wartung und das Dock; dort kommst du nur mit Schiff oder Fracht hin',
  staffBackFact: 'Hinter dem Durchgang liegen Cargo-Terminal, Wartung und das Dock mit dem Schiff des Gastes, falls es eines hat',
}

export interface SpaceportFacts {
  locationName: string
  /** Erreichbare Orte mit Namen; leer = Liste liegt nicht vor. */
  destinations: Array<{ name: string; population: number }>
  hasShip: boolean
  shipTypeId: string | null
  shipRangeKm: number | null
  inTransit: boolean
  /** Gibt es im Hafen eine Kantine? */
  canteen: boolean
}

/** Was die Flugleitung weiß – aus den echten Zielorten und dem Schiff des Gastes. */
export function spaceportKnowledge(input: SpaceportFacts | null): string[] {
  if (!input) return ['Die Flugpläne liegen dir gerade nicht vor; verweise auf die Anzeigetafel']
  const names = input.destinations.map(d => d.name)
  return [
    names.length ? `Von ${input.locationName} aus fliegt man nach ${names.slice(0, 6).join(', ')}${names.length > 6 ? ' und weitere' : ''}` : 'Zurzeit sind keine Zielorte gelistet',
    input.hasShip ? `Dein Gegenüber hat ein eigenes Schiff (${input.shipTypeId ?? 'Typ unbekannt'}) im Dock${input.shipRangeKm ? `, Reichweite ${input.shipRangeKm}` : ''}` : 'Dein Gegenüber hat kein eigenes Schiff; ohne Schiff reist man per Linienflug, das Ticket kostet Credits',
    input.inTransit ? 'Dein Gegenüber ist eigentlich gerade unterwegs – das passt nicht, frag nach' : 'Abflug und Ziel wählt man an der Flugleitung; Fracht wird im Cargo-Terminal umgeschlagen',
    input.canteen ? 'Im Hafen gibt es eine Kantine mit Wasser und Ration, rund um die Uhr' : 'Eine Kantine hat dieser Hafen nicht',
    'Preise für Tickets, Fracht oder Reparaturen kennst du nur, wenn sie in deinen Fakten stehen; erfinde keine',
  ]
}

export const SPACEPORT_INTRODUCTION = {
  style: 'spaceport',
  stance: 'Du bist knapp, zügig und freundlich wie eine Flugleitung, die den nächsten Abflug im Blick hat. Neuen machst du klar, wohin es von hier geht und was man dafür braucht, ohne zu werben.',
  leads: [
    'Ohne eigenes Schiff kommt man per Linienflug weiter; das Ticket kostet Credits und bringt einen an einen anderen Ort mit anderen Preisen',
    'Wer Fracht mitnimmt, verdient am Preisunterschied; das Cargo-Terminal zeigt, was hier gehandelt wird',
    'Ein eigenes Schiff ist ein späterer Schritt; die Werft am Ort baut und wartet',
  ],
}
