// lib/game/bank/bankInterior.ts
// Grundriss und Wissen der Bank für den allgemeinen Innenraum
// (NOXIA-INTERIOR-0001): Schalterhalle mit zwei Schaltern, Kurstafel,
// Wartesesseln und Beratungstisch; Tresor und Büros dahinter. Reine Regeln.

import { CIVIC_STANDARD_INTERIOR } from '../buildings/interiors/templates/civicStandard'
import { VENUE_HEIGHT, VENUE_WIDTH, staffSpot, standingSpot, tableWithChairs, type VenueLayout, type VenueSpot } from '../hospitality/venues'

const advice = tableWithChairs(1, 420, 300)
const chairs = (x: number, y: number, n: number): VenueSpot[] => Array.from({ length: n }, (_, i) => ({ id: `wait-${i + 1}`, kind: 'seat', x: x + 9 + i * 34, y: y + 9, roomId: 'service', label: 'in der Wartezone', posture: 'sitting' }))

export const BANK_LAYOUT: VenueLayout = {
  kind: 'bank',
  template: CIVIC_STANDARD_INTERIOR,
  noun: 'Bank',
  locative: 'in der Bank',
  width: VENUE_WIDTH,
  height: VENUE_HEIGHT,
  start: { x: 90, y: 390 },
  exit: { x: 90, y: 410 },
  playerRoomId: 'service',
  servicePoint: { x: 560, y: 176, label: 'AM SCHALTER', locative: 'am Schalter' },
  windows: [{ x: 120, w: 100 }, { x: 280, w: 100 }],
  furniture: [
    { id: 'board', kind: 'board', x: 150, y: 46, w: 220, h: 22 },
    { id: 'counter', kind: 'counter', x: 470, y: 104, w: 180, h: 40 },
    { id: 'wall-vault', kind: 'wall', x: 690, y: 90, w: 10, h: 346 },
    ...[0, 1, 2].map(i => ({ id: `wait-chair-${i + 1}`, kind: 'chair' as const, x: 160 + i * 34, y: 300, w: 18, h: 18 })),
    ...advice.furniture.map(item => ({ ...item, id: item.id.replace(/-1(-|$)/, '-advice$1') })),
  ],
  spots: [
    staffSpot('staff-counter', 530, 92, 'service', 'am Schalter'),
    staffSpot('staff-counter-2', 600, 92, 'service', 'am Schalter'),
    staffSpot('staff-office', 650, 300, 'operations', 'im Büro'),
    { ...standingSpot('entry-1', 150, 395, 'beim Eingang'), roomId: 'service' },
    ...chairs(160, 300, 3),
    ...advice.spots.map(spot => ({ ...spot, id: spot.id.replace('table-1', 'advice'), roomId: 'meeting', label: 'am Beratungstisch' })),
  ],
  roomFact: 'Die Schalterhalle hat zwei Schalter, eine Kurstafel, drei Wartesessel und einen Beratungstisch; der Ausgang liegt beim Eingang',
  guestBackFact: 'Hinter dem Schalter ist eine schwere Tür; was dahinter liegt, siehst du nicht',
  staffBackFact: 'Hinter dem Schalter liegen Tresor und Büros; Kunden haben dort keinen Zutritt',
}

export interface BankPublicFacts {
  locationName: string
  /** Zinssätze je Tick, als Anteil (0.01 = 1 %). */
  depositRate: number
  loanRate: number
  /** Stand des Gastes – nur, wenn er am Schalter steht; sonst null. */
  customer?: { deposit: number; loan: number; creditLimit: number; availableLoan: number; hasModule: boolean } | null
}

const pct = (v: number) => `${Math.round(v * 10000) / 100} % je Tick`

/** Was das Personal der Bank weiß: die Konditionen immer, den Stand des Kunden nur am Schalter. */
export function bankKnowledge(input: BankPublicFacts | null): string[] {
  if (!input) return ['Die Konditionen liegen dir gerade nicht vor; verweise auf die Kurstafel']
  const facts = [
    `Die Bank in ${input.locationName} nimmt Einlagen zu ${pct(input.depositRate)} und vergibt Kredite zu ${pct(input.loanRate)}`,
    'Kredite brauchen Sicherheiten – Gebäude und Guthaben; die Grenze steht auf dem Kontoauszug am Schalter',
  ]
  const c = input.customer
  if (c) {
    facts.push(`Dein Gegenüber hat hier ${c.deposit} Credits angelegt und ${c.loan} Credits Kredit; Kreditrahmen ${c.creditLimit}, davon frei ${c.availableLoan}`)
    if (!c.hasModule) facts.push('Für einen Kredit fehlt deinem Gegenüber noch die Kreditfreigabe aus der Akademie')
  } else {
    facts.push('Kontostände nennst du nur am Schalter und nur dem Kontoinhaber; über andere Kunden sprichst du nicht')
  }
  facts.push('Einzahlen, Abheben, Kredit und Tilgung laufen über den Schalter, nicht im Gespräch')
  return facts
}

export const BANK_INTRODUCTION = {
  style: 'bank',
  stance: 'Du bist höflich, diskret und präzise; du wirbst nicht für Kredite. Neuen erklärst du, dass Guthaben Zinsen bringt und ein Kredit Sicherheiten braucht, und rätst, erst zu verdienen, dann zu leihen.',
  leads: [
    'Wer Credits übrig hat, legt sie an; die Zinsen laufen je Tick',
    'Ein Kredit braucht Sicherheiten – ein eigenes Gebäude zählt – und die Kreditfreigabe aus der Akademie',
    'Wer handeln will, braucht Startkapital: erst kleine Geschäfte, dann die Bank',
  ],
}
