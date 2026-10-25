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
import { HOTEL_STANDARD_INTERIOR } from '../buildings/interiors/templates/hotelStandard'
import { RESTAURANT_STANDARD_INTERIOR } from '../buildings/interiors/templates/restaurantStandard'

export type VenueKind = 'cafe' | 'bar' | 'restaurant' | 'hotel'

export interface VenuePoint { x: number; y: number }

export type VenueFurnitureKind =
  | 'table' | 'high-table' | 'counter' | 'chair' | 'stool' | 'shelf' | 'desk' | 'wall' | 'pass' | 'kitchen' | 'stairs'

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

// ── Hotel ───────────────────────────────────────────────────────────────────
// Lobby mit Empfang; die Zimmer liegen oben, die Treppe gehört zum Haus.
const hotelLounge = tables([[190, 300], [330, 300]])
const HOTEL_STAIRS: VenueFurniture = { id: 'stairs', kind: 'stairs', x: 640, y: 330, w: 58, h: 40 }
const HOTEL_LAYOUT: VenueLayout = {
  kind: 'hotel',
  template: HOTEL_STANDARD_INTERIOR,
  noun: 'Hotel',
  locative: 'im Hotel',
  width: VENUE_WIDTH,
  height: VENUE_HEIGHT,
  start: START,
  exit: EXIT,
  playerRoomId: 'guest-room',
  servicePoint: { x: 430, y: 160, label: 'AM EMPFANG', locative: 'am Empfang' },
  windows: [{ x: 120, w: 100 }, { x: 260, w: 100 }],
  furniture: [
    { id: 'desk', kind: 'desk', x: 380, y: 90, w: 180, h: 40 },
    { id: 'shelf', kind: 'shelf', x: 380, y: 60, w: 180, h: 12 },
    ...hotelLounge.furniture,
    HOTEL_STAIRS,
  ],
  spots: [
    staffSpot('staff-desk', 470, 76, 'counter', 'hinter dem Empfang'),
    standingSpot('entry-1', 150, 395, 'beim Eingang'),
    ...hotelLounge.spots.map(spot => ({ ...spot, label: spot.label.replace('an Tisch', 'in der Lobby an Tisch') })),
  ],
  roomFact: 'Die Lobby hat einen Empfang, zwei Tische mit je zwei Stühlen und eine Treppe zu den Zimmern; der Ausgang liegt beim Eingang',
  guestBackFact: 'Hinter dem Empfang ist eine Tür zum Büro; was dahinter liegt, weißt du nicht',
  staffBackFact: 'Hinter dem Empfang liegt das Büro mit den Zimmerschlüsseln; Gäste haben dort keinen Zutritt',
}

export const VENUE_LAYOUTS: Readonly<Record<VenueKind, VenueLayout>> = {
  cafe: CAFE_LAYOUT,
  bar: BAR_LAYOUT,
  restaurant: RESTAURANT_LAYOUT,
  hotel: HOTEL_LAYOUT,
}

const KIND_BY_BUILDING: Readonly<Record<string, VenueKind>> = {
  cafe: 'cafe',
  'café': 'cafe',
  bar: 'bar',
  restaurant: 'restaurant',
  hotel: 'hotel',
}

/** Unbekannte Gebäudetypen fallen auf das Café zurück – der bisherige Stand. */
export function venueKindForBuildingType(buildingTypeId: string | null | undefined): VenueKind {
  return KIND_BY_BUILDING[String(buildingTypeId ?? '').toLowerCase()] ?? 'cafe'
}

export function venueLayoutForBuildingType(buildingTypeId: string | null | undefined): VenueLayout {
  return VENUE_LAYOUTS[venueKindForBuildingType(buildingTypeId)]
}

// ── Größe nach Gebäude ──────────────────────────────────────────────────────
// Ein Lokal entsteht auf der Erde im gekauften Haus (Entscheidung Thomas,
// 25.10.2026). Ein kleines Haus hat weniger Tische, ein großes mehr. Die
// Grundfläche kommt aus dem Gebäude (footprint); ohne Angabe gilt die Vorlage.
export type VenueSize = 'small' | 'standard' | 'large'
export const VENUE_SIZE_AREA = { smallBelowM2: 110, largeFromM2: 260 } as const

export function venueSizeForArea(areaM2: number | null | undefined): VenueSize {
  if (areaM2 == null || !Number.isFinite(areaM2) || areaM2 <= 0) return 'standard'
  if (areaM2 < VENUE_SIZE_AREA.smallBelowM2) return 'small'
  if (areaM2 >= VENUE_SIZE_AREA.largeFromM2) return 'large'
  return 'standard'
}

/** Zusätzliche Tische für die große Variante – an freien Stellen der Vorlage. */
const EXTRA_TABLES: Readonly<Record<VenueKind, Array<[number, number]>>> = {
  cafe: [[350, 390], [520, 290]],
  // Das Restaurant ist mit acht Tischen schon voll; größer wird nur die Küche – später.
  restaurant: [],
  bar: [],
  hotel: [[470, 300]],
}

const NUMBER_WORDS_TABLES = ['keinen Tisch', 'einen Tisch', 'zwei Tische', 'drei Tische', 'vier Tische', 'fünf Tische', 'sechs Tische', 'sieben Tische', 'acht Tische', 'neun Tische', 'zehn Tische']

const SIZED_LAYOUTS = new Map<string, VenueLayout>()

/**
 * Die Vorlage in klein, normal oder groß. Klein lässt die letzten Tische weg
 * (mindestens zwei bleiben), groß stellt weitere auf. Hocker, Tresen, Empfang
 * und Treppe bleiben, wie sie sind.
 */
export function venueLayoutForSize(layout: VenueLayout, size: VenueSize): VenueLayout {
  if (size === 'standard') return layout
  const key = layout.kind + ':' + size + ':' + layout.furniture.some(f => f.kind === 'stairs')
  const cached = SIZED_LAYOUTS.get(key)
  if (cached) return cached
  const tableNumbers = [...new Set(layout.furniture.filter(f => f.kind === 'table').map(f => Number(f.id.replace('table-', ''))).filter(Number.isFinite))].sort((a, b) => a - b)
  let furniture = layout.furniture
  let spots = layout.spots
  if (size === 'small') {
    const keep = Math.max(2, Math.ceil(tableNumbers.length / 2))
    const drop = new Set(tableNumbers.slice(keep))
    const dropped = (id: string) => { const m = /^(table|chair)-(\d+)/.exec(id); return Boolean(m) && drop.has(Number(m![2])) }
    furniture = furniture.filter(f => !dropped(f.id))
    spots = spots.filter(spot => !dropped(spot.id))
  } else {
    const start = (tableNumbers[tableNumbers.length - 1] ?? 0) + 1
    const extra = EXTRA_TABLES[layout.kind].map(([x, y], index) => tableWithChairs(start + index, x, y))
    furniture = [...furniture, ...extra.flatMap(t => t.furniture)]
    spots = [...spots, ...extra.flatMap(t => t.spots)]
  }
  const count = new Set(furniture.filter(f => f.kind === 'table').map(f => f.id)).size
  const roomFact = layout.roomFact.replace(/\b(ein|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)(en)? Tische?\b/, NUMBER_WORDS_TABLES[count] ?? `${count} Tische`)
  const sized = { ...layout, furniture, spots, roomFact }
  SIZED_LAYOUTS.set(key, sized)
  return sized
}

// ── Obergeschoss ────────────────────────────────────────────────────────────
// Ein Lokal kann unten Lokal und oben etwas anderes sein: Wohnungen (der Wirt
// wohnt über seinem Café) oder Gästezimmer (dann ist es ein Hotel mit Lokal).
// Ob es das Obergeschoss gibt, sagen die Gebäudedaten – nicht der Lokaltyp.
export interface VenueUpperFloor {
  /** Wohnplätze über dem Lokal (tile_entities.residential_capacity). */
  homes: number
  /** Gästezimmer über dem Lokal (tile_entities.transient_capacity). */
  guestRooms: number
}

export function hasUpperFloor(upper: VenueUpperFloor | null | undefined): upper is VenueUpperFloor {
  return Boolean(upper && (upper.homes > 0 || upper.guestRooms > 0))
}

const STAIRS: VenueFurniture = { id: 'stairs', kind: 'stairs', x: 38, y: 46, w: 58, h: 40 }
const UPPER_LAYOUTS = new WeakMap<VenueLayout, VenueLayout>()

/** Derselbe Raum mit einer Treppe nach oben in der hinteren linken Ecke. */
export function withUpperFloor(layout: VenueLayout): VenueLayout {
  // Ein Haus, das die Treppe schon hat (Hotel), bekommt keine zweite.
  if (layout.furniture.some(item => item.kind === 'stairs')) return layout
  const cached = UPPER_LAYOUTS.get(layout)
  if (cached) return cached
  const upper = { ...layout, furniture: [...layout.furniture, STAIRS] }
  UPPER_LAYOUTS.set(layout, upper)
  return upper
}

/** Was jemand über das Obergeschoss weiß. Gäste sehen nur die Treppe. */
export function upperFloorFact(upper: VenueUpperFloor, staff: boolean): string {
  if (upper.guestRooms > 0) {
    return staff
      ? `Im Obergeschoss liegen ${upper.guestRooms} Gästezimmer; Zimmer vergibst du noch nicht, das Haus nimmt bisher keine Übernachtungsgäste auf`
      : 'Eine Treppe führt zu Gästezimmern im Obergeschoss; ob man dort schon übernachten kann, weißt du nicht'
  }
  return staff
    ? 'Über dem Lokal liegt eine Wohnung; die Treppe in der Ecke ist privat'
    : 'In der Ecke führt eine Treppe nach oben; sie ist privat, was oben ist, weißt du nicht'
}

// ── Öffnungszeiten ──────────────────────────────────────────────────────────
// Stunden in Koloniezeit (ein Tick ist eine Stunde, siehe circadian.ts).
// Das Café ist der Ort des Tages, die Bar der Ort der Nacht. Ein Automatencafé
// hat kein Personal und deshalb auch keine Schließzeit.
export const VENUE_HOURS: Readonly<Record<VenueKind, { open: number; close: number }>> = {
  cafe: { open: 6, close: 20 },
  restaurant: { open: 11, close: 23 },
  bar: { open: 17, close: 2 },
  // Der Empfang ist immer besetzt – Reisende kommen zu jeder Stunde.
  hotel: { open: 0, close: 24 },
}

export type VenueHours = { open: number; close: number; clock: 'colony' | 'player' }

/**
 * Das Startcafé (Ankunftsort neuer Spieler) richtet sich nach der echten
 * Ortszeit des Spielers, nicht nach Koloniezeit – Entscheidung Thomas,
 * 13.10.2026: geschlossen von 23 bis 6 Uhr. Bewohner leben weiter nach
 * Koloniezeit; dasselbe Café kann für den Spieler zu und für sie offen sein.
 */
export const ARRIVAL_PLAYER_HOURS: VenueHours = { open: 6, close: 23, clock: 'player' }

/** Welche Uhr und welche Zeiten für den Spieler in diesem Lokal gelten. */
export function venueHoursFor(kind: VenueKind, arrivalPoint = false): VenueHours {
  return arrivalPoint ? ARRIVAL_PLAYER_HOURS : { ...VENUE_HOURS[kind], clock: 'colony' }
}

const hourOfDay = (hour: number) => ((Math.trunc(hour) % 24) + 24) % 24

export function venueOpenAt(kind: VenueKind, hour: number, hours: VenueHours = venueHoursFor(kind)): boolean {
  const { open, close } = hours
  const h = hourOfDay(hour)
  return open < close ? h >= open && h < close : h >= open || h < close
}

export function venueHoursText(kind: VenueKind, hours: VenueHours = venueHoursFor(kind)): string {
  if (hours.open === 0 && hours.close === 24) return 'rund um die Uhr'
  return `von ${hours.open} bis ${hours.close} Uhr`
}

/** „Koloniezeit“ oder „deiner Ortszeit“ – damit der Spieler weiß, welche Uhr gilt. */
export function clockLabel(hours: VenueHours): string {
  return hours.clock === 'player' ? 'deiner Ortszeit' : 'Koloniezeit'
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

/** `hour` ist die Koloniestunde; ohne Angabe gelten keine Öffnungszeiten. */
export function venueService(layout: VenueLayout, figures: readonly VenueFigure[], hour?: number | null, hours: VenueHours = venueHoursFor(layout.kind)): VenueService {
  if (figures.some(figure => figure.roomRole === 'staff')) {
    return hour == null || venueOpenAt(layout.kind, hour, hours) ? 'staffed' : 'closed'
  }
  return layout.kind === 'cafe' ? 'self-service' : 'closed'
}

/** Warum ein Lokal zu ist: außerhalb der Öffnungszeit oder weil niemand dort arbeitet. */
export function venueClosedReason(layout: VenueLayout, figures: readonly VenueFigure[], hour?: number | null, hours: VenueHours = venueHoursFor(layout.kind)): 'hours' | 'no-staff' | null {
  if (venueService(layout, figures, hour, hours) !== 'closed') return null
  return figures.some(figure => figure.roomRole === 'staff') ? 'hours' : 'no-staff'
}

export interface VenueMenuItem {
  label: string
  priceCredits: number
}

// ── Bestellplatz ────────────────────────────────────────────────────────────
const SERVICE_REACH = 44

/**
 * Steht jemand am Tresen, Empfang oder Automaten? Gemeint ist die ganze Kante
 * des Möbels, nicht nur seine Mitte – wer am Ende des Tresens steht, steht am Tresen.
 */
export function isAtServicePoint(layout: VenueLayout, pos: VenuePoint): boolean {
  if (Math.hypot(pos.x - layout.servicePoint.x, pos.y - layout.servicePoint.y) < 60) return true
  return layout.furniture.some(item => {
    if (item.kind !== 'counter' && item.kind !== 'desk') return false
    const dx = Math.max(item.x - pos.x, 0, pos.x - (item.x + item.w))
    const dy = Math.max(item.y - pos.y, 0, pos.y - (item.y + item.h))
    return Math.hypot(dx, dy) <= SERVICE_REACH
  })
}

// ── Besuch eines Gastes ─────────────────────────────────────────────────────
// Ein Besuch beginnt mit einem echten Kauf (person_consumption_events). Was
// danach im Raum zu sehen ist, folgt allein aus der seither vergangenen Zeit:
// am Tresen bestellen, zum Platz gehen, sitzen, gehen. Nichts davon wird
// gespeichert, und niemand erscheint ohne Kauf.
export const VISIT_TIMES = { orderS: 90, walkS: 18, stayS: 35 * 60, leaveS: 22 } as const
export type VisitPhase = 'ordering' | 'to-seat' | 'seated' | 'leaving' | 'gone'

export function visitPhase(ageSeconds: number): { phase: VisitPhase; progress: number } {
  const t = Math.max(0, ageSeconds)
  const { orderS, walkS, stayS, leaveS } = VISIT_TIMES
  if (t < orderS) return { phase: 'ordering', progress: t / orderS }
  if (t < orderS + walkS) return { phase: 'to-seat', progress: (t - orderS) / walkS }
  if (t < orderS + walkS + stayS) return { phase: 'seated', progress: (t - orderS - walkS) / stayS }
  if (t < orderS + walkS + stayS + leaveS) return { phase: 'leaving', progress: (t - orderS - walkS - stayS) / leaveS }
  return { phase: 'gone', progress: 1 }
}

const PATH_STEP = 8
const PATH_RADIUS = 7

/**
 * Weg durch den Raum um die Möbel herum. Start und Ziel dürfen auf einem
 * Stuhl oder direkt am Tresen liegen; gesucht wird ab der nächsten freien Stelle.
 */
export function venuePath(layout: VenueLayout, from: VenuePoint, to: VenuePoint): VenuePoint[] {
  const free = (p: VenuePoint) => !isVenueBlocked(layout, p, PATH_RADIUS)
  const snap = (p: VenuePoint): VenuePoint | null => {
    const base = { x: Math.round(p.x / PATH_STEP) * PATH_STEP, y: Math.round(p.y / PATH_STEP) * PATH_STEP }
    let best: VenuePoint | null = null, bestD = Infinity
    for (let dx = -6; dx <= 6; dx++) for (let dy = -6; dy <= 6; dy++) {
      const c = { x: base.x + dx * PATH_STEP, y: base.y + dy * PATH_STEP }
      const d = Math.hypot(c.x - p.x, c.y - p.y)
      if (d < bestD && free(c)) { best = c; bestD = d }
    }
    return best
  }
  const start = snap(from), goal = snap(to)
  if (!start || !goal) return [from, to]
  const key = (p: VenuePoint) => p.x + ':' + p.y
  const previous = new Map<string, VenuePoint | null>([[key(start), null]])
  const queue: VenuePoint[] = [start]
  while (queue.length) {
    const p = queue.shift() as VenuePoint
    if (p.x === goal.x && p.y === goal.y) break
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const next = { x: p.x + dx * PATH_STEP, y: p.y + dy * PATH_STEP }
      if (previous.has(key(next)) || !free(next)) continue
      // schräg nur, wenn beide Nachbarn frei sind – sonst schneidet der Weg eine Ecke
      if (dx && dy && (!free({ x: p.x + dx * PATH_STEP, y: p.y }) || !free({ x: p.x, y: p.y + dy * PATH_STEP }))) continue
      previous.set(key(next), p)
      queue.push(next)
    }
  }
  if (!previous.has(key(goal))) return [from, to]
  const cells: VenuePoint[] = []
  for (let p: VenuePoint | null = goal; p; p = previous.get(key(p)) ?? null) cells.unshift(p)
  return [from, ...cells, to]
}

/** Punkt nach dem Anteil `t` (0…1) der Weglänge. */
export function pointAlongPath(path: readonly VenuePoint[], t: number): VenuePoint {
  if (path.length === 0) return { x: 0, y: 0 }
  const lengths = path.slice(1).map((p, i) => Math.hypot(p.x - path[i].x, p.y - path[i].y))
  const total = lengths.reduce((sum, l) => sum + l, 0)
  let remaining = Math.max(0, Math.min(1, t)) * total
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i]) {
      const f = lengths[i] > 0 ? remaining / lengths[i] : 0
      return { x: path[i].x + (path[i + 1].x - path[i].x) * f, y: path[i].y + (path[i + 1].y - path[i].y) * f }
    }
    remaining -= lengths[i]
  }
  return path[path.length - 1]
}

export interface GuestMoment {
  phase: VisitPhase
  point: VenuePoint
  /** Der Platz, den die Figur gerade einnimmt – für das, was sie über sich weiß. */
  spot: VenueSpot
  /** Steht das Bestellte schon vor ihr? */
  served: boolean
}

/** Wo ein Gast `ageSeconds` nach seinem Kauf ist. `seat` ist sein zugewiesener Platz. */
export function guestMoment(layout: VenueLayout, seat: VenueSpot, ageSeconds: number): GuestMoment {
  const { phase, progress } = visitPhase(ageSeconds)
  const counter: VenueSpot = { id: 'at-service', kind: 'standing', x: layout.servicePoint.x, y: layout.servicePoint.y, roomId: layout.playerRoomId, label: layout.servicePoint.locative, posture: 'standing' }
  if (phase === 'ordering') return { phase, point: layout.servicePoint, spot: counter, served: false }
  if (phase === 'to-seat') return { phase, point: pointAlongPath(venuePath(layout, layout.servicePoint, seat), progress), spot: { ...seat, posture: 'standing' }, served: false }
  if (phase === 'seated') return { phase, point: seat, spot: seat, served: true }
  const exitSpot: VenueSpot = { id: 'leaving', kind: 'standing', x: layout.exit.x, y: layout.exit.y, roomId: layout.playerRoomId, label: 'auf dem Weg zum Ausgang', posture: 'standing' }
  return { phase, point: phase === 'leaving' ? pointAlongPath(venuePath(layout, seat, layout.exit), progress) : layout.exit, spot: exitSpot, served: false }
}

// ── Hinsetzen und Dazusetzen ────────────────────────────────────────────────
/** Freie Sitzplätze im Gastraum: niemand sitzt dort oder ist dorthin unterwegs. */
export function freeSeats(layout: VenueLayout, figures: readonly VenueFigure[], taken: readonly string[] = []): VenueSpot[] {
  const used = new Set([...figures.map(figure => figure.spot.id), ...taken])
  return layout.spots.filter(spot => spot.kind === 'seat' && spot.roomId === layout.playerRoomId && !used.has(spot.id))
}

/** Der nächste freie Platz von einer Stelle aus. */
export function nearestFreeSeat(layout: VenueLayout, figures: readonly VenueFigure[], from: VenuePoint): VenueSpot | null {
  return freeSeats(layout, figures).map(spot => ({ spot, d: Math.hypot(spot.x - from.x, spot.y - from.y) })).sort((a, b) => a.d - b.d)[0]?.spot ?? null
}

/** Ein freier Platz am selben Tisch (gleiche Ortsangabe) – der nächste zuerst. */
export function seatBeside(layout: VenueLayout, seat: VenueSpot, figures: readonly VenueFigure[]): VenueSpot | null {
  return freeSeats(layout, figures, [seat.id]).filter(spot => spot.label === seat.label)
    .map(spot => ({ spot, d: Math.hypot(spot.x - seat.x, spot.y - seat.y) })).sort((a, b) => a.d - b.d)[0]?.spot ?? null
}

/**
 * Setzt sich dieser Gast zu jemandem an den Tisch? Nicht jeder tut es – etwa
 * jeder zweite, fest je Person, damit es beim Neuladen nicht umspringt.
 */
export function likesCompany(personId: string): boolean {
  let sum = 0
  for (const char of personId) sum = (sum * 31 + char.charCodeAt(0)) >>> 0
  return sum % 2 === 0
}

/**
 * Kommt ein Gast an den Tisch des Spielers? Nur wer erst nach dem Hinsetzen
 * des Spielers vom Tresen losgeht, wer Gesellschaft mag und wenn dort frei ist.
 */
export function seatForGuest(layout: VenueLayout, own: VenueSpot, guestId: string, ageSeconds: number, player: { seat: VenueSpot; seatedForS: number } | null, figures: readonly VenueFigure[]): { seat: VenueSpot; joined: boolean } {
  if (!player) return { seat: own, joined: false }
  const leftCounterAgoS = ageSeconds - VISIT_TIMES.orderS
  const cameAfter = leftCounterAgoS < player.seatedForS
  const beside = seatBeside(layout, player.seat, figures.filter(figure => figure.id !== guestId))
  if (cameAfter && beside && (likesCompany(guestId) || own.id === player.seat.id)) return { seat: beside, joined: true }
  // Sitzt der Spieler auf dem Platz, der diesem Gast zugedacht war, weicht der Gast aus.
  if (own.id === player.seat.id) return { seat: freeSeats(layout, figures.filter(figure => figure.id !== guestId), [own.id])[0] ?? own, joined: false }
  return { seat: own, joined: false }
}

// ── Zimmer ──────────────────────────────────────────────────────────────────
// Ein Zimmer ist ein Posten der Karte (`room_night`), gebucht am Empfang wie
// eine Bestellung. Wie viele Zimmer es gibt, sagen die Gebäudedaten
// (transient_capacity); belegt ist, was in den letzten 24 Stunden gebucht wurde.
export const ROOM_ITEM_CODE = 'room_night'
export const ROOM_NIGHT_S = 24 * 60 * 60

export interface VenueRooms {
  capacity: number
  /** Belegte Zimmer, die Buchung des Spielers eingeschlossen. */
  occupied: number
  /** Hat der Spieler hier gerade ein Zimmer? Dann bis wann (Sekunden). */
  mineForS: number | null
}

export function roomsFree(rooms: VenueRooms): number {
  return Math.max(0, rooms.capacity - rooms.occupied)
}

/** Darf der Spieler jetzt buchen? Nicht ohne Zimmer, nicht doppelt. */
export function canBookRoom(rooms: VenueRooms | null | undefined): boolean {
  return Boolean(rooms) && rooms!.mineForS == null && roomsFree(rooms!) > 0
}

function hoursLeft(seconds: number): string {
  const h = Math.max(1, Math.round(seconds / 3600))
  return h === 1 ? 'noch etwa eine Stunde' : `noch etwa ${h} Stunden`
}

/** Was das Personal bzw. ein Gast über die Zimmer weiß. */
export function roomsFact(rooms: VenueRooms, staff: boolean): string {
  if (rooms.capacity === 0) return staff ? 'Dieses Haus hat keine Gästezimmer' : 'Ob es hier Zimmer gibt, weißt du nicht'
  const mine = rooms.mineForS != null ? `; dein Gegenüber hat hier ein Zimmer, ${hoursLeft(rooms.mineForS)}` : ''
  if (!staff) return fit(`Oben gibt es Gästezimmer; wie viele frei sind, weißt du nicht${mine}`)
  const free = roomsFree(rooms)
  return fit(`Oben gibt es ${rooms.capacity} Gästezimmer, davon ${free === 0 ? 'keins' : free === rooms.capacity ? 'alle' : String(free)} frei; gebucht wird am Empfang${mine}`)
}

// ── Bedienung am Tisch ──────────────────────────────────────────────────────
// Wer sitzt, wird bedient: Kurz nach dem Hinsetzen kommt jemand vom Personal
// an den Tisch, nimmt die Bestellung auf und geht wieder hinter den Tresen.
// Nur in Lokalen mit Personal – am Automaten und am Empfang nicht.
export const TABLE_SERVICE = { comeAfterS: 12, walkS: 6, stayS: 50 } as const
export type TableServicePhase = 'none' | 'coming' | 'at-table' | 'gone'

export function tableServicePhase(seatedForS: number, kind: VenueKind, service: VenueService): TableServicePhase {
  if (service !== 'staffed' || kind === 'hotel') return 'none'
  const t = seatedForS - TABLE_SERVICE.comeAfterS
  if (t < 0) return 'none'
  if (t < TABLE_SERVICE.walkS) return 'coming'
  if (t < TABLE_SERVICE.walkS + TABLE_SERVICE.stayS) return 'at-table'
  return 'gone'
}

/** Wo das Personal steht, das den Tisch bedient: neben dem Platz des Gastes. */
export function tableServiceSpot(layout: VenueLayout, seat: VenueSpot, phase: TableServicePhase, seatedForS: number, home: VenueSpot): VenueSpot {
  const beside: VenueSpot = { id: 'serving', kind: 'standing', x: seat.x, y: seat.y + 34, roomId: layout.playerRoomId, label: `${seat.label}, um zu bedienen`, posture: 'standing' }
  if (phase === 'at-table') return beside
  if (phase === 'coming') {
    const p = pointAlongPath(venuePath(layout, home, beside), (seatedForS - TABLE_SERVICE.comeAfterS) / TABLE_SERVICE.walkS)
    return { ...beside, x: p.x, y: p.y, label: 'auf dem Weg zum Tisch' }
  }
  return home
}

// ── Wo steht der Spieler? ───────────────────────────────────────────────────
/** Ortsangabe für den Spieler, wie sie jemand im Raum beschreiben würde. */
export function describePlayerPosition(layout: VenueLayout, pos: VenuePoint): string {
  const distance = (p: VenuePoint) => Math.hypot(p.x - pos.x, p.y - pos.y)
  if (isAtServicePoint(layout, pos)) return layout.servicePoint.locative
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
  /** Zimmer des Hauses, falls es welche gibt. */
  rooms?: VenueRooms | null
  /** Welche Öffnungszeit für den Spieler gilt (Startcafé: seine Ortszeit). */
  hours?: VenueHours
  /** Steht diese Figur gerade am Tisch des Spielers, um zu bedienen? */
  servingPlayer?: boolean
  /** Sitzt der Spieler? Dann sein Platz. */
  playerSeat?: VenueSpot | null
  /** Hat sich diese Figur eben zum Spieler gesetzt? */
  joinedPlayer?: boolean
  /** Kommen in diesem Lokal neue Spieler an? Dann kennt das Personal den Einstieg. */
  arrivalPoint: boolean
  /** Die Karte des Lokals. Leer oder weggelassen: hier wird nichts verkauft. */
  menu?: readonly VenueMenuItem[]
  /** Was der Spieler bei diesem Besuch bestellt hat – jeder im Raum hat es gesehen. */
  playerOrders?: readonly string[]
  /** Was der Spieler bei diesem Besuch genau dieser Figur ausgegeben hat. */
  giftsToSelf?: readonly string[]
  /** Was die Figur bei diesem Besuch selbst gekauft hat. */
  ownOrder?: string | null
  /** Koloniestunde – eine Uhr hängt in jedem Lokal. */
  hour?: number | null
  /** Obergeschoss, falls das Gebäude eines hat. */
  upper?: VenueUpperFloor | null
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

function countedList(labels: readonly string[]): string {
  const counts = new Map<string, number>()
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1)
  return [...counts].map(([label, count]) => (count > 1 ? `${count}× ${label}` : label)).join(', ')
}

/** Ein Satz für beides, damit die Faktenliste des Personals in der Grenze bleibt. */
function ordersFact(orders: readonly string[], gifts: readonly string[]): string {
  if (gifts.length === 0) return 'Dein Gegenüber hat hier eben bestellt: ' + countedList(orders)
  const treat = `Dein Gegenüber hat dir eben ausgegeben: ${countedList(gifts)}; es steht vor dir`
  return orders.length ? `${treat}. Für sich selbst bestellt: ${countedList(orders)}` : treat
}

/**
 * Verifizierte lokale Fakten für die Gesprächspipeline – aus Sicht der Figur.
 * Die Liste bleibt innerhalb der Grenzen von /api/game/npc-conversation
 * (höchstens 16 Fakten mit je 140 Zeichen), damit nichts abgeschnitten wird.
 */
export function venueConversationFacts(input: ConversationFactsInput): string[] {
  const { layout, self } = input
  const staff = self.roomRole === 'staff'
  const name = String(input.buildingName ?? '').replace(/\s+/g, ' ').trim().slice(0, input.hour == null ? 60 : 44)
  const clock = input.hour == null ? '' : `; es ist etwa ${hourOfDay(input.hour)} Uhr, geöffnet ist ${venueHoursText(layout.kind, input.hours ?? venueHoursFor(layout.kind))}`
  const seesGuestRoom = canSeeRoom(layout, self.spot.roomId, layout.playerRoomId)
  const posture = self.spot.posture === 'sitting' ? 'sitzt' : 'stehst'

  const facts: string[] = [
    (name ? `Ihr befindet euch ${layout.locative} ${name}` : `Ihr befindet euch ${layout.locative}`) + clock,
  ]
  if (seesGuestRoom) facts.push(layout.roomFact)

  if (staff) facts.push(`Du arbeitest hier und ${posture} ${self.spot.label}`)
  else if (self.roomRole === 'companion') facts.push(`Du bist mit deinem Gegenüber hergekommen und ${posture} ${self.spot.label}`)
  else facts.push(`Du bist als Gast hier und ${posture} ${self.spot.label}`)

  if (seesGuestRoom) {
    const seat = input.playerSeat
    if (seat) {
      const together = self.spot.label === seat.label && self.spot.posture === 'sitting'
      facts.push(fit(`Dein Gegenüber sitzt ${seat.label}` + (input.servingPlayer ? '; du bist an den Tisch gekommen und nimmst die Bestellung auf' : together ? (input.joinedPlayer ? '; du hast dich eben dazugesetzt, ihr sitzt zusammen' : '; ihr sitzt zusammen') : '')))
    } else facts.push(`Dein Gegenüber steht gerade ${describePlayerPosition(layout, input.playerPos)}`)
    facts.push(othersFact(layout, self, input.figures))
  }
  // Mit Obergeschoss tritt die Treppe an die Stelle des Personalbereichs – die
  // Liste bleibt gleich lang und damit in der Grenze der Gesprächsroute.
  facts.push(input.rooms && input.rooms.capacity > 0 && seesGuestRoom ? roomsFact(input.rooms, staff) : hasUpperFloor(input.upper) && seesGuestRoom ? upperFloorFact(input.upper, staff) : staff ? layout.staffBackFact : layout.guestBackFact)

  // Das Personal kennt die Karte. Ein Gast weiß nur, wo bestellt wird. Preise
  // nennt niemand aus dem Kopf, der sie nicht kennt, und niemand kassiert im
  // Gespräch: gebucht wird ausschließlich am Tresen, Empfang oder Automaten.
  const menu = input.menu ?? []
  if (input.ownOrder) facts.push(`Du hast hier vor kurzem selbst bestellt und bezahlt: ${input.ownOrder}`)
  if (input.ownOrder && menu.length === 0) {
    // Wer selbst gekauft hat, weiß, dass hier verkauft wird.
  } else if (menu.length === 0) {
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
  const gifts = input.giftsToSelf ?? []
  if (gifts.length || (seesGuestRoom && input.playerOrders?.length)) facts.push(ordersFact(seesGuestRoom ? input.playerOrders ?? [] : [], gifts))

  facts.push('Über Kontostand, Wissen, Beruf oder Vorhaben deines Gegenübers weißt du nur, was es dir selbst erzählt')

  if (staff && input.arrivalPoint) facts.push(...ARRIVAL_ORIENTATION_FACTS)

  return facts.slice(0, MAX_CONVERSATION_FACTS).map(fit)
}
