// lib/game/landmarks/interiors.ts
// Aktualisiert: 12.10.2026 — Regale führen zum Bücherbestand, die Ausleihe zu den Lernmodulen; Begehbare Innenräume für reale Landmarks: Bibliothek und Gotteshaus
// Version:      1.1.0

export type LandmarkRoomKind = 'library' | 'worship'
export type LandmarkPoint = { x: number; y: number }
export type LandmarkFurnitureKind = 'shelf' | 'table' | 'desk' | 'pew' | 'altar' | 'font' | 'candles' | 'lectern'
export type LandmarkFurniture = { id: string; kind: LandmarkFurnitureKind; x: number; y: number; w: number; h: number }
export type LandmarkSpot = { id: string; label: string; x: number; y: number; text: string; action?: 'books' | 'learn' | 'candle' | 'sit' }
export type LandmarkRoomLayout = {
  kind: LandmarkRoomKind
  noun: string
  start: LandmarkPoint
  exit: LandmarkPoint
  furniture: LandmarkFurniture[]
  spots: LandmarkSpot[]
}

export const LANDMARK_ROOM = { width: 760, height: 480, left: 24, right: 736, top: 28, bottom: 456 }
export const LANDMARK_PLAYER_RADIUS = 9
export const LANDMARK_SPOT_REACH = 58

function libraryLayout(): LandmarkRoomLayout {
  const furniture: LandmarkFurniture[] = []
  // Wall shelves along the back, free-standing rows on the left, reading tables on the right.
  for (let i = 0; i < 6; i++) furniture.push({ id: `wall-shelf-${i}`, kind: 'shelf', x: 60 + i * 108, y: 34, w: 92, h: 22 })
  for (let row = 0; row < 3; row++) furniture.push({ id: `row-shelf-${row}`, kind: 'shelf', x: 70, y: 120 + row * 78, w: 250, h: 24 })
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) furniture.push({ id: `table-${i}-${j}`, kind: 'table', x: 430 + i * 150, y: 130 + j * 120, w: 96, h: 52 })
  furniture.push({ id: 'desk', kind: 'desk', x: 420, y: 370, w: 150, h: 34 })
  return {
    kind: 'library',
    noun: 'Bibliothek',
    start: { x: 380, y: 430 },
    exit: { x: 380, y: 452 },
    furniture,
    spots: [
      { id: 'shelves', label: 'REGALE', x: 195, y: 108, action: 'books', text: 'Romane, Erzählungen und Sachbücher. Zieh einen Band heraus, um Titel und Klappentext zu lesen.' },
      { id: 'reading', label: 'LESETISCH', x: 478, y: 200, action: 'sit', text: 'Ein ruhiger Platz mit Leselampe. Niemand drängt dich weiter.' },
      { id: 'desk', label: 'AUSLEIHE', x: 495, y: 420, action: 'learn', text: 'Die Ausleihe ist unbesetzt. Ein Aushang verweist auf die Lernmodule der Solar Science Foundation.' },
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
  return {
    kind: 'worship',
    noun: 'Gotteshaus',
    start: { x: 380, y: 432 },
    exit: { x: 380, y: 452 },
    furniture,
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
