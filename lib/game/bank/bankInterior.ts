// lib/game/bank/bankInterior.ts
// Grundriss und Wissen der Bank für den allgemeinen Innenraum
// (NOXIA-INTERIOR-0001): Schalterhalle mit zwei Schaltern, Kurstafel,
// Wartesesseln und Beratungstisch; Tresor und Büros dahinter. Reine Regeln.
// Beratung (Thomas, 27.10.2026): am Beratungstisch sitzt die Kundenberatung;
// die Beratungsmappe rechnet aus den echten Kontodaten (bankAdvice).

import { CIVIC_STANDARD_INTERIOR } from '../buildings/interiors/templates/civicStandard'
import { VENUE_HEIGHT, VENUE_WIDTH, staffSpot, standingSpot, tableWithChairs, type VenueLayout, type VenueSpot } from '../hospitality/venues'

const advice = tableWithChairs(1, 420, 300)
/** Der Kundenstuhl am Beratungstisch. */
export const ADVICE_SEAT_ID = 'advice-l'
export const ADVICE_STAFF_SPOT_ID = 'staff-advice'
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
    // Die Beratung sitzt dem Kunden gegenüber – der rechte Stuhl des Beratungstischs.
    ...advice.spots.filter(spot => spot.id.endsWith('-r')).map(spot => ({ ...staffSpot('staff-advice', spot.x, spot.y, 'meeting', 'am Beratungstisch'), posture: 'sitting' as const })),
    staffSpot('staff-counter-2', 600, 92, 'service', 'am Schalter'),
    staffSpot('staff-office', 650, 300, 'operations', 'im Büro'),
    { ...standingSpot('entry-1', 150, 395, 'beim Eingang'), roomId: 'service' },
    ...chairs(160, 300, 3),
    ...advice.spots.filter(spot => spot.id.endsWith('-l')).map(spot => ({ ...spot, id: ADVICE_SEAT_ID, roomId: 'service', label: 'am Beratungstisch' })),
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

// ── Beratung ─────────────────────────────────────────────────────────────────

/** Am Beratungstisch: auf dem Kundenstuhl oder direkt daneben. */
export function isAtAdviceTable(seatId: string | null, pos: { x: number; y: number }): boolean {
  if (seatId === ADVICE_SEAT_ID) return true
  const table = BANK_LAYOUT.furniture.find(item => item.kind === 'table')
  if (!table) return false
  return Math.hypot(pos.x - (table.x + table.w / 2), pos.y - (table.y + table.h / 2)) < 64
}

/** Stand des Kunden, wie ihn /api/game/bank?action=status liefert. */
export interface BankCustomerStatus {
  credits: number
  deposit: number
  loan: number
  creditLimit: number
  availableLoan: number
  depositRate: number
  loanRate: number
  hasModule: boolean
  collateralTotal: number
  overLimit: number
}

export function customerStatusFrom(data: Record<string, unknown> | null | undefined): BankCustomerStatus | null {
  if (!data) return null
  const n = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0
  const warning = data.collateralWarning as { overLimit?: unknown } | null | undefined
  return {
    credits: n(data.credits), deposit: n(data.deposit), loan: n(data.loan),
    creditLimit: n(data.creditLimit), availableLoan: n(data.availableLoan),
    depositRate: n(data.depositRate), loanRate: n(data.loanRate),
    hasModule: Boolean(data.hasModule), collateralTotal: n(data.collateralTotal),
    overLimit: n(warning?.overLimit),
  }
}

const cr = (v: number) => `${Math.round(v).toLocaleString('de-DE')} Cr`
const perTick = (v: number) => `${(Math.round(v * 10) / 10).toLocaleString('de-DE')} Cr je Tick`

/**
 * Die Beratungsmappe: was aus dem eigenen Konto folgt – nur gerechnet, nichts
 * empfohlen, was die Zahlen nicht tragen. Unpersönlich formuliert, damit die
 * Tafel (für den Spieler) und die Beratung (als Wissen) dieselben Sätze nutzen.
 */
export function bankAdvice(s: BankCustomerStatus): string[] {
  const lines = [`Konto: Bargeld ${cr(s.credits)}, Guthaben hier ${cr(s.deposit)}, Kredit ${cr(s.loan)}`]
  if (s.deposit > 0) lines.push(`Das Guthaben bringt etwa ${perTick(s.deposit * s.depositRate)}`)
  else if (s.credits > 0 && s.depositRate > 0) lines.push(`Bargeld bringt keine Zinsen; angelegt brächte es etwa ${perTick(s.credits * s.depositRate)}`)
  if (s.loan > 0) lines.push(`Der Kredit kostet etwa ${perTick(s.loan * s.loanRate)} Zinsen`)
  if (s.loan > 0 && s.deposit > 0 && s.loanRate > s.depositRate) {
    lines.push(`Tilgen aus dem Guthaben spart etwa ${perTick((s.loanRate - s.depositRate) * Math.min(s.deposit, s.loan))}, weil der Kreditzins höher ist`)
  }
  if (s.collateralTotal <= 0) lines.push('Keine Sicherheiten: als Sicherheit zählen hier Gebäude mit Förderertrag, vermietete Häuser, Lokale mit Umsatz und Schiffe – Kreditrahmen 0')
  else lines.push(`Sicherheiten ${cr(s.collateralTotal)} → Kreditrahmen ${cr(s.creditLimit)}, davon frei ${cr(s.availableLoan)}`)
  if (s.overLimit > 0) lines.push(`Der Kredit liegt ${cr(s.overLimit)} über dem Rahmen: tilgen oder Sicherheiten erhöhen`)
  if (!s.hasModule) lines.push('Für einen Kredit fehlt der Nachweis „Was ist Kredit?“; das Modul gibt es hier in der Bank')
  return lines
}

/** Was die Beratung über ihr Gegenüber weiß – nur am Beratungstisch. */
export function bankAdvisorFacts(s: BankCustomerStatus | null): string[] {
  if (!s) return ['Du berätst gerade; die Kontodaten deines Gegenübers liegen dir noch nicht vor – sag das ehrlich']
  return [
    'Du sitzt deinem Gegenüber am Beratungstisch gegenüber und hast seine Beratungsmappe vor dir',
    ...bankAdvice(s).map(line => 'Mappe: ' + line),
    'Du rechnest mit den Zahlen der Mappe vor, versprichst keine Gewinne und drängst zu keinem Kredit',
  ]
}

export const BANK_ADVISOR_INTRODUCTION = {
  style: 'bank-advice',
  stance: 'Du bist die Kundenberatung: ruhig, ehrlich, konkret. Du erklärst anhand der Mappe, was Guthaben bringt und ein Kredit kostet, und nennst, welches Wissen noch fehlt. Ohne Nachweis gibt es keinen Kredit.',
  leads: [
    'Erst schauen, was das Konto hergibt – dann entscheiden',
    'Ein Kredit lohnt nur, wenn das Geld mehr einbringt, als die Zinsen kosten',
  ],
}
