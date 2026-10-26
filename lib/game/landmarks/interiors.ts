// lib/game/landmarks/interiors.ts
// Aktualisiert: 26.10.2026 — Räume für Betriebe: Laden (Tresen, Regale, Auslage) und Werkstatt (Hebebühne, Werkbank, Tor); Wegsuche um die Möbel herum (landmarkPath) für Spieler und Personal, Ziele im Raum (landmarkWaypoints); jedes Regal ist stöberbar (hohe Regale: Romane, niedrige: Sachbücher); Bibliothek als bewohnter Ort: Zonen (Teppich, Fliesen), Deko (Pflanzen, Sessel, Globus), Lampen, Ausleihtresen am Eingang, Bibliothekarin als Ansprechperson
// Version:      1.5.0

export type LandmarkRoomKind = 'library' | 'worship' | 'shop' | 'workshop'
export type LandmarkPoint = { x: number; y: number }
export type LandmarkFurnitureKind = 'shelf' | 'shelf-low' | 'table' | 'desk' | 'pew' | 'altar' | 'font' | 'candles' | 'lectern' | 'armchair' | 'sofa' | 'plant' | 'globe' | 'pinboard' | 'counter' | 'goods' | 'lift' | 'bench' | 'vehicle' | 'gate' | 'crate'
export type LandmarkFurniture = { id: string; kind: LandmarkFurnitureKind; x: number; y: number; w: number; h: number }
export type LandmarkSpot = { id: string; label: string; x: number; y: number; text: string; action?: 'books' | 'learn' | 'candle' | 'sit' | 'staff' }
/** Bodenzone – rein optisch, blockiert nicht. */
export type LandmarkZone = { id: string; kind: LandmarkZoneKind; x: number; y: number; w: number; h: number }
/** Deckenlampe: heller Lichtkegel auf dem Boden. */
export type LandmarkLamp = { x: number; y: number; r: number; warm?: boolean }
/** Angestellte Person im Raum – steht an einem festen Platz und ist ansprechbar. */
export type LandmarkStaff = { id: string; role: string; x: number; y: number; greeting: string }
export type LandmarkZoneKind = 'carpet' | 'tiles' | 'rug' | 'chancel' | 'concrete' | 'oilstain'
export type LandmarkRoomLayout = {
  kind: LandmarkRoomKind
  noun: string
  start: LandmarkPoint
  exit: LandmarkPoint
  furniture: LandmarkFurniture[]
  spots: LandmarkSpot[]
  zones: LandmarkZone[]
  lamps: LandmarkLamp[]
  staff: LandmarkStaff | null
}

export const LANDMARK_ROOM = { width: 760, height: 480, left: 24, right: 736, top: 28, bottom: 456 }
export const LANDMARK_PLAYER_RADIUS = 9
export const LANDMARK_SPOT_REACH = 58

function libraryLayout(): LandmarkRoomLayout {
  const furniture: LandmarkFurniture[] = []
  // Rückwand: hohe Regale, in der Mitte eine Lücke mit Pinnwand.
  for (let i = 0; i < 6; i++) if (i !== 3) furniture.push({ id: `wall-shelf-${i}`, kind: 'shelf', x: 60 + i * 108, y: 34, w: 92, h: 22 })
  furniture.push({ id: 'pinboard', kind: 'pinboard', x: 392, y: 34, w: 80, h: 10 })
  // Links: zwei hohe Reihen und ein L-förmiges niedriges Regal.
  furniture.push({ id: 'row-shelf-0', kind: 'shelf', x: 70, y: 120, w: 250, h: 24 })
  furniture.push({ id: 'row-shelf-1', kind: 'shelf', x: 70, y: 198, w: 250, h: 24 })
  furniture.push({ id: 'low-shelf-a', kind: 'shelf-low', x: 70, y: 276, w: 170, h: 22 })
  furniture.push({ id: 'low-shelf-b', kind: 'shelf-low', x: 218, y: 276, w: 22, h: 90 })
  // Rechts: Lesebereich mit zwei Tischen, Sesseln und Sofa auf rotem Teppich.
  furniture.push({ id: 'table-0', kind: 'table', x: 440, y: 120, w: 96, h: 52 })
  furniture.push({ id: 'table-1', kind: 'table', x: 590, y: 120, w: 96, h: 52 })
  furniture.push({ id: 'armchair-0', kind: 'armchair', x: 452, y: 236, w: 34, h: 34 })
  furniture.push({ id: 'armchair-1', kind: 'armchair', x: 520, y: 236, w: 34, h: 34 })
  furniture.push({ id: 'sofa', kind: 'sofa', x: 596, y: 232, w: 100, h: 36 })
  furniture.push({ id: 'globe', kind: 'globe', x: 688, y: 300, w: 26, h: 26 })
  // Eingang: Fliesen, Ausleihtresen rechts der Tür, Pflanzen in den Ecken.
  furniture.push({ id: 'counter', kind: 'counter', x: 470, y: 392, w: 150, h: 30 })
  furniture.push({ id: 'plant-0', kind: 'plant', x: 36, y: 410, w: 26, h: 26 })
  furniture.push({ id: 'plant-1', kind: 'plant', x: 700, y: 60, w: 26, h: 26 })
  furniture.push({ id: 'plant-2', kind: 'plant', x: 336, y: 120, w: 24, h: 24 })
  furniture.push({ id: 'plant-3', kind: 'plant', x: 700, y: 410, w: 26, h: 26 })
  return {
    kind: 'library',
    noun: 'Bibliothek',
    start: { x: 380, y: 430 },
    exit: { x: 380, y: 452 },
    furniture,
    zones: [
      { id: 'entry', kind: 'tiles', x: 24, y: 376, w: 712, h: 80 },
      { id: 'reading', kind: 'carpet', x: 420, y: 100, w: 300, h: 190 },
      { id: 'rug', kind: 'rug', x: 86, y: 310, w: 120, h: 50 },
    ],
    lamps: [{ x: 488, y: 146, r: 70, warm: true }, { x: 638, y: 146, r: 70, warm: true }, { x: 545, y: 255, r: 80, warm: true }, { x: 195, y: 160, r: 90 }, { x: 195, y: 240, r: 90 }, { x: 380, y: 400, r: 90 }],
    staff: { id: 'librarian', role: 'Bibliothekar(in)', x: 545, y: 378, greeting: 'Guten Tag. Suchst du etwas Bestimmtes, oder soll ich dir etwas empfehlen?' },
    spots: [
      { id: 'reading', label: 'LESETISCH', x: 488, y: 196, action: 'sit', text: 'Ein ruhiger Platz unter der Leselampe. Niemand drängt dich weiter.' },
      { id: 'lounge', label: 'LESEECKE', x: 560, y: 290, action: 'sit', text: 'Zwei Sessel und ein Sofa auf dem roten Teppich – der bequemste Platz im Haus.' },
      { id: 'globe', label: 'GLOBUS', x: 660, y: 330, text: 'Ein alter Globus. Das Sauerland ist auf ihm nicht einmal ein Punkt.' },
      { id: 'pinboard', label: 'PINNWAND', x: 432, y: 76, text: 'Aushänge: Vorlesestunde, Lesekreis, Öffnungszeiten – und ein Zettel der Solar Science Foundation.', action: 'learn' },
      { id: 'desk', label: 'AUSLEIHE', x: 545, y: 440, action: 'staff', text: 'Der Ausleihtresen am Eingang. Hier arbeitet jemand, der die Bestände kennt.' },
    ],
  }
}

function worshipLayout(): LandmarkRoomLayout {
  const furniture: LandmarkFurniture[] = []
  // Two blocks of pews with a centre aisle, the chancel at the far end.
  for (let row = 0; row < 6; row++) {
    furniture.push({ id: `pew-l-${row}`, kind: 'pew', x: 150, y: 170 + row * 42, w: 190, h: 16 })
    furniture.push({ id: `pew-r-${row}`, kind: 'pew', x: 420, y: 170 + row * 42, w: 190, h: 16 })
  }
  furniture.push({ id: 'altar', kind: 'altar', x: 320, y: 50, w: 120, h: 34 })
  furniture.push({ id: 'lectern', kind: 'lectern', x: 480, y: 100, w: 24, h: 22 })
  furniture.push({ id: 'font', kind: 'font', x: 80, y: 380, w: 30, h: 30 })
  furniture.push({ id: 'candles', kind: 'candles', x: 650, y: 96, w: 40, h: 22 })
  furniture.push({ id: 'plant-0', kind: 'plant', x: 280, y: 60, w: 22, h: 22 })
  furniture.push({ id: 'plant-1', kind: 'plant', x: 458, y: 60, w: 22, h: 22 })
  return {
    kind: 'worship',
    noun: 'Gotteshaus',
    start: { x: 380, y: 432 },
    exit: { x: 380, y: 452 },
    furniture,
    zones: [
      { id: 'chancel', kind: 'chancel', x: 24, y: 28, w: 712, h: 110 },
      { id: 'aisle', kind: 'rug', x: 350, y: 140, w: 60, h: 300 },
    ],
    lamps: [{ x: 380, y: 90, r: 110, warm: true }, { x: 240, y: 260, r: 120 }, { x: 520, y: 260, r: 120 }, { x: 668, y: 118, r: 50, warm: true }],
    staff: null,
    spots: [
      { id: 'chancel', label: 'ALTARRAUM', x: 380, y: 112, text: 'Der Altarraum liegt etwas erhöht. Von hier überblickt man das ganze Schiff.' },
      { id: 'candles', label: 'KERZEN', x: 668, y: 142, action: 'candle', text: 'Ein Ständer mit kleinen Kerzen. Einige brennen bereits.' },
      { id: 'pew', label: 'BANK', x: 380, y: 300, action: 'sit', text: 'Im Mittelgang zwischen den Bänken ist es still.' },
      { id: 'font', label: 'BECKEN', x: 126, y: 420, text: 'Ein steinernes Becken nahe dem Eingang.' },
    ],
  }
}

function shopLayout(): LandmarkRoomLayout {
  const furniture: LandmarkFurniture[] = []
  for (let i = 0; i < 5; i++) furniture.push({ id: `wall-goods-${i}`, kind: 'goods', x: 60 + i * 130, y: 34, w: 100, h: 22 })
  for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) furniture.push({ id: `gondola-${row}-${col}`, kind: 'goods', x: 110 + col * 260, y: 130 + row * 100, w: 200, h: 24 })
  furniture.push({ id: 'counter', kind: 'counter', x: 470, y: 392, w: 170, h: 30 })
  furniture.push({ id: 'plant-0', kind: 'plant', x: 36, y: 410, w: 26, h: 26 })
  furniture.push({ id: 'plant-1', kind: 'plant', x: 700, y: 410, w: 26, h: 26 })
  furniture.push({ id: 'crate-0', kind: 'crate', x: 60, y: 330, w: 36, h: 30 })
  return {
    kind: 'shop', noun: 'Laden', start: { x: 380, y: 430 }, exit: { x: 380, y: 452 }, furniture,
    zones: [{ id: 'entry', kind: 'tiles', x: 24, y: 376, w: 712, h: 80 }, { id: 'floor', kind: 'tiles', x: 24, y: 28, w: 712, h: 348 }],
    lamps: [{ x: 210, y: 100, r: 110 }, { x: 550, y: 100, r: 110 }, { x: 210, y: 260, r: 110 }, { x: 550, y: 260, r: 110 }, { x: 555, y: 400, r: 90, warm: true }],
    staff: { id: 'clerk', role: 'Verkäufer(in)', x: 555, y: 378, greeting: 'Hallo! Kann ich helfen, oder schaust du dich erst um?' },
    spots: [
      { id: 'display', label: 'AUSLAGE', x: 210, y: 92, text: 'Die Auslage an der Rückwand. Vieles davon kann man im Spiel noch nicht kaufen – fragen kostet nichts.' },
      { id: 'aisle', label: 'REGALGANG', x: 380, y: 170, text: 'Regale mit Waren auf beiden Seiten.' },
      { id: 'desk', label: 'KASSE', x: 555, y: 440, action: 'staff', text: 'Die Kasse. Hier steht jemand, der den Betrieb kennt.' },
    ],
  }
}

function workshopLayout(): LandmarkRoomLayout {
  const furniture: LandmarkFurniture[] = []
  furniture.push({ id: 'gate', kind: 'gate', x: 24, y: 28, w: 240, h: 12 })
  furniture.push({ id: 'lift-0', kind: 'lift', x: 70, y: 100, w: 150, h: 70 })
  furniture.push({ id: 'vehicle-0', kind: 'vehicle', x: 86, y: 112, w: 118, h: 46 })
  furniture.push({ id: 'lift-1', kind: 'lift', x: 70, y: 230, w: 150, h: 70 })
  for (let i = 0; i < 3; i++) furniture.push({ id: `bench-${i}`, kind: 'bench', x: 420 + i * 100, y: 34, w: 84, h: 26 })
  furniture.push({ id: 'shelf-parts', kind: 'goods', x: 640, y: 120, w: 24, h: 160 })
  furniture.push({ id: 'crate-0', kind: 'crate', x: 300, y: 300, w: 40, h: 32 })
  furniture.push({ id: 'crate-1', kind: 'crate', x: 346, y: 310, w: 32, h: 28 })
  furniture.push({ id: 'counter', kind: 'counter', x: 470, y: 392, w: 170, h: 30 })
  return {
    kind: 'workshop', noun: 'Werkstatt', start: { x: 380, y: 430 }, exit: { x: 380, y: 452 }, furniture,
    zones: [{ id: 'floor', kind: 'concrete', x: 24, y: 28, w: 712, h: 428 }, { id: 'stain-0', kind: 'oilstain', x: 250, y: 140, w: 60, h: 40 }, { id: 'stain-1', kind: 'oilstain', x: 150, y: 330, w: 50, h: 34 }, { id: 'entry', kind: 'tiles', x: 420, y: 376, w: 316, h: 80 }],
    lamps: [{ x: 145, y: 135, r: 120 }, { x: 145, y: 265, r: 120 }, { x: 520, y: 80, r: 110 }, { x: 555, y: 400, r: 90, warm: true }],
    staff: { id: 'master', role: 'Meister(in)', x: 555, y: 378, greeting: 'Moment, Hände abwischen. So – was kann ich für dich tun?' },
    spots: [
      { id: 'lift', label: 'HEBEBÜHNE', x: 145, y: 195, text: 'Eine Hebebühne mit einem Fahrzeug darauf. Darunter riecht es nach Öl.' },
      { id: 'bench', label: 'WERKBANK', x: 520, y: 92, text: 'Werkbänke mit Werkzeug, sauber aufgereiht.' },
      { id: 'parts', label: 'ERSATZTEILE', x: 610, y: 200, text: 'Ein Regal mit Ersatzteilen, nach Nummern sortiert.' },
      { id: 'desk', label: 'ANNAHME', x: 555, y: 440, action: 'staff', text: 'Die Annahme. Hier steht jemand, der den Betrieb kennt.' },
    ],
  }
}

/** Landmark classes that have a walkable interior; all others show the place card. */
export function landmarkRoomKind(landmarkClass: string): LandmarkRoomKind | null {
  if (landmarkClass === 'library') return 'library'
  if (landmarkClass === 'place_of_worship') return 'worship'
  return null
}

export function landmarkRoomLayout(kind: LandmarkRoomKind): LandmarkRoomLayout {
  return kind === 'library' ? libraryLayout() : kind === 'worship' ? worshipLayout() : kind === 'shop' ? shopLayout() : workshopLayout()
}

export function isLandmarkRoomBlocked(layout: LandmarkRoomLayout, p: LandmarkPoint, radius = LANDMARK_PLAYER_RADIUS) {
  if (p.x < LANDMARK_ROOM.left || p.x > LANDMARK_ROOM.right || p.y < LANDMARK_ROOM.top || p.y > LANDMARK_ROOM.bottom) return true
  return layout.furniture.some(item =>
    p.x + radius > item.x && p.x - radius < item.x + item.w
    && p.y + radius > item.y && p.y - radius < item.y + item.h)
}

export function nearestLandmarkSpot(layout: LandmarkRoomLayout, p: LandmarkPoint) {
  let best: LandmarkSpot | null = null
  let bestDistance = LANDMARK_SPOT_REACH
  for (const spot of layout.spots) {
    const d = Math.hypot(spot.x - p.x, spot.y - p.y)
    if (d <= bestDistance) { best = spot; bestDistance = d }
  }
  return best
}

const STAFF_NAMES = ['Hanna Vogt', 'Jonas Weber', 'Mira Brandt', 'Elias Roth', 'Lene Hartmann', 'Tobias Krüger', 'Sarah Nolte', 'David Lenz']

/** Stable name of the staff person for one landmark: same house, same person on every visit. */
export function landmarkStaffName(landmarkName: string) {
  let h = 2166136261
  for (let i = 0; i < landmarkName.length; i++) { h ^= landmarkName.charCodeAt(i); h = Math.imul(h, 16777619) }
  return STAFF_NAMES[(h >>> 0) % STAFF_NAMES.length]
}

/** Regal, vor dem die Figur steht (Abstand zur Kante), und was darin steht. */
export function shelfAt(layout: LandmarkRoomLayout, p: LandmarkPoint, reach = 26) {
  let best: { item: LandmarkFurniture; shelf: 'romane' | 'sachbuecher'; distance: number } | null = null
  for (const item of layout.furniture) {
    if (item.kind !== 'shelf' && item.kind !== 'shelf-low') continue
    const dx = Math.max(item.x - p.x, 0, p.x - (item.x + item.w))
    const dy = Math.max(item.y - p.y, 0, p.y - (item.y + item.h))
    const distance = Math.hypot(dx, dy)
    if (distance <= reach && (!best || distance < best.distance)) best = { item, shelf: item.kind === 'shelf-low' ? 'sachbuecher' : 'romane', distance }
  }
  return best
}

const PATH_STEP = 8
const PATH_RADIUS = 7

/** Weg von `from` nach `to` um die Möbel herum, als Liste von Punkten (Breitensuche auf einem 8-px-Raster). */
export function landmarkPath(layout: LandmarkRoomLayout, from: LandmarkPoint, to: LandmarkPoint): LandmarkPoint[] {
  const free = (p: LandmarkPoint) => !isLandmarkRoomBlocked(layout, p, PATH_RADIUS)
  const snap = (p: LandmarkPoint): LandmarkPoint | null => {
    const base = { x: Math.round(p.x / PATH_STEP) * PATH_STEP, y: Math.round(p.y / PATH_STEP) * PATH_STEP }
    let best: LandmarkPoint | null = null, bestD = Infinity
    for (let dx = -6; dx <= 6; dx++) for (let dy = -6; dy <= 6; dy++) {
      const c = { x: base.x + dx * PATH_STEP, y: base.y + dy * PATH_STEP }
      const d = Math.hypot(c.x - p.x, c.y - p.y)
      if (d < bestD && free(c)) { best = c; bestD = d }
    }
    return best
  }
  const start = snap(from), goal = snap(to)
  if (!start || !goal) return [from, to]
  const key = (p: LandmarkPoint) => p.x + ':' + p.y
  const previous = new Map<string, LandmarkPoint | null>([[key(start), null]])
  const queue: LandmarkPoint[] = [start]
  while (queue.length) {
    const p = queue.shift() as LandmarkPoint
    if (p.x === goal.x && p.y === goal.y) break
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const next = { x: p.x + dx * PATH_STEP, y: p.y + dy * PATH_STEP }
      if (previous.has(key(next)) || !free(next)) continue
      if (dx && dy && (!free({ x: p.x + dx * PATH_STEP, y: p.y }) || !free({ x: p.x, y: p.y + dy * PATH_STEP }))) continue
      previous.set(key(next), p)
      queue.push(next)
    }
  }
  if (!previous.has(key(goal))) return [from, to]
  const cells: LandmarkPoint[] = []
  for (let p: LandmarkPoint | null = goal; p; p = previous.get(key(p)) ?? null) cells.unshift(p)
  return [from, ...cells, to]
}

export type LandmarkWaypoint = { id: string; label: string; x: number; y: number; kind: string }

/** Ziele im Raum für „Gehe zu …“ und für das Personal: alle Bereiche, der Tresen, die Regale, der Ausgang. */
export function landmarkWaypoints(layout: LandmarkRoomLayout): LandmarkWaypoint[] {
  const out: LandmarkWaypoint[] = layout.spots.map(spot => ({ id: `spot:${spot.id}`, label: spot.label.charAt(0) + spot.label.slice(1).toLowerCase(), x: spot.x, y: spot.y, kind: spot.action === 'sit' ? 'Sitzplatz' : spot.action === 'staff' ? 'Tresen' : 'Bereich' }))
  const shelves = layout.furniture.filter(item => item.kind === 'shelf' || item.kind === 'shelf-low')
  if (shelves.length) {
    const first = shelves.find(item => item.kind === 'shelf') ?? shelves[0]
    out.push({ id: 'shelf:romane', label: 'Regale (Romane)', x: first.x + Math.min(60, first.w / 2), y: first.y + first.h + 18, kind: 'Regal' })
    const low = shelves.find(item => item.kind === 'shelf-low')
    if (low) out.push({ id: 'shelf:sachbuecher', label: 'Regal (Sachbücher)', x: low.x + Math.min(60, low.w / 2), y: low.y + low.h + 18, kind: 'Regal' })
  }
  out.push({ id: 'exit', label: 'Ausgang', x: layout.exit.x, y: layout.exit.y - 14, kind: 'Ausgang' })
  return out.filter(point => !isLandmarkRoomBlocked(layout, point))
}
