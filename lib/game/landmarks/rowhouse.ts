// lib/game/landmarks/rowhouse.ts
// Erstellt: 06.11.2026 – Reihenhausserie Krokusweg 2–14, Friedrichsdorf (Bauvorhaben Schäferborn, 1979).
// Version:  1.0.0
//
// Vier Geschosse nach den Bauplänen (gerundet): Keller mit Tür zur Tiefgarage, EG mit Küche
// vorn und Wohnraum hinten, 1. OG (kragt vorn 1,20 m vor, auf zwei Betonpfeilern; darunter eine
// Terrasse vor der Küche), Dachgeschoss mit Dachterrasse über Kind 1. Krokusweg 10 ist die WG
// aus dem Roman „Der Duft der bleibt“ (docs/world/earth/friedrichsdorf-krokusweg-10-duft.md),
// die übrigen Häuser der Reihe sind Familienhäuser mit demselben Grundriss.
//
// Längsachse des Hauses = x (links vorn/Wohnweg, rechts Garten), Querachse = y (oben die
// Haustrennwand mit der Treppe). Maße in Metern, umgerechnet in Raumpunkte (46 px je Meter).

import type { LandmarkFurniture, LandmarkFurnitureKind, LandmarkLamp, LandmarkPoint, LandmarkRoomLayout, LandmarkSpot, LandmarkZone, LandmarkZoneKind } from './interiors'

export type RowhouseVariant = 'rowhouse' | 'rowhouse_wg'

/** Geschosse: 0 EG, 1 erstes OG, 2 Dachgeschoss, 3 Keller. */
export const ROWHOUSE_LEVELS = 4
const FLOOR_NAMES = ['Erdgeschoss', '1. Obergeschoss', 'Dachgeschoss', 'Keller'] as const

const PX = 46
const X = (m: number) => Math.round(24 + (m + 1.3) * PX)
const Y = (m: number) => Math.round(120 + m * PX)
const W = 5.3
const WALL = 6

/** Mitte der Reihe (Krokusweg 10), aus der Karte; Häuser der Serie liegen im Umkreis. */
const SERIES_CENTER = { lat: 50.25583, lon: 8.64940 }
const SERIES_RADIUS_M = 350
const SERIES_NUMBERS = new Set(['2', '4', '6', '8', '10', '12', '14'])

/**
 * Gehört ein Haus der Weltkarte zur Reihenhausserie Krokusweg in Friedrichsdorf?
 * Anschrift aus OSM („Krokusweg 10“) plus Lage, weil es Krokuswege auch anderswo gibt.
 */
export function rowhouseVariantFor(address?: string | null, at?: { lat: number; lon: number } | null): RowhouseVariant | null {
  const match = String(address ?? '').trim().match(/^Krokusweg\s+(\d+)\s*$/i)
  if (!match || !SERIES_NUMBERS.has(match[1]) || !at) return null
  const dLat = (at.lat - SERIES_CENTER.lat) * 111_320
  const dLon = (at.lon - SERIES_CENTER.lon) * 111_320 * Math.cos(SERIES_CENTER.lat * Math.PI / 180)
  if (Math.hypot(dLat, dLon) > SERIES_RADIUS_M) return null
  return match[1] === '10' ? 'rowhouse_wg' : 'rowhouse'
}

type Builder = {
  furniture: LandmarkFurniture[]
  zones: LandmarkZone[]
  spots: LandmarkSpot[]
  lamps: LandmarkLamp[]
  item: (id: string, kind: LandmarkFurnitureKind, x0: number, y0: number, x1: number, y1: number) => void
  zone: (id: string, kind: LandmarkZoneKind, x0: number, y0: number, x1: number, y1: number) => void
  /** Wand quer (konstantes y) mit Türöffnungen [von, bis] in Metern. */
  wallX: (id: string, y: number, x0: number, x1: number, doors?: [number, number][]) => void
  /** Wand längs (konstantes x) mit Türöffnungen. */
  wallY: (id: string, x: number, y0: number, y1: number, doors?: [number, number][]) => void
  spot: (id: string, label: string, x: number, y: number, text: string, extra?: Partial<LandmarkSpot>) => void
  lamp: (x: number, y: number, r?: number, warm?: boolean) => void
}

function builder(): Builder {
  const furniture: LandmarkFurniture[] = []
  const zones: LandmarkZone[] = []
  const spots: LandmarkSpot[] = []
  const lamps: LandmarkLamp[] = []
  const segments = (a: number, b: number, doors: [number, number][]) => {
    const out: [number, number][] = []
    let from = a
    for (const [d0, d1] of [...doors].sort((p, q) => p[0] - q[0])) {
      if (d0 > from) out.push([from, d0])
      from = Math.max(from, d1)
    }
    if (b > from) out.push([from, b])
    return out
  }
  return {
    furniture, zones, spots, lamps,
    item: (id, kind, x0, y0, x1, y1) => furniture.push({ id, kind, x: X(x0), y: Y(y0), w: X(x1) - X(x0), h: Y(y1) - Y(y0) }),
    zone: (id, kind, x0, y0, x1, y1) => zones.push({ id, kind, x: X(x0), y: Y(y0), w: X(x1) - X(x0), h: Y(y1) - Y(y0) }),
    wallX: (id, y, x0, x1, doors = []) => segments(x0, x1, doors).forEach(([a, b], i) =>
      furniture.push({ id: `${id}-${i}`, kind: 'wall', x: X(a) - WALL / 2, y: Y(y) - WALL / 2, w: X(b) - X(a) + WALL, h: WALL })),
    wallY: (id, x, y0, y1, doors = []) => segments(y0, y1, doors).forEach(([a, b], i) =>
      furniture.push({ id: `${id}-${i}`, kind: 'wall', x: X(x) - WALL / 2, y: Y(a) - WALL / 2, w: WALL, h: Y(b) - Y(a) + WALL })),
    spot: (id, label, x, y, text, extra = {}) => spots.push({ id, label, x: X(x), y: Y(y), text, ...extra }),
    lamp: (x, y, r = 90, warm = true) => lamps.push({ x: X(x), y: Y(y), r, warm }),
  }
}

/** Haustrennwände zu den Nachbarn: über die ganze Breite des Raums (Hecke, Zaun, Wand). */
function partyWalls(b: Builder) {
  b.furniture.push({ id: 'party-left', kind: 'wall', x: 24, y: Y(0) - WALL / 2, w: 712, h: WALL })
  b.furniture.push({ id: 'party-right', kind: 'wall', x: 24, y: Y(W) - WALL / 2, w: 712, h: WALL })
}

const pt = (x: number, y: number): LandmarkPoint => ({ x: X(x), y: Y(y) })

function groundFloor(b: Builder, wg: boolean, byStairs: boolean): Omit<LandmarkRoomLayout, 'kind' | 'noun'> {
  partyWalls(b)
  // Außen vorn unter dem vorkragenden Obergeschoss: Eingang und Terrasse vor der Küche, zwei Betonpfeiler.
  b.zone('front-entry', 'concrete', -1.3, 0, 0, 2.6)
  b.zone('front-terrace', 'tiles', -1.3, 2.6, 0, W)
  b.item('pillar-a', 'pillar', -1.2, 0.1, -0.9, 0.4)
  b.item('pillar-b', 'pillar', -1.2, 4.9, -0.9, 5.2)
  b.item('front-bench', 'bench', -0.75, 4.2, -0.15, 5.1)
  b.item('front-plant', 'plant', -0.7, 2.8, -0.2, 3.3)
  // Außenwände: vorn mit Haustür, hinten mit Terrassentür.
  b.wallY('front', 0, 0, W, [[1.55, 2.45]])
  b.wallY('back', 11.7, 0, W, [[2.2, 3.2]])
  // WC vorn an der Trennwand.
  b.wallY('wc-a', 0.4, 0, 1.4)
  b.wallY('wc-b', 2.2, 0, 1.4)
  b.wallX('wc-c', 1.4, 0.4, 2.2, [[0.85, 1.6]])
  b.item('wc-toilet', 'toilet', 1.6, 0.15, 2.05, 0.6)
  b.item('wc-sink', 'sink', 0.6, 0.1, 1.05, 0.45)
  // Küche vorn zum Wohnweg, zum Essplatz offen.
  b.wallX('kitchen-a', 2.6, 0, 3.9, [[1.2, 2.0]])
  b.wallY('kitchen-b', 3.9, 2.6, W, [[3.3, 4.5]])
  b.item('kitchen-counter', 'counter', 0.1, 3.0, 0.65, 5.15)
  b.item('kitchen-stove', 'stove', 0.75, 4.6, 1.5, 5.15)
  b.item('kitchen-fridge', 'fridge', 3.2, 4.55, 3.8, 5.2)
  b.item('kitchen-table', 'table', 1.6, 3.2, 2.7, 4.0)
  // Treppe an der Trennwand; vor ihr der Flur.
  b.item('stairs', 'stairs', 3.9, 0.05, 6.2, 1.5)
  // Essplatz und Wohnraum.
  b.item('dining-table', 'table', 4.2, 3.0, 5.5, 4.1)
  b.item('dining-chair-a', 'chair', 4.4, 2.4, 4.85, 2.85)
  b.item('dining-chair-b', 'chair', 4.9, 2.4, 5.35, 2.85)
  b.item('dining-chair-c', 'chair', 4.4, 4.25, 4.85, 4.7)
  b.item('dining-chair-d', 'chair', 4.9, 4.25, 5.35, 4.7)
  b.item('living-sofa', 'sofa', 7.4, 4.4, 9.8, 5.15)
  b.item('living-table', 'table', 7.9, 3.4, 9.3, 4.0)
  b.item('living-armchair', 'armchair', 6.4, 3.2, 7.1, 3.9)
  b.item('living-shelf', 'shelf-low', 8.0, 0.1, 10.6, 0.45)
  b.item('living-plant', 'plant', 11.0, 0.2, 11.5, 0.7)
  // Gartenterrasse und ein Stück Garten.
  b.zone('garden-terrace', 'tiles', 11.7, 0, 13.9, W)
  b.item('terrace-table', 'table', 12.4, 3.4, 13.3, 4.3)
  b.item('terrace-chair-a', 'chair', 12.5, 2.8, 12.95, 3.25)
  b.item('terrace-chair-b', 'chair', 12.5, 4.45, 12.95, 4.9)
  b.zone('hall', 'tiles', 0, 1.4, 3.9, 2.6)
  b.zone('hall-b', 'tiles', 2.2, 0, 3.9, 1.4)
  b.zone('kitchen', 'tiles', 0, 2.6, 3.9, W)
  b.zone('living', 'parquet', 3.9, 0, 11.7, W)
  b.zone('rug', 'rug', 7.2, 3.1, 10.0, 5.2)
  b.lamp(2.0, 3.9); b.lamp(4.85, 3.5, 80); b.lamp(8.6, 3.7, 120); b.lamp(1.8, 2.0, 70, false)

  b.spot('kitchen', 'KÜCHE', 2.2, 4.5, wg
    ? 'Die gemeinsame Küche. Im Kühlschrank hat jedes Fach einen Namen auf Klebeband. Hier riecht es immer nach dem, der zuletzt gekocht hat – Kreuzkümmel, Sesamöl, Bratkartoffeln.'
    : 'Die Küche zum Wohnweg. Durchs Fenster sieht man, wer vorbeigeht.')
  b.spot('dining', 'ESSTISCH', 4.85, 2.25, wg ? 'Der große Tisch, an dem selten alle gleichzeitig sitzen.' : 'Der Esstisch der Familie.', { action: 'sit' })
  b.spot('living', 'WOHNRAUM', 8.6, 2.6, wg
    ? 'Der Wohnraum zum Garten: abends das hellste Zimmer im Haus. Wer hier sitzt, hört oben die Schritte auf der Dachterrasse nicht – aber man sieht, wer auf den Balkon tritt.'
    : 'Der Wohnraum zum Garten, abends voller Sonne.', { action: 'sit' })
  b.spot('terrace', 'GARTENTERRASSE', 12.8, 2.0, wg
    ? 'Die Gartenterrasse. Über dir der Balkon im ersten Stock, darüber die Dachterrasse – das Haus treppt sich zum Garten ab.'
    : 'Die Terrasse zum Garten. Das Nachbarhaus rechts steht hier einen Meter weiter vor.', { action: 'sit' })
  b.spot('front-terrace', 'TERRASSE VORN', -0.55, 3.6, wg
    ? 'Unter dem vorkragenden ersten Stock, zwischen zwei Betonpfeilern: eine kleine Terrasse vor dem Küchenfenster. Vom Spielplatz gegenüber hört man die Kinder.'
    : 'Eine kleine Terrasse vor dem Küchenfenster, überdacht vom ersten Stock, getragen von zwei Betonpfeilern.', { action: 'sit' })
  b.spot('wc', 'WC', 1.3, 1.0, 'Das Gäste-WC neben der Haustür.')
  b.spot('up-1', 'TREPPE HINAUF', 3.4, 0.75, 'Die Treppe führt in den ersten Stock.', { action: 'stairs', toLevel: 1, toName: 'Ins 1. Obergeschoss' })
  b.spot('down-3', 'TREPPE IN DEN KELLER', 6.7, 0.8, 'Unter der Treppe geht es hinunter in den Keller.', { action: 'stairs', toLevel: 3, toName: 'In den Keller' })
  return {
    level: 0, floorName: FLOOR_NAMES[0],
    furniture: b.furniture, zones: b.zones, spots: b.spots, lamps: b.lamps,
    start: byStairs ? pt(3.4, 1.0) : pt(0.6, 2.0),
    exit: pt(-0.6, 2.3),
    staff: null,
    gatherAt: [pt(4.85, 2.25), pt(8.6, 2.6), pt(12.8, 2.0)],
  }
}

function firstFloor(b: Builder, wg: boolean): Omit<LandmarkRoomLayout, 'kind' | 'noun'> {
  partyWalls(b)
  // Vorn kragt das Geschoss 1,20 m über die Küche vor; hinten endet es vor dem Wohnraum.
  b.wallY('front', -1.2, 0, W)
  b.wallY('back-kind2', 10.1, 0, 2.35)
  b.wallY('back-kind1', 8.9, 2.35, W, [[3.4, 4.3]])
  b.wallX('kind2-side', 2.35, 8.9, 10.1)
  // Balkon auf dem Dach des Wohnraums, Geländer; dahinter und neben Kind 2 Flachdach.
  b.item('balcony-rail', 'railing', 11.6, 2.35, 11.7, W)
  b.item('roof-rail', 'railing', 10.1, 2.3, 11.7, 2.4)
  b.zone('balcony', 'tiles', 8.9, 2.35, 11.7, W)
  b.zone('flat-roof', 'gravel', 10.1, 0, 13.9, 2.35)
  b.zone('flat-roof-b', 'gravel', 11.7, 2.35, 13.9, W)
  b.zone('front-air', 'grass', -1.3, 0, -1.2, W)
  // Elternzimmer vorn.
  b.wallY('parents', 2.25, 0, W, [[1.5, 2.25]])
  // Treppe, Flur, Bad (innen, ohne Fenster).
  b.item('stairs', 'stairs', 2.3, 0.05, 5.0, 1.25)
  b.wallX('bath', 3.1, 2.25, 5.0, [[3.2, 3.95]])
  b.wallY('kids', 5.0, 0, W, [[1.45, 2.2], [2.4, 3.05]])
  b.wallX('kids-split', 2.35, 5.0, 8.9)
  b.item('bath-tub', 'bathtub', 2.4, 4.45, 4.0, 5.2)
  b.item('bath-shower', 'shower', 4.15, 4.35, 4.9, 5.2)
  b.item('bath-sink', 'sink', 2.4, 3.25, 2.9, 3.7)
  b.item('bath-toilet', 'toilet', 4.35, 3.3, 4.85, 3.75)
  // Möbel der Zimmer.
  b.item('parents-bed', 'bed', -1.0, 2.6, 1.0, 4.2)
  b.item('parents-wardrobe', 'wardrobe', -1.05, 0.15, 1.4, 0.75)
  b.item('parents-desk', 'desk', 1.2, 4.6, 2.1, 5.2)
  b.item('kind2-bed', 'bed', 8.0, 0.15, 9.95, 1.15)
  b.item('kind2-wardrobe', 'wardrobe', 5.15, 0.15, 6.3, 0.7)
  b.item('kind2-desk', 'desk', 9.3, 1.4, 9.95, 2.15)
  b.item('kind1-bed', 'bed', 5.2, 4.2, 7.2, 5.15)
  b.item('kind1-wardrobe', 'wardrobe', 7.6, 2.5, 8.75, 3.05)
  b.item('kind1-desk', 'desk', 8.0, 4.45, 8.75, 5.15)
  b.item('balcony-chair', 'chair', 10.6, 4.4, 11.05, 4.85)
  b.item('balcony-plant', 'plant', 11.0, 2.6, 11.45, 3.05)
  b.zone('parents', 'carpet', -1.2, 0, 2.25, W)
  b.zone('hall', 'parquet', 2.25, 1.25, 5.0, 3.1)
  b.zone('bath', 'tiles', 2.25, 3.1, 5.0, W)
  b.zone('kind2', 'parquet', 5.0, 0, 10.1, 2.35)
  b.zone('kind1', 'parquet', 5.0, 2.35, 8.9, W)
  b.lamp(0.5, 2.6); b.lamp(7.5, 1.2, 80); b.lamp(7.0, 3.8, 80); b.lamp(3.6, 2.2, 60, false)

  b.spot('parents', wg ? 'ZIMMER VORN' : 'ELTERNZIMMER', 0.5, 1.6, wg
    ? 'Das größte Zimmer, vorn zum Wohnweg. Morgens fällt die Sonne herein, und vom Fenster aus sieht man, wer kommt und geht. Hier wohnt der Deutsche.'
    : 'Das Elternzimmer über der Küche. Es kragt vorn über den Hauseingang hinaus.')
  b.spot('kind2', wg ? 'PRIYAS ZIMMER' : 'KINDERZIMMER', 7.0, 1.6, wg
    ? 'Ein schmales Zimmer zum Garten, ohne Balkon. Der liegt gleich neben dem Fenster, bei der Nachbarin. Über der Decke hört man manchmal Schritte von oben. Auf der Fensterbank steht ein kleiner Flakon.'
    : 'Ein Kinderzimmer zum Garten. Vor dem Fenster liegt das Flachdach über dem Wohnraum.')
  b.spot('kind1', wg ? 'ZIMMER MIT BALKON' : 'KINDERZIMMER MIT BALKON', 6.9, 3.4, wg
    ? 'Das Zimmer der Mitbewohnerin aus China, mit Tür zum Balkon. Auf dem Balkon wachsen Kräuter in Töpfen.'
    : 'Das zweite Kinderzimmer, mit Tür zum Balkon.')
  b.spot('bath', 'BAD', 3.3, 4.0, wg
    ? 'Das Bad hat kein Fenster, nur einen Lüfter, der brummt. Ein Duft hängt noch in der Luft, obwohl niemand mehr da ist. Drei Menschen, ein Bad – morgens gibt es eine Reihenfolge.'
    : 'Das Bad liegt innen, ohne Fenster. Wanne und Dusche.')
  b.spot('balcony', 'BALKON', 10.2, 3.6, wg
    ? 'Der Balkon auf dem Dach des Wohnraums. Von oben, von der Dachterrasse, kann man hier hereinsehen. Links ist das Fenster von Priyas Zimmer.'
    : 'Der Balkon auf dem Dach des Wohnraums, zum Garten.', { action: 'sit' })
  b.spot('down-0', 'TREPPE INS ERDGESCHOSS', 2.7, 1.8, 'Die Treppe führt hinunter ins Erdgeschoss.', { action: 'stairs', toLevel: 0, toName: 'Ins Erdgeschoss' })
  b.spot('up-2', 'TREPPE INS DACHGESCHOSS', 4.7, 1.8, 'Die Treppe führt hinauf unters Dach.', { action: 'stairs', toLevel: 2, toName: 'Ins Dachgeschoss' })
  return {
    level: 1, floorName: FLOOR_NAMES[1],
    furniture: b.furniture, zones: b.zones, spots: b.spots, lamps: b.lamps,
    start: pt(4.1, 1.9), exit: { x: -100, y: -100 }, staff: null,
  }
}

function atticFloor(b: Builder, wg: boolean): Omit<LandmarkRoomLayout, 'kind' | 'noun'> {
  partyWalls(b)
  b.wallY('front', -1.2, 0, W)
  b.wallY('back-store', 8.9, 0, 2.35)
  b.wallY('back-multi', 7.3, 2.35, W, [[3.4, 4.2]])
  b.wallX('terrace-side', 2.35, 7.3, 8.9)
  // Dachterrasse über Kind 1, bündig mit dessen Rückwand; Geländer.
  b.item('terrace-rail', 'railing', 8.8, 2.4, 8.9, W)
  b.zone('terrace', 'tiles', 7.3, 2.35, 8.9, W)
  b.zone('roof-below', 'gravel', 8.9, 0, 13.9, W)
  // Hobbyraum vorn.
  b.wallY('hobby', 2.8, 0, W, [[1.5, 2.25]])
  b.item('stairs', 'stairs', 2.85, 0.05, 5.4, 1.25)
  b.wallX('bath', 3.8, 2.8, 5.1, [[3.4, 4.1]])
  b.wallY('multi', 5.1, 2.35, W, [[2.5, 3.2]])
  b.wallX('store-low', 2.35, 5.1, 7.3)
  b.wallY('store', 5.9, 0, 2.35, [[1.4, 2.15]])
  b.item('bath-tub', 'bathtub', 2.9, 4.5, 4.4, 5.2)
  b.item('bath-sink', 'sink', 4.55, 3.95, 5.0, 4.35)
  b.item('bath-toilet', 'toilet', 4.55, 4.6, 5.0, 5.05)
  b.item('hobby-bed', 'bed', -1.0, 3.6, 0.9, 5.15)
  b.item('hobby-wardrobe', 'wardrobe', -1.05, 0.15, 0.4, 0.7)
  b.item('hobby-desk', 'desk', 1.3, 0.2, 2.6, 0.8)
  b.item('hobby-armchair', 'armchair', 1.6, 3.9, 2.3, 4.6)
  b.item('store-bed', 'bed', 6.9, 0.15, 8.75, 1.05)
  b.item('store-shelf', 'shelf-low', 6.05, 0.15, 6.6, 1.2)
  b.item('multi-bed', 'bed', 5.25, 4.25, 7.15, 5.15)
  b.item('terrace-chair', 'chair', 7.9, 4.3, 8.35, 4.75)
  b.item('terrace-plant', 'plant', 8.25, 2.55, 8.7, 3.0)
  b.zone('hobby', 'carpet', -1.2, 0, 2.8, W)
  b.zone('hall', 'parquet', 2.8, 1.25, 5.9, 3.8)
  b.zone('bath', 'tiles', 2.8, 3.8, 5.1, W)
  b.zone('store', 'parquet', 5.9, 0, 8.9, 2.35)
  b.zone('multi', 'parquet', 5.1, 2.35, 7.3, W)
  b.lamp(0.8, 2.6); b.lamp(7.4, 1.2, 70); b.lamp(6.2, 3.8, 70); b.lamp(4.0, 2.4, 60, false)

  b.spot('hobby', wg ? 'ZIMMER UNTERM DACH' : 'HOBBYRAUM', 0.6, 1.8, wg
    ? 'Das große Zimmer unter der Dachschräge, vorn zum Spielplatz. Im Plan von 1979 stand hier „Hobbyraum“, mit Bleistift ist „Wohnen“ darübergeschrieben.'
    : 'Der Hobbyraum unter der Dachschräge, vorn zum Spielplatz.')
  b.spot('store', wg ? 'ZIMMER ÜBER DEM GARTEN' : 'ABSTELLRAUM', 7.6, 1.6, wg
    ? 'Ein schmales Zimmer, früher der Abstellraum. Es liegt genau über Priyas Zimmer – wer hier auf und ab geht, ist unten zu hören.'
    : 'Der Abstellraum unter dem Dach.')
  b.spot('multi', wg ? 'KLEINES ZIMMER' : 'MEHRZWECKRAUM', 6.2, 3.4, wg
    ? 'Das kleinste Zimmer im Haus – aber nur von hier kommt man auf die Dachterrasse.'
    : 'Der Mehrzweckraum mit Tür zur Dachterrasse.')
  b.spot('terrace', 'DACHTERRASSE', 8.1, 3.7, wg
    ? 'Die Dachterrasse über dem Zimmer mit Balkon. An der Brüstung sieht man senkrecht hinunter auf den Balkon – von unten sieht niemand herauf.'
    : 'Die Dachterrasse über dem ersten Stock. Von hier sieht man über die Gärten der Reihe.', { action: 'sit' })
  b.spot('bath', 'BAD', 3.8, 4.4, wg
    ? 'Das zweite Bad, klein und ohne Fenster. Drei Menschen teilen es.'
    : 'Ein kleines Bad ohne Fenster.')
  b.spot('down-1', 'TREPPE HINUNTER', 4.4, 1.75, 'Die Treppe führt hinunter in den ersten Stock.', { action: 'stairs', toLevel: 1, toName: 'Ins 1. Obergeschoss' })
  return {
    level: 2, floorName: FLOOR_NAMES[2],
    furniture: b.furniture, zones: b.zones, spots: b.spots, lamps: b.lamps,
    start: pt(3.6, 1.9), exit: { x: -100, y: -100 }, staff: null,
  }
}

function basement(b: Builder, wg: boolean): Omit<LandmarkRoomLayout, 'kind' | 'noun'> {
  partyWalls(b)
  // Tiefgarage vorn, reicht über die Küche hinaus; Tür zum Keller-Flur.
  b.zone('garage', 'concrete', -1.3, 0, 3.2, W)
  b.zone('garage-oil', 'oilstain', 0.0, 2.6, 1.4, 3.8)
  b.item('garage-car', 'vehicle', -0.9, 3.0, 2.3, 4.7)
  b.wallY('garage-wall', 3.2, 0, W, [[2.0, 2.8]])
  b.wallY('back', 11.7, 0, W)
  b.item('stairs', 'stairs', 3.25, 0.05, 6.0, 1.55)
  // Heizung, Hausanschluss, Keller.
  b.wallX('heating-a', 3.0, 4.9, 7.0, [[5.6, 6.35]])
  b.wallY('heating-b', 4.9, 3.0, W)
  b.wallY('utility', 7.0, 0, W, [[0.6, 1.4]])
  b.wallX('cellar', 2.4, 7.0, 11.7, [[7.5, 8.25]])
  b.item('boiler', 'boiler', 6.1, 4.4, 6.9, 5.2)
  b.item('washer', 'washer', 7.15, 0.15, 7.75, 0.75)
  b.item('dryer', 'washer', 7.85, 0.15, 8.45, 0.75)
  b.item('utility-shelf', 'shelf-low', 9.2, 0.15, 11.5, 0.6)
  b.item('cellar-crate-a', 'crate', 10.6, 4.4, 11.5, 5.15)
  b.item('cellar-crate-b', 'crate', 10.6, 2.6, 11.5, 3.3)
  if (wg) b.item('cellar-mattress', 'bed', 7.3, 4.1, 9.2, 5.15)
  else b.item('cellar-shelf', 'shelf-low', 7.2, 4.6, 9.2, 5.15)
  b.zone('hall', 'concrete', 3.2, 0, 7.0, 3.0)
  b.zone('vestibule', 'concrete', 3.2, 3.0, 4.9, W)
  b.zone('heating', 'tiles', 4.9, 3.0, 7.0, W)
  b.zone('cellar', 'concrete', 7.0, 0, 11.7, W)
  b.lamp(1.0, 2.6, 110, false); b.lamp(5.2, 2.0, 70, false); b.lamp(9.3, 1.2, 70, false); b.lamp(9.3, 3.8, 70, true)

  b.spot('garage', 'TIEFGARAGE', 1.0, 1.4, wg
    ? 'Die Tiefgarage der Reihe. Von hier führt eine Tür direkt in den Keller – wer will, kommt ins Haus, ohne an der Haustür vorbeizumüssen.'
    : 'Die Tiefgarage der Reihe, mit Stellplatz und Tür zum Keller.')
  b.spot('cellar', 'KELLER', 9.6, 3.9, wg
    ? 'Ein Kellerraum mit einer Matratze auf dem Boden. Ab und zu schläft hier ein Freund des Deutschen. Es riecht nach Zigaretten und Waschpulver.'
    : 'Der Kellerraum: Kisten, Regale, Vorräte.')
  b.spot('utility', 'HAUSANSCHLUSS', 9.0, 1.3, 'Waschmaschine, Trockner, Zähler. Hier unten brummt das Haus.')
  b.spot('heating', 'HEIZUNG', 5.9, 3.9, 'Der Heizungsraum. Im Winter das wärmste Zimmer im Keller.')
  b.spot('up-0', 'TREPPE INS ERDGESCHOSS', 6.5, 0.8, 'Die Treppe führt hinauf ins Erdgeschoss.', { action: 'stairs', toLevel: 0, toName: 'Ins Erdgeschoss' })
  return {
    level: 3, floorName: FLOOR_NAMES[3],
    furniture: b.furniture, zones: b.zones, spots: b.spots, lamps: b.lamps,
    start: pt(6.5, 1.2), exit: { x: -100, y: -100 }, staff: null,
  }
}

export function rowhouseLayout(variant: RowhouseVariant, level = 0, byStairs = false): LandmarkRoomLayout {
  const wg = variant === 'rowhouse_wg'
  const b = builder()
  const body = level === 1 ? firstFloor(b, wg) : level === 2 ? atticFloor(b, wg) : level === 3 ? basement(b, wg) : groundFloor(b, wg, byStairs)
  return { kind: variant, noun: wg ? 'WG' : 'Reihenhaus', ...body }
}
