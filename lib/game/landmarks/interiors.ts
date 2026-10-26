// lib/game/landmarks/interiors.ts
// Aktualisiert: 26.10.2026 — Bibliothek als bewohnter Ort: Zonen (Teppich, Fliesen), Deko (Pflanzen, Sessel, Globus), Lampen, Ausleihtresen am Eingang, Bibliothekarin als Ansprechperson
// Version:      1.2.0

export type LandmarkRoomKind = 'library' | 'worship'
export type LandmarkPoint = { x: number; y: number }
export type LandmarkFurnitureKind = 'shelf' | 'shelf-low' | 'table' | 'desk' | 'pew' | 'altar' | 'font' | 'candles' | 'lectern' | 'armchair' | 'sofa' | 'plant' | 'globe' | 'pinboard' | 'counter'
export type LandmarkFurniture = { id: string; kind: LandmarkFurnitureKind; x: number; y: number; w: number; h: number }
export type LandmarkSpot = { id: string; label: string; x: number; y: number; text: string; action?: 'books' | 'learn' | 'candle' | 'sit' | 'staff' }
/** Bodenzone – rein optisch, blockiert nicht. */
export type LandmarkZone = { id: string; kind: 'carpet' | 'tiles' | 'rug' | 'chancel'; x: number; y: number; w: number; h: number }
/** Deckenlampe: heller Lichtkegel auf dem Boden. */
export type LandmarkLamp = { x: number; y: number; r: number; warm?: boolean }
/** Angestellte Person im Raum – steht an einem festen Platz und ist ansprechbar. */
export type LandmarkStaff = { id: string; role: string; x: number; y: number; greeting: string }
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
      { id: 'shelves', label: 'REGALE', x: 195, y: 108, action: 'books', text: 'Romane, Erzählungen und Sachbücher. Zieh einen Band heraus, um Titel und Klappentext zu lesen.' },
      { id: 'low', label: 'NEUZUGÄNGE', x: 150, y: 330, action: 'books', text: 'Ein niedriges Regal mit den Neuzugängen, daneben ein kleiner Teppich zum Stöbern.' },
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

/** Landmark classes that have a walkable interior; all others show the place card. */
export function landmarkRoomKind(landmarkClass: string): LandmarkRoomKind | null {
  if (landmarkClass === 'library') return 'library'
  if (landmarkClass === 'place_of_worship') return 'worship'
  return null
}

export function landmarkRoomLayout(kind: LandmarkRoomKind): LandmarkRoomLayout {
  return kind === 'library' ? libraryLayout() : worshipLayout()
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
