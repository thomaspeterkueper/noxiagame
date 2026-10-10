// lib/game/hospitality/venues.ts
// Café, Bar und Restaurant als ein Raummodell – reine Regeln, kein Zustand.
//
// Drei Dinge liegen hier:
//   1. Innenaufbau: Möbel, Plätze und begehbare Fläche je Lokaltyp.
//   2. Figuren: Wer im Raum wo steht oder sitzt.
//   3. Gespräche: Was eine Figur von ihrem Platz aus wissen kann.
//
// Regel für Wissen: Eine Figur kennt den Raum, den sie sieht, ihren eigenen
// Platz und die Personen in Sichtweite – ohne deren Namen. Kontostand,
// Wissensstufe oder Vorhaben des Gegenübers kennt sie nicht. Was hinter einer
// geschlossenen Personaltür liegt, weiß nur, wer dort arbeitet.
//
// Die Buchung einer Bestellung liegt im Teilprojekt Bevölkerung und Ökonomie
// (/api/game/hospitality/order). Hier steht nur, wer im Raum was darüber weiß.
// Stimmungswirkung und der Wirt als Bewohner mit Arbeitsvertrag sind nicht
// gebaut. Anschlussstellen: docs/gameplay/hospitality-venues.md.

import type { InteriorTemplate } from '../buildings/interiors/types'
import { CAFE_STANDARD_INTERIOR } from '../buildings/interiors/templates/cafeStandard'
import { BAR_STANDARD_INTERIOR } from '../buildings/interiors/templates/barStandard'
import { RESTAURANT_STANDARD_INTERIOR } from '../buildings/interiors/templates/restaurantStandard'

export type VenueKind = 'cafe' | 'bar' | 'restaurant'

export interface VenuePoint { x: number; y: number }

export type VenueFurnitureKind =
  | 'table' | 'high-table' | 'counter' | 'chair' | 'stool' | 'shelf' | 'desk' | 'wall' | 'pass' | 'kitchen'

export interface VenueFurniture {
  id: string
  kind: VenueFurnitureKind
  x: number
  y: number
  w: number
  h: number
}

export type VenueSpotKind = 'seat' | 'standing' | 'staff'

export interface VenueSpot {
  id: string
  kind: VenueSpotKind
  x: number
  y: number
  /** Raum aus der Innenraum-Vorlage; bestimmt die Sichtweite. */
  roomId: string
  /** Ortsangabe im Satz, z. B. „an Tisch 2“ oder „hinter dem Tresen“. */
  label: string
  posture: 'sitting' | 'standing'
}

export interface VenueLayout {
  kind: VenueKind
  template: InteriorTemplate
  /** „Café“, „Bar“, „Restaurant“ */
  noun: string
  /** „im Café“, „in der Bar“, „im Restaurant“ */
  locative: string
  width: number
  height: number
  start: VenuePoint
  exit: VenuePoint
  /** Raum, in dem sich der Spieler bewegt. */
  playerRoomId: string
  /** Stelle vor Tresen oder Empfang, an der später bestellt wird. */
  servicePoint: VenuePoint & { label: string; locative: string }
  windows: Array<{ x: number; w: number }>
  furniture: VenueFurniture[]
  spots: VenueSpot[]
  /** Was jeder im Gastraum sieht. */
  roomFact: string
  /** Was Gäste über den Personalbereich wissen (nur, dass es ihn gibt). */
  guestBackFact: string
  /** Was das Personal über den Personalbereich weiß. */
  staffBackFact: string
}

export const VENUE_WIDTH = 760
export const VENUE_HEIGHT = 470
export const VENUE_PLAYER_RADIUS = 10
const WALL = { left: 35, right: VENUE_WIDTH - 35, top: 42, bottom: VENUE_HEIGHT - 34 }
const START: VenuePoint = { x: 90, y: 390 }
const EXIT: VenuePoint = { x: 90, y: 410 }

const TABLE_W = 72
const TABLE_H = 48
const CHAIR = 18

/** Ein Tisch mit je einem Stuhl links und rechts. */
function tableWithChairs(n: number, x: number, y: number): { furniture: VenueFurniture[]; spots: VenueSpot[] } {
  const left = { x: x - CHAIR - 4, y: y + (TABLE_H - CHAIR) / 2 }
  const right = { x: x + TABLE_W + 4, y: y + (TABLE_H - CHAIR) / 2 }
  const seat = (side: 'l' | 'r', c: VenuePoint): VenueSpot => ({
    id: `table-${n}-${side}`,
    kind: 'seat',
    x: c.x + CHAIR / 2,
    y: c.y + CHAIR / 2,
    roomId: 'guest-room',
    label: `an Tisch ${n}`,
    posture: 'sitting',
  })
  return {
    furniture: [
      { id: `table-${n}`, kind: 'table', x, y, w: TABLE_W, h: TABLE_H },
      { id: `chair-${n}-l`, kind: 'chair', x: left.x, y: left.y, w: CHAIR, h: CHAIR },
      { id: `chair-${n}-r`, kind: 'chair', x: right.x, y: right.y, w: CHAIR, h: CHAIR },
    ],
    spots: [seat('l', left), seat('r', right)],
  }
}

function tables(positions: Array<[number, number]>) {
  const sets = positions.map(([x, y], index) => tableWithChairs(index + 1, x, y))
  return { furniture: sets.flatMap(s => s.furniture), spots: sets.flatMap(s => s.spots) }
}

function staffSpot(id: string, x: number, y: number, roomId: string, label: string): VenueSpot {
  return { id, kind: 'staff', x, y, roomId, label, posture: 'standing' }
}

function standingSpot(id: string, x: number, y: number, label: string): VenueSpot {
  return { id, kind: 'standing', x, y, roomId: 'guest-room', label, posture: 'standing' }
}

// ── Café ────────────────────────────────────────────────────────────────────
const cafeTables = tables([[190, 150], [350, 150], [190, 290], [350, 290]])

const CAFE_LAYOUT: VenueLayout = {
  kind: 'cafe',
  template: CAFE_STANDARD_INTERIOR,
  noun: 'Café',
  locative: 'im Café',
  width: VENUE_WIDTH,
  height: VENUE_HEIGHT,
  start: START,
  exit: EXIT,
  playerRoomId: 'guest-room',
  servicePoint: { x: 610, y: 176, label: 'AM TRESEN', locative: 'am Tresen' },
  windows: [{ x: 155, w: 100 }, { x: 330, w: 100 }],
  furniture: [
    { id: 'shelf', kind: 'shelf', x: 540, y: 44, w: 150, h: 14 },
    { id: 'counter', kind: 'counter', x: 520, y: 104, w: 180, h: 44 },
    ...cafeTables.furniture,
  ],
  spots: [
    staffSpot('staff-counter', 610, 94, 'counter', 'hinter dem Tresen'),
    standingSpot('entry-1', 150, 395, 'beim Eingang'),
    ...cafeTables.spots,
  ],
  roomFact: 'Der Gastraum hat vier Tische mit je zwei Stühlen, zwei Fenster und einen Tresen; der Ausgang liegt beim Eingang',
  guestBackFact: 'Hinter dem Tresen ist eine Tür nur für Personal; was dahinter liegt, weißt du nicht',
  staffBackFact: 'Hinter dem Tresen liegt ein Nebenraum mit Vorräten; Gäste haben dort keinen Zutritt',
}

// ── Bar ─────────────────────────────────────────────────────────────────────
const barStools = [110, 160, 210, 260, 310].map((y, index) => ({
  furniture: { id: `stool-${index + 1}`, kind: 'stool' as const, x: 530, y, w: CHAIR, h: CHAIR },
  spot: {
    id: `stool-${index + 1}`,
    kind: 'seat' as const,
    x: 530 + CHAIR / 2,
    y: y + CHAIR / 2,
    roomId: 'guest-room',
    label: 'auf einem Hocker am Tresen',
    posture: 'sitting' as const,
  },
}))
const barHighTables: Array<[number, number]> = [[200, 130], [330, 215], [200, 300]]
const barNook = tableWithChairs(1, 380, 350)

const BAR_LAYOUT: VenueLayout = {
  kind: 'bar',
  template: BAR_STANDARD_INTERIOR,
  noun: 'Bar',
  locative: 'in der Bar',
  width: VENUE_WIDTH,
  height: VENUE_HEIGHT,
  start: START,
  exit: EXIT,
  playerRoomId: 'guest-room',
  servicePoint: { x: 505, y: 235, label: 'AM TRESEN', locative: 'am Tresen' },
  windows: [{ x: 155, w: 100 }],
  furniture: [
    { id: 'counter', kind: 'counter', x: 560, y: 90, w: 46, h: 250 },
    { id: 'shelf', kind: 'shelf', x: 700, y: 90, w: 16, h: 250 },
    ...barStools.map(s => s.furniture),
    ...barHighTables.map(([x, y], index) => ({ id: `high-table-${index + 1}`, kind: 'high-table' as const, x, y, w: 40, h: 40 })),
    ...barNook.furniture.map(item => ({ ...item, id: item.id.replace(/-1(-|$)/, '-nook$1') })),
  ],
  spots: [
    staffSpot('staff-counter', 655, 160, 'counter', 'hinter dem Tresen'),
    staffSpot('staff-counter-2', 655, 280, 'counter', 'hinter dem Tresen'),
    standingSpot('entry-1', 150, 395, 'beim Eingang'),
    ...barStools.map(s => s.spot),
    ...barHighTables.flatMap(([x, y], index) => [
      standingSpot(`high-table-${index + 1}-l`, x - 14, y + 30, `an Stehtisch ${index + 1}`),
      standingSpot(`high-table-${index + 1}-r`, x + 54, y + 30, `an Stehtisch ${index + 1}`),
    ]),
    ...barNook.spots.map(spot => ({ ...spot, id: spot.id.replace('table-1', 'nook'), label: 'in der Sitznische' })),
  ],
  roomFact: 'Der Schankraum hat einen langen Tresen mit fünf Hockern, drei Stehtische und eine Sitznische; der Ausgang liegt beim Eingang',
  guestBackFact: 'Hinter dem Tresen ist eine Tür nur für Personal; was dahinter liegt, weißt du nicht',
  staffBackFact: 'Hinter dem Tresen liegt das Lager; Gäste haben dort keinen Zutritt',
}

// ── Restaurant ──────────────────────────────────────────────────────────────
const restaurantTables = tables([
  [190, 110], [330, 110], [470, 110],
  [190, 240], [330, 240], [470, 240],
  [330, 350], [470, 350],
])

const RESTAURANT_LAYOUT: VenueLayout = {
  kind: 'restaurant',
  template: RESTAURANT_STANDARD_INTERIOR,
  noun: 'Restaurant',
  locative: 'im Restaurant',
  width: VENUE_WIDTH,
  height: VENUE_HEIGHT,
  start: START,
  exit: EXIT,
  playerRoomId: 'guest-room',
  servicePoint: { x: 190, y: 340, label: 'AM EMPFANG', locative: 'am Empfang' },
  windows: [{ x: 155, w: 100 }, { x: 330, w: 100 }],
  furniture: [
    { id: 'desk', kind: 'desk', x: 160, y: 372, w: 56, h: 26 },
    { id: 'wall-kitchen-n', kind: 'wall', x: 590, y: 42, w: 10, h: 118 },
    { id: 'pass', kind: 'pass', x: 588, y: 160, w: 14, h: 70 },
    { id: 'wall-kitchen-s', kind: 'wall', x: 590, y: 230, w: 10, h: 206 },
    { id: 'kitchen', kind: 'kitchen', x: 600, y: 42, w: 125, h: 394 },
    ...restaurantTables.furniture,
  ],
  spots: [
    staffSpot('staff-desk', 236, 392, 'entry', 'am Empfang'),
    staffSpot('staff-pass', 574, 205, 'guest-room', 'an der Durchreiche'),
    staffSpot('staff-kitchen', 660, 200, 'kitchen', 'in der Küche'),
    standingSpot('entry-1', 150, 350, 'beim Eingang'),
    ...restaurantTables.spots,
  ],
  roomFact: 'Der Speiseraum hat acht Tische mit je zwei Stühlen, einen Empfang beim Eingang und eine Durchreiche zur Küche',
  guestBackFact: 'Die Küche liegt hinter einer Wand mit Durchreiche; hineinsehen kannst du nicht und weißt nicht, wer dort arbeitet',
  staffBackFact: 'Hinter der Durchreiche liegt die Küche, dahinter ein Vorratsraum; Gäste haben dort keinen Zutritt',
}

export const VENUE_LAYOUTS: Readonly<Record<VenueKind, VenueLayout>> = {
  cafe: CAFE_LAYOUT,
  bar: BAR_LAYOUT,
  restaurant: RESTAURANT_LAYOUT,
}

const KIND_BY_BUILDING: Readonly<Record<string, VenueKind>> = {
  cafe: 'cafe',
  'café': 'cafe',
  bar: 'bar',
  restaurant: 'restaurant',
}

/** Unbekannte Gebäudetypen fallen auf das Café zurück – der bisherige Stand. */
export function venueKindForBuildingType(buildingTypeId: string | null | undefined): VenueKind {
  return KIND_BY_BUILDING[String(buildingTypeId ?? '').toLowerCase()] ?? 'cafe'
}

export function venueLayoutForBuildingType(buildingTypeId: string | null | undefined): VenueLayout {
  return VENUE_LAYOUTS[venueKindForBuildingType(buildingTypeId)]
}

// ── Begehbare Fläche ────────────────────────────────────────────────────────
export function isVenueBlocked(layout: VenueLayout, p: VenuePoint, radius = VENUE_PLAYER_RADIUS): boolean {
  if (p.x < WALL.left || p.x > WALL.right || p.y < WALL.top || p.y > WALL.bottom) return true
  return layout.furniture.some(item =>
    p.x + radius > item.x && p.x - radius < item.x + item.w
    && p.y + radius > item.y && p.y - radius < item.y + item.h)
}

// ── Sichtweite ──────────────────────────────────────────────────────────────
/**
 * Räume, die über normalerweise offene Durchgänge verbunden sind, bilden einen
 * Sichtbereich. Eine geschlossene Tür trennt – deshalb sieht der Gast weder
 * Nebenraum noch Küche, und die Küche sieht den Gastraum nicht.
 */
export function sightAreas(template: InteriorTemplate): Record<string, string> {
  const area: Record<string, string> = {}
  for (const room of template.rooms) area[room.id] = room.id
  const find = (id: string): string => (area[id] === id ? id : (area[id] = find(area[id])))
  for (const portal of template.portals) {
    if (portal.normallyOpen !== true) continue
    const a = find(portal.fromRoomId)
    const b = find(portal.toRoomId)
    if (a !== b) area[b] = a
  }
  for (const room of template.rooms) area[room.id] = find(room.id)
  return area
}

export function canSeeRoom(layout: VenueLayout, fromRoomId: string, toRoomId: string): boolean {
  const areas = sightAreas(layout.template)
  return areas[fromRoomId] !== undefined && areas[fromRoomId] === areas[toRoomId]
}

// ── Figuren ─────────────────────────────────────────────────────────────────
export type VenueRoomRole = 'staff' | 'guest' | 'companion'

export interface VenueResidentInput {
  id: string
  /** Hat eine aktive Arbeitszuweisung in genau diesem Gebäude. */
  worksHere: boolean
  /** Ist mit dem Spieler hereingekommen. */
  isCompanion?: boolean
  /** Maßgeblicher Raum aus person_interior_presence, falls vorhanden. */
  presenceRoomId?: string | null
}

export interface VenueFigure {
  id: string
  roomRole: VenueRoomRole
  spot: VenueSpot
  /** Steht die Figur im Sichtbereich des Spielers? */
  visibleToPlayer: boolean
}

function stableHash(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function hiddenSpot(layout: VenueLayout, roomId: string): VenueSpot {
  const room = layout.template.rooms.find(r => r.id === roomId)
  return { id: 'hidden:' + roomId, kind: 'staff', x: -1, y: -1, roomId, label: 'im ' + (room?.name ?? 'Nebenraum'), posture: 'standing' }
}

/**
 * Setzt Personen an Plätze. Deterministisch: dieselbe Person sitzt beim
 * nächsten Betreten wieder am selben Platz, solange der Platz frei ist.
 *
 * - Personal steht an den Personalplätzen (Tresen, Empfang, Durchreiche, Küche).
 * - Eine Begleitung bleibt beim Eingang.
 * - Gäste sitzen oder stehen an freien Plätzen.
 * - Liegt ein maßgeblicher Raum vor und ist er vom Gastraum aus nicht
 *   einsehbar, ist die Figur für den Spieler nicht sichtbar.
 * - Wer keinen Platz mehr findet, wird nicht dargestellt.
 */
export function placeVenueFigures(layout: VenueLayout, residents: readonly VenueResidentInput[]): VenueFigure[] {
  const taken = new Set<string>()
  const figures: VenueFigure[] = []
  const visible = (spot: VenueSpot) => spot.x >= 0 && canSeeRoom(layout, layout.playerRoomId, spot.roomId)
  const put = (resident: VenueResidentInput, roomRole: VenueRoomRole, spot: VenueSpot) => {
    if (!spot.id.startsWith('hidden:')) taken.add(spot.id)
    figures.push({ id: resident.id, roomRole, spot, visibleToPlayer: visible(spot) })
  }
  const knownRoom = (roomId: string | null | undefined) =>
    roomId && layout.template.rooms.some(room => room.id === roomId) ? roomId : null
  const sorted = [...residents].sort((a, b) => a.id.localeCompare(b.id))
  const unique = sorted.filter((resident, index) => index === 0 || sorted[index - 1].id !== resident.id)

  const entrySpots = layout.spots.filter(spot => spot.kind === 'standing' && spot.id.startsWith('entry-'))
  const guestSpots = layout.spots.filter(spot => spot.kind !== 'staff' && !spot.id.startsWith('entry-'))
  const freeGuestSpot = (id: string): VenueSpot | null => {
    if (guestSpots.length === 0) return null
    const offset = stableHash(id) % guestSpots.length
    for (let i = 0; i < guestSpots.length; i++) {
      const spot = guestSpots[(offset + i) % guestSpots.length]
      if (!taken.has(spot.id)) return spot
    }
    return null
  }

  const staffSpots = layout.spots.filter(spot => spot.kind === 'staff')
  const staffOnlyRoom = layout.template.rooms.find(room => room.tags?.includes('staff-only'))?.id ?? layout.playerRoomId
  for (const resident of unique.filter(r => r.worksHere)) {
    const presence = knownRoom(resident.presenceRoomId)
    const candidates = presence
      ? staffSpots.filter(spot => canSeeRoom(layout, presence, spot.roomId))
      : staffSpots
    const spot = candidates.find(s => !taken.has(s.id))
    if (spot) { put(resident, 'staff', spot); continue }
    // Kein freier Personalplatz. Ist die Person nachweislich vorn, setzt sie
    // sich dazu; sonst ist sie hinten beschäftigt.
    const inFront = presence && canSeeRoom(layout, layout.playerRoomId, presence) ? freeGuestSpot(resident.id) : null
    put(resident, 'staff', inFront ?? hiddenSpot(layout, presence && !canSeeRoom(layout, layout.playerRoomId, presence) ? presence : staffOnlyRoom))
  }

  for (const resident of unique.filter(r => !r.worksHere)) {
    const roomRole: VenueRoomRole = resident.isCompanion ? 'companion' : 'guest'
    const presence = knownRoom(resident.presenceRoomId)
    if (presence && !canSeeRoom(layout, layout.playerRoomId, presence)) {
      put(resident, roomRole, hiddenSpot(layout, presence))
      continue
    }
    const entry = resident.isCompanion ? entrySpots.find(s => !taken.has(s.id)) : null
    const spot = entry ?? freeGuestSpot(resident.id)
    if (spot) put(resident, roomRole, spot)
  }
  return figures
}

// ── Betrieb ─────────────────────────────────────────────────────────────────
/**
 * Entscheidung (Thomas, 10.10.2026): Ein Lokal ohne Personal ist geschlossen –
 * oder ein Automatencafé. Es gibt keinen Platzhalter-Wirt mehr.
 *
 * - `staffed`: Mindestens eine Person arbeitet hier.
 * - `self-service`: Café ohne Personal. Der Automat am Tresen verkauft, niemand berät.
 * - `closed`: Bar oder Restaurant ohne Personal. Kein Ausschank, keine Gäste.
 */
export type VenueService = 'staffed' | 'self-service' | 'closed'

export function venueService(layout: VenueLayout, figures: readonly VenueFigure[]): VenueService {
  if (figures.some(figure => figure.roomRole === 'staff')) return 'staffed'
  return layout.kind === 'cafe' ? 'self-service' : 'closed'
}

export interface VenueMenuItem {
  label: string
  priceCredits: number
}

// ── Wo steht der Spieler? ───────────────────────────────────────────────────
/** Ortsangabe für den Spieler, wie sie jemand im Raum beschreiben würde. */
export function describePlayerPosition(layout: VenueLayout, pos: VenuePoint): string {
  const distance = (p: VenuePoint) => Math.hypot(p.x - pos.x, p.y - pos.y)
  if (distance(layout.servicePoint) < 60) return layout.servicePoint.locative
  if (distance(layout.exit) < 60) return 'beim Eingang'
  const near = layout.spots
    .filter(spot => spot.kind !== 'staff' && !spot.id.startsWith('entry-'))
    .map(spot => ({ spot, d: distance(spot) }))
    .sort((a, b) => a.d - b.d)[0]
  if (near && near.d < 64) return near.spot.label.replace('auf einem Hocker am Tresen', 'am Tresen')
  return 'mitten im Raum'
}

// ── Gesprächswissen ─────────────────────────────────────────────────────────
export const MAX_CONVERSATION_FACTS = 16
export const MAX_CONVERSATION_FACT_CHARS = 140

/**
 * Was jemand weiß, der in einem Lokal arbeitet, in dem Neue ankommen: der Weg
 * in die Welt. Allgemeinwissen über die Gegend, nichts über den Gast.
 */
export const ARRIVAL_ORIENTATION_FACTS: readonly string[] = [
  'Du kennst die Gegend und hilfst neuen Gästen gern beim Einstieg',
  'In der Akademie kann man Wissen sammeln und Prüfungen ablegen; mehr Wissen öffnet mehr Möglichkeiten',
  'Handeln ist auch ohne eigenes Schiff möglich: Ein Spediteur übernimmt den Transport und behält dafür einen Anteil vom Gewinn',
  'Ohne eigenes Schiff kann man per Linienflug zu anderen Orten reisen; das Ticket kostet Credits',
  'Ein eigenes Schiff ist kein Muss, sondern ein möglicher späterer Schritt, wenn man genug Credits hat',
  'Wer ein Ziel hat (z. B. kosmischer Händler), beginnt klein: Waren günstig kaufen, am Zielort teurer verkaufen',
  'Den Heimatort kann man bei der Verwaltung des Ortes ändern, an dem man sich registrieren will',
]

const NUMBER_WORDS = ['keine', 'eine', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf']

function people(count: number): string {
  return `${NUMBER_WORDS[count] ?? String(count)} ${count === 1 ? 'Person' : 'Personen'}`
}

function fit(text: string): string {
  return text.length <= MAX_CONVERSATION_FACT_CHARS ? text : text.slice(0, MAX_CONVERSATION_FACT_CHARS - 1).trimEnd() + '…'
}

function othersFact(layout: VenueLayout, self: VenueFigure, figures: readonly VenueFigure[]): string {
  const seen = figures.filter(other => other.id !== self.id && other.spot.x >= 0 && canSeeRoom(layout, self.spot.roomId, other.spot.roomId))
  if (seen.length === 0) return 'Außer dir und deinem Gegenüber siehst du gerade niemanden im Raum'
  const groups = new Map<string, number>()
  for (const other of seen) groups.set(other.spot.label, (groups.get(other.spot.label) ?? 0) + 1)
  const detail = 'Außer euch siehst du im Raum: ' + [...groups].map(([label, count]) => `${people(count)} ${label}`).join(', ')
  const names = '; ihre Namen kennst du nicht'
  if (detail.length + names.length <= MAX_CONVERSATION_FACT_CHARS) return detail + names
  if (detail.length <= MAX_CONVERSATION_FACT_CHARS) return detail
  return `Außer euch siehst du ${people(seen.length)} im Raum, verteilt auf mehrere Plätze`
}

export interface ConversationFactsInput {
  layout: VenueLayout
  buildingName: string
  /** Die Figur, die spricht. */
  self: VenueFigure
  /** Alle platzierten Figuren, auch die für den Spieler unsichtbaren. */
  figures: readonly VenueFigure[]
  playerPos: VenuePoint
  /** Kommen in diesem Lokal neue Spieler an? Dann kennt das Personal den Einstieg. */
  arrivalPoint: boolean
  /** Die Karte des Lokals. Leer oder weggelassen: hier wird nichts verkauft. */
  menu?: readonly VenueMenuItem[]
  /** Was der Spieler bei diesem Besuch bestellt hat – jeder im Raum hat es gesehen. */
  playerOrders?: readonly string[]
}

function menuFact(layout: VenueLayout, menu: readonly VenueMenuItem[]): string {
  const tail = ` Credits; bestellt und bezahlt wird ${layout.servicePoint.locative}, nicht im Gespräch`
  let list = ''
  for (const item of menu) {
    const next = (list ? list + ', ' : '') + `${item.label} ${item.priceCredits}`
    if (('Karte: ' + next + tail).length > MAX_CONVERSATION_FACT_CHARS) break
    list = next
  }
  return 'Karte: ' + list + tail
}

function ordersFact(orders: readonly string[]): string {
  const counts = new Map<string, number>()
  for (const label of orders) counts.set(label, (counts.get(label) ?? 0) + 1)
  return 'Dein Gegenüber hat hier eben bestellt: ' + [...counts].map(([label, count]) => (count > 1 ? `${count}× ${label}` : label)).join(', ')
}

/**
 * Verifizierte lokale Fakten für die Gesprächspipeline – aus Sicht der Figur.
 * Die Liste bleibt innerhalb der Grenzen von /api/game/npc-conversation
 * (höchstens 16 Fakten mit je 140 Zeichen), damit nichts abgeschnitten wird.
 */
export function venueConversationFacts(input: ConversationFactsInput): string[] {
  const { layout, self } = input
  const staff = self.roomRole === 'staff'
  const name = String(input.buildingName ?? '').replace(/\s+/g, ' ').trim().slice(0, 60)
  const seesGuestRoom = canSeeRoom(layout, self.spot.roomId, layout.playerRoomId)
  const posture = self.spot.posture === 'sitting' ? 'sitzt' : 'stehst'

  const facts: string[] = [
    name ? `Ihr befindet euch ${layout.locative} ${name}` : `Ihr befindet euch ${layout.locative}`,
  ]
  if (seesGuestRoom) facts.push(layout.roomFact)

  if (staff) facts.push(`Du arbeitest hier und ${posture} ${self.spot.label}`)
  else if (self.roomRole === 'companion') facts.push(`Du bist mit deinem Gegenüber hergekommen und ${posture} ${self.spot.label}`)
  else facts.push(`Du bist als Gast hier und ${posture} ${self.spot.label}`)

  if (seesGuestRoom) {
    facts.push(`Dein Gegenüber steht gerade ${describePlayerPosition(layout, input.playerPos)}`)
    facts.push(othersFact(layout, self, input.figures))
  }
  facts.push(staff ? layout.staffBackFact : layout.guestBackFact)

  // Das Personal kennt die Karte. Ein Gast weiß nur, wo bestellt wird. Preise
  // nennt niemand aus dem Kopf, der sie nicht kennt, und niemand kassiert im
  // Gespräch: gebucht wird ausschließlich am Tresen, Empfang oder Automaten.
  const menu = input.menu ?? []
  if (menu.length === 0) {
    facts.push(staff
      ? 'Heute wird noch nichts ausgeschenkt oder kassiert; nimm keine Bestellungen an und nenne keine Preise'
      : 'Heute wird hier noch nichts ausgeschenkt; du hast nichts bestellt und kennst keine Preise')
  } else if (staff) {
    facts.push(menuFact(layout, menu))
  } else if (venueService(layout, input.figures) === 'self-service') {
    facts.push(`Hier bedient kein Personal; bestellt und bezahlt wird am Automaten ${layout.servicePoint.locative}`)
  } else {
    facts.push(`Bestellt und bezahlt wird ${layout.servicePoint.locative} beim Personal; die Preise hast du nicht im Kopf`)
  }
  if (seesGuestRoom && input.playerOrders?.length) facts.push(ordersFact(input.playerOrders))

  facts.push('Über Kontostand, Wissen, Beruf oder Vorhaben deines Gegenübers weißt du nur, was es dir selbst erzählt')

  if (staff && input.arrivalPoint) facts.push(...ARRIVAL_ORIENTATION_FACTS)

  return facts.slice(0, MAX_CONVERSATION_FACTS).map(fit)
}
