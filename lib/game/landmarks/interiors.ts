// lib/game/landmarks/interiors.ts
// Aktualisiert: 26.10.2026 — CAMALEO-ArtLounge als dreigeschossiges Stadthaus (EG ArtLounge mit Flügel, Sitzreihen, Ausstellung, Büro im Hinterzimmer; Galerie und Dachstudio oben, Treppe); Räume für Betriebe: Laden (Tresen, Regale, Auslage) und Werkstatt (Hebebühne, Werkbank, Tor); Wegsuche um die Möbel herum (landmarkPath) für Spieler und Personal, Ziele im Raum (landmarkWaypoints); jedes Regal ist stöberbar (hohe Regale: Romane, niedrige: Sachbücher); Bibliothek als bewohnter Ort: Zonen (Teppich, Fliesen), Deko (Pflanzen, Sessel, Globus), Lampen, Ausleihtresen am Eingang, Bibliothekarin als Ansprechperson
// Version:      1.7.0

export type LandmarkRoomKind =
  | 'library' | 'worship' | 'shop' | 'workshop' | 'artlounge'
  // Gotteshäuser je Religion und Gemeindesaal (NOXIA-NPC-RELIGION-0001, 28.10.2026).
  // 'worship' bleibt die christliche Kirche.
  | 'mosque' | 'synagogue' | 'hindu_temple' | 'buddhist_temple' | 'community_hall'
  // Omnizedenz-Begegnungsstätte (gekauftes, umgebautes Haus oder gebauter Resonanzplatz).
  | 'resonance_place'
export type LandmarkPoint = { x: number; y: number }
export type LandmarkFurnitureKind = 'shelf' | 'shelf-low' | 'table' | 'desk' | 'pew' | 'altar' | 'font' | 'candles' | 'lectern' | 'armchair' | 'sofa' | 'plant' | 'globe' | 'pinboard' | 'counter' | 'goods' | 'lift' | 'bench' | 'vehicle' | 'gate' | 'crate' | 'piano' | 'chair' | 'wall' | 'artwork' | 'stairs'
  | 'mihrab' | 'minbar' | 'ablution' | 'shoerack' | 'ark' | 'bimah' | 'eternal-light' | 'shrine' | 'bell' | 'diya' | 'buddha' | 'cushion' | 'incense' | 'gong' | 'stage'
export type LandmarkFurniture = { id: string; kind: LandmarkFurnitureKind; x: number; y: number; w: number; h: number }
export type LandmarkSpot = { id: string; label: string; x: number; y: number; text: string; action?: 'books' | 'learn' | 'candle' | 'sit' | 'staff' | 'stairs'; /** Bei action 'stairs': Zielgeschoss (0 = Erdgeschoss). */ toLevel?: number }
/** Bodenzone – rein optisch, blockiert nicht. */
export type LandmarkZone = { id: string; kind: LandmarkZoneKind; x: number; y: number; w: number; h: number }
/** Deckenlampe: heller Lichtkegel auf dem Boden. */
export type LandmarkLamp = { x: number; y: number; r: number; warm?: boolean }
/** Angestellte Person im Raum – steht an einem festen Platz und ist ansprechbar. */
export type LandmarkStaff = { id: string; role: string; x: number; y: number; greeting: string }
export type LandmarkZoneKind = 'carpet' | 'tiles' | 'rug' | 'chancel' | 'concrete' | 'oilstain' | 'parquet'
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
  /** Geschoss (0 = Erdgeschoss) und Anzeigename, nur bei mehrgeschossigen Häusern. */
  level?: number
  floorName?: string
  /** Wo die Person steht, die den Ort trägt (Pfarrerin, Imam …), wenn sie da ist. */
  hostAt?: LandmarkPoint
  /** Wo Besucher bei einem Termin sitzen oder stehen (freie Plätze). */
  gatherAt?: LandmarkPoint[]
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
    noun: 'Kirche',
    hostAt: { x: 380, y: 124 },
    gatherAt: [{ x: 360, y: 200 }, { x: 400, y: 242 }, { x: 360, y: 284 }, { x: 400, y: 326 }, { x: 360, y: 368 }],
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


// ── Gotteshäuser je Religion und Gemeindesaal (28.10.2026) ──────────────
// Typische Grundrisse, nicht der vermessene Innenraum des realen Hauses.
// Beschreibungen sachlich und aus der Innensicht, ohne Wertung.

function mosqueLayout(): LandmarkRoomLayout {
  const furniture: LandmarkFurniture[] = [
    { id: 'mihrab', kind: 'mihrab', x: 350, y: 28, w: 60, h: 30 },
    { id: 'minbar', kind: 'minbar', x: 440, y: 34, w: 40, h: 70 },
    { id: 'kursi', kind: 'lectern', x: 290, y: 60, w: 24, h: 22 },
    { id: 'ablution', kind: 'ablution', x: 40, y: 390, w: 150, h: 30 },
    { id: 'shoes-0', kind: 'shoerack', x: 560, y: 410, w: 130, h: 20 },
    { id: 'shelf-quran', kind: 'shelf-low', x: 650, y: 150, w: 26, h: 120 },
    { id: 'plant-0', kind: 'plant', x: 40, y: 330, w: 24, h: 24 },
  ]
  return {
    kind: 'mosque', noun: 'Moschee', start: { x: 380, y: 432 }, exit: { x: 380, y: 452 }, furniture,
    zones: [
      { id: 'prayer-hall', kind: 'carpet', x: 60, y: 110, w: 560, h: 250 },
      { id: 'entry', kind: 'tiles', x: 24, y: 376, w: 712, h: 80 },
    ],
    lamps: [{ x: 380, y: 200, r: 160, warm: true }, { x: 200, y: 240, r: 110 }, { x: 560, y: 240, r: 110 }, { x: 115, y: 400, r: 70 }],
    staff: null,
    hostAt: { x: 380, y: 92 },
    gatherAt: [{ x: 300, y: 160 }, { x: 360, y: 160 }, { x: 420, y: 160 }, { x: 480, y: 160 }, { x: 330, y: 210 }, { x: 450, y: 210 }],
    spots: [
      { id: 'mihrab', label: 'MIHRAB', x: 380, y: 84, text: 'Die Gebetsnische in der Wand zeigt die Richtung nach Mekka, die Qibla. Alle beten in diese Richtung.' },
      { id: 'minbar', label: 'MINBAR', x: 500, y: 90, text: 'Die Kanzel mit wenigen Stufen. Von hier hält der Imam die Predigt beim Freitagsgebet.' },
      { id: 'hall', label: 'GEBETSRAUM', x: 380, y: 280, action: 'sit', text: 'Ein weiter Teppich, die Reihen sind in das Muster eingewebt. Man setzt sich auf den Boden.' },
      { id: 'ablution', label: 'WASCHRAUM', x: 115, y: 440, text: 'Vor dem Gebet wäscht man Hände, Gesicht, Arme und Füße – die rituelle Waschung, Wudu.' },
      { id: 'shoes', label: 'SCHUHREGAL', x: 625, y: 444, text: 'Die Schuhe bleiben vor dem Gebetsraum. Der Teppich wird nur ohne Schuhe betreten.' },
    ],
  }
}

function synagogueLayout(): LandmarkRoomLayout {
  const furniture: LandmarkFurniture[] = [
    { id: 'ark', kind: 'ark', x: 330, y: 28, w: 100, h: 34 },
    { id: 'ner-tamid', kind: 'eternal-light', x: 372, y: 70, w: 16, h: 14 },
    { id: 'bimah', kind: 'bimah', x: 320, y: 190, w: 120, h: 60 },
  ]
  for (let row = 0; row < 4; row++) {
    furniture.push({ id: `bench-l-${row}`, kind: 'pew', x: 80, y: 130 + row * 60, w: 170, h: 16 })
    furniture.push({ id: `bench-r-${row}`, kind: 'pew', x: 510, y: 130 + row * 60, w: 170, h: 16 })
  }
  furniture.push({ id: 'shelf-books', kind: 'shelf-low', x: 690, y: 140, w: 26, h: 150 })
  return {
    kind: 'synagogue', noun: 'Synagoge', start: { x: 380, y: 432 }, exit: { x: 380, y: 452 }, furniture,
    zones: [
      { id: 'front', kind: 'chancel', x: 24, y: 28, w: 712, h: 72 },
      { id: 'aisle', kind: 'rug', x: 290, y: 100, w: 180, h: 260 },
    ],
    lamps: [{ x: 380, y: 60, r: 90, warm: true }, { x: 380, y: 220, r: 130 }, { x: 165, y: 220, r: 110 }, { x: 595, y: 220, r: 110 }],
    staff: null,
    hostAt: { x: 380, y: 270 },
    gatherAt: [{ x: 165, y: 158 }, { x: 595, y: 158 }, { x: 165, y: 218 }, { x: 595, y: 218 }, { x: 165, y: 278 }, { x: 595, y: 278 }],
    spots: [
      { id: 'ark', label: 'TORASCHREIN', x: 380, y: 90, text: 'Der Toraschrein, Aron ha-Kodesch, an der Ostwand. Hinter dem Vorhang stehen die Torarollen.' },
      { id: 'ner-tamid', label: 'EWIGES LICHT', x: 300, y: 98, text: 'Das Ewige Licht, Ner Tamid, brennt immer über dem Toraschrein.' },
      { id: 'bimah', label: 'BIMA', x: 380, y: 288, text: 'Das erhöhte Lesepult in der Mitte. Hier wird beim Gottesdienst aus der Tora gelesen.' },
      { id: 'bench', label: 'BANK', x: 165, y: 330, action: 'sit', text: 'Die Bänke stehen zur Mitte und zum Schrein hin.' },
      { id: 'books', label: 'GEBETBÜCHER', x: 660, y: 215, text: 'Gebetbücher, Siddurim, und Ausgaben der Tora für den Gottesdienst.' },
    ],
  }
}

function hinduTempleLayout(): LandmarkRoomLayout {
  const furniture: LandmarkFurniture[] = [
    { id: 'shrine', kind: 'shrine', x: 300, y: 28, w: 160, h: 64 },
    { id: 'diya-0', kind: 'diya', x: 270, y: 106, w: 18, h: 18 },
    { id: 'diya-1', kind: 'diya', x: 472, y: 106, w: 18, h: 18 },
    { id: 'offering', kind: 'table', x: 340, y: 130, w: 80, h: 26 },
    { id: 'bell', kind: 'bell', x: 368, y: 360, w: 24, h: 24 },
    { id: 'pillar-0', kind: 'wall', x: 150, y: 150, w: 22, h: 22 },
    { id: 'pillar-1', kind: 'wall', x: 588, y: 150, w: 22, h: 22 },
    { id: 'pillar-2', kind: 'wall', x: 150, y: 290, w: 22, h: 22 },
    { id: 'pillar-3', kind: 'wall', x: 588, y: 290, w: 22, h: 22 },
    { id: 'shoes-0', kind: 'shoerack', x: 560, y: 410, w: 130, h: 20 },
  ]
  return {
    kind: 'hindu_temple', noun: 'Tempel', start: { x: 380, y: 432 }, exit: { x: 380, y: 452 }, furniture,
    zones: [
      { id: 'sanctum', kind: 'chancel', x: 260, y: 28, w: 240, h: 90 },
      { id: 'mandapa', kind: 'tiles', x: 60, y: 118, w: 640, h: 230 },
      { id: 'entry', kind: 'tiles', x: 24, y: 376, w: 712, h: 80 },
    ],
    lamps: [{ x: 380, y: 70, r: 100, warm: true }, { x: 380, y: 230, r: 150, warm: true }, { x: 170, y: 230, r: 100 }, { x: 590, y: 230, r: 100 }],
    staff: null,
    hostAt: { x: 380, y: 112 },
    gatherAt: [{ x: 300, y: 200 }, { x: 380, y: 200 }, { x: 460, y: 200 }, { x: 330, y: 250 }, { x: 430, y: 250 }, { x: 380, y: 300 }],
    spots: [
      { id: 'shrine', label: 'SCHREIN', x: 380, y: 112, text: 'Das Allerheiligste mit dem Götterbild. Gläubige kommen zum Darshan: sehen und gesehen werden.' },
      { id: 'aarti', label: 'AARTI-LAMPE', x: 300, y: 128, text: 'Bei der Aarti schwenkt der Priester Lichter vor dem Götterbild, dazu Gesang und Glocke.' },
      { id: 'hall', label: 'HALLE', x: 380, y: 230, action: 'sit', text: 'Die offene Halle vor dem Schrein. Man sitzt auf dem Boden, Schuhe bleiben draußen.' },
      { id: 'bell', label: 'GLOCKE', x: 380, y: 400, text: 'Beim Eintreten läutet man die Glocke und kündigt sich an.' },
      { id: 'shoes', label: 'SCHUHREGAL', x: 625, y: 444, text: 'Die Schuhe bleiben am Eingang.' },
    ],
  }
}

function buddhistTempleLayout(): LandmarkRoomLayout {
  const furniture: LandmarkFurniture[] = [
    { id: 'buddha', kind: 'buddha', x: 330, y: 28, w: 100, h: 58 },
    { id: 'altar', kind: 'altar', x: 320, y: 96, w: 120, h: 26 },
    { id: 'incense', kind: 'incense', x: 368, y: 136, w: 24, h: 18 },
    { id: 'gong', kind: 'gong', x: 560, y: 70, w: 34, h: 34 },
    { id: 'shoes-0', kind: 'shoerack', x: 560, y: 410, w: 130, h: 20 },
    { id: 'plant-0', kind: 'plant', x: 250, y: 40, w: 24, h: 24 },
    { id: 'plant-1', kind: 'plant', x: 486, y: 40, w: 24, h: 24 },
  ]
  for (let row = 0; row < 3; row++) for (let col = 0; col < 6; col++) {
    if (col === 2 || col === 3) continue
    furniture.push({ id: `cushion-${row}-${col}`, kind: 'cushion', x: 170 + col * 76, y: 200 + row * 56, w: 30, h: 24 })
  }
  return {
    kind: 'buddhist_temple', noun: 'Tempel', start: { x: 380, y: 432 }, exit: { x: 380, y: 452 }, furniture,
    zones: [
      { id: 'altar-zone', kind: 'chancel', x: 220, y: 28, w: 320, h: 130 },
      { id: 'hall', kind: 'parquet', x: 60, y: 158, w: 640, h: 200 },
      { id: 'entry', kind: 'tiles', x: 24, y: 376, w: 712, h: 80 },
    ],
    lamps: [{ x: 380, y: 70, r: 110, warm: true }, { x: 380, y: 260, r: 150 }, { x: 577, y: 90, r: 50, warm: true }],
    staff: null,
    hostAt: { x: 380, y: 170 },
    gatherAt: [{ x: 200, y: 236 }, { x: 276, y: 236 }, { x: 504, y: 236 }, { x: 580, y: 236 }, { x: 200, y: 292 }, { x: 580, y: 292 }],
    spots: [
      { id: 'buddha', label: 'BUDDHA', x: 380, y: 150, text: 'Die Buddhafigur. Man verneigt sich, nicht vor einem Gott, sondern vor dem Erwachen, für das sie steht.' },
      { id: 'incense', label: 'RÄUCHERWERK', x: 330, y: 160, text: 'Räucherstäbchen als Gabe. Ihr Duft verteilt sich im ganzen Raum – wie die Wirkung guter Taten.' },
      { id: 'cushions', label: 'KISSEN', x: 380, y: 260, action: 'sit', text: 'Meditationskissen in Reihen. Hier sitzt man still und folgt dem Atem.' },
      { id: 'gong', label: 'GONG', x: 520, y: 120, text: 'Der Gong markiert Anfang und Ende der Meditation.' },
      { id: 'shoes', label: 'SCHUHREGAL', x: 625, y: 444, text: 'Die Schuhe bleiben am Eingang.' },
    ],
  }
}

function communityHallLayout(): LandmarkRoomLayout {
  const furniture: LandmarkFurniture[] = [
    { id: 'stage', kind: 'stage', x: 220, y: 28, w: 320, h: 56 },
    { id: 'kitchen', kind: 'counter', x: 560, y: 380, w: 150, h: 30 },
    { id: 'pinboard', kind: 'pinboard', x: 40, y: 140, w: 14, h: 90 },
    { id: 'table-0', kind: 'table', x: 90, y: 300, w: 70, h: 40 },
    { id: 'table-1', kind: 'table', x: 90, y: 370, w: 70, h: 40 },
    { id: 'plant-0', kind: 'plant', x: 690, y: 40, w: 24, h: 24 },
  ]
  for (let row = 0; row < 3; row++) for (let col = 0; col < 8; col++) {
    if (col === 3 || col === 4) continue
    furniture.push({ id: `chair-${row}-${col}`, kind: 'chair', x: 230 + col * 40, y: 140 + row * 48, w: 22, h: 20 })
  }
  return {
    kind: 'community_hall', noun: 'Saal', start: { x: 380, y: 432 }, exit: { x: 380, y: 452 }, furniture,
    zones: [{ id: 'floor', kind: 'parquet', x: 24, y: 28, w: 712, h: 348 }, { id: 'entry', kind: 'tiles', x: 24, y: 376, w: 712, h: 80 }],
    lamps: [{ x: 380, y: 60, r: 120, warm: true }, { x: 380, y: 200, r: 150 }, { x: 125, y: 350, r: 90 }, { x: 635, y: 395, r: 70, warm: true }],
    staff: null,
    hostAt: { x: 380, y: 104 },
    gatherAt: [{ x: 250, y: 172 }, { x: 290, y: 172 }, { x: 490, y: 172 }, { x: 530, y: 172 }, { x: 250, y: 220 }, { x: 530, y: 220 }],
    spots: [
      { id: 'stage', label: 'BÜHNE', x: 380, y: 104, text: 'Eine kleine Bühne für Vorträge, Musik und Versammlungen.' },
      { id: 'seats', label: 'STUHLREIHEN', x: 380, y: 200, action: 'sit', text: 'Stuhlreihen, je nach Anlass umgestellt.' },
      { id: 'tables', label: 'TISCHE', x: 200, y: 330, action: 'sit', text: 'Tische für das Gespräch danach.' },
      { id: 'kitchen', label: 'TEEKÜCHE', x: 635, y: 440, text: 'Die Teeküche. Es gibt Kaffee und Tee für alle.' },
      { id: 'board', label: 'PINNWAND', x: 80, y: 185, text: 'Aushänge: Termine, Vereine, Gesprächskreise.' },
    ],
  }
}

/**
 * Omnizedenz-Begegnungsstätte (NOXIA-NPC-RELIGION-0002, 28.10.2026): Stuhlkreis
 * ohne Bühne und ohne Altar – niemand steht vorn. Lesen & Denken, Teeküche,
 * eine stille Ecke, Pinnwand mit den Resonanzrunden. Kein Kultort.
 */
function resonancePlaceLayout(): LandmarkRoomLayout {
  const furniture: LandmarkFurniture[] = [
    { id: 'circle-table', kind: 'table', x: 345, y: 170, w: 70, h: 44 },
    { id: 'shelf-0', kind: 'shelf', x: 40, y: 34, w: 150, h: 22 },
    { id: 'shelf-1', kind: 'shelf-low', x: 40, y: 120, w: 22, h: 110 },
    { id: 'armchair-0', kind: 'armchair', x: 90, y: 110, w: 34, h: 34 },
    { id: 'armchair-1', kind: 'armchair', x: 90, y: 170, w: 34, h: 34 },
    { id: 'pinboard', kind: 'pinboard', x: 330, y: 34, w: 100, h: 10 },
    { id: 'kitchen', kind: 'counter', x: 560, y: 380, w: 150, h: 30 },
    { id: 'cushion-0', kind: 'cushion', x: 620, y: 90, w: 26, h: 22 },
    { id: 'cushion-1', kind: 'cushion', x: 660, y: 90, w: 26, h: 22 },
    { id: 'cushion-2', kind: 'cushion', x: 640, y: 130, w: 26, h: 22 },
    { id: 'plant-0', kind: 'plant', x: 700, y: 40, w: 24, h: 24 },
    { id: 'plant-1', kind: 'plant', x: 36, y: 410, w: 26, h: 26 },
    { id: 'plant-2', kind: 'plant', x: 440, y: 290, w: 24, h: 24 },
  ]
  // Zwölf Stühle im Kreis um den niedrigen Tisch.
  const centre = { x: 380, y: 192 }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    furniture.push({ id: `chair-${i}`, kind: 'chair', x: Math.round(centre.x + Math.cos(a) * 108 - 11), y: Math.round(centre.y + Math.sin(a) * 82 - 10), w: 22, h: 20 })
  }
  const seat = (i: number) => {
    const a = (i / 12) * Math.PI * 2
    return { x: Math.round(centre.x + Math.cos(a) * 80), y: Math.round(centre.y + Math.sin(a) * 60) }
  }
  return {
    kind: 'resonance_place', noun: 'Begegnungsstätte', start: { x: 380, y: 432 }, exit: { x: 380, y: 452 }, furniture,
    zones: [
      { id: 'floor', kind: 'parquet', x: 24, y: 28, w: 712, h: 348 },
      { id: 'circle', kind: 'rug', x: 250, y: 96, w: 260, h: 192 },
      { id: 'reading', kind: 'carpet', x: 24, y: 28, w: 180, h: 220 },
      { id: 'entry', kind: 'tiles', x: 24, y: 376, w: 712, h: 80 },
    ],
    lamps: [{ x: 380, y: 192, r: 150, warm: true }, { x: 110, y: 140, r: 80, warm: true }, { x: 650, y: 110, r: 70, warm: true }, { x: 635, y: 395, r: 70 }],
    staff: null,
    // Die Omnizedentin sitzt mit im Kreis, nicht davor.
    hostAt: seat(9),
    gatherAt: [seat(0), seat(2), seat(4), seat(6), seat(7), seat(11)],
    spots: [
      { id: 'circle', label: 'STUHLKREIS', x: 380, y: 192, action: 'sit', text: 'Ein Kreis ohne Kopfende. Bei der Resonanzrunde spricht, wer etwas sagen mag – zuhören zählt genauso.' },
      { id: 'reading', label: 'LESEN & DENKEN', x: 110, y: 90, action: 'books', text: 'Bücher zu Philosophie, Ethik und Religionen – auch über die Omnizedenz. Kostenlos, zum Lesen hier oder Ausleihen.' },
      { id: 'board', label: 'PINNWAND', x: 380, y: 60, text: 'Offene Resonanzrunden: Sundern mittwochs 19 Uhr, Frankfurt (ArtLounge) freitags 19 Uhr, Tharsis Hub samstags 19 Uhr. Alle sind willkommen, niemand muss etwas glauben.' },
      { id: 'quiet', label: 'STILLE ECKE', x: 650, y: 120, action: 'sit', text: 'Kissen für die Stille. Hier darf man einfach sitzen.' },
      { id: 'kitchen', label: 'TEEKÜCHE', x: 635, y: 440, text: 'Tee und Wasser für alle.' },
    ],
  }
}

/** Mehrgeschossige Häuser: Anzahl Geschosse je Raumart (alle anderen haben eines). */
export const LANDMARK_LEVELS: Partial<Record<LandmarkRoomKind, number>> = { artlounge: 3 }

const STAIRS = { x: 690, y: 236, w: 44, h: 100 }
const STAIRS_LANDING = { x: 640, y: 290 }

/**
 * CAMALEO-ArtLounge (Frankfurt, Mörfelder Landstraße 103): Stadthaus mit drei
 * Geschossen. Erdgeschoss = ArtLounge (kleiner Flügel auf der Bühne,
 * Reihenbestuhlung, Ausstellung, Theke; Büro im Hinterzimmer). Die Obergeschosse
 * sind vorläufig schlicht eingerichtet (Galerie, Dachstudio) und über die Treppe
 * rechts erreichbar. Typischer Grundriss, nicht der vermessene Innenraum.
 */
function artLoungeLayout(level: number, byStairs: boolean): LandmarkRoomLayout {
  const furniture: LandmarkFurniture[] = []
  const spots: LandmarkSpot[] = []
  const zones: LandmarkZone[] = []
  const lamps: LandmarkLamp[] = []
  furniture.push({ id: 'stairs', kind: 'stairs', ...STAIRS })
  const stairsUp = (toLevel: number, y: number): LandmarkSpot => ({ id: `up-${toLevel}`, label: 'TREPPE HINAUF', x: 668, y, action: 'stairs', toLevel, text: `Die Treppe führt ins ${toLevel}. Obergeschoss.` })
  const stairsDown = (toLevel: number, y: number): LandmarkSpot => ({ id: `down-${toLevel}`, label: toLevel === 0 ? 'TREPPE INS ERDGESCHOSS' : 'TREPPE HINUNTER', x: 668, y, action: 'stairs', toLevel, text: toLevel === 0 ? 'Die Treppe führt hinunter in die ArtLounge.' : `Die Treppe führt hinunter ins ${toLevel}. Obergeschoss.` })
  const base = { noun: 'ArtLounge', level, furniture, spots, zones, lamps }

  if (level === 1) {
    for (let i = 0; i < 6; i++) furniture.push({ id: `artwork-${i}`, kind: 'artwork', x: 70 + i * 100, y: 34, w: 60, h: 10 })
    furniture.push({ id: 'sofa', kind: 'sofa', x: 250, y: 220, w: 140, h: 36 })
    furniture.push({ id: 'table-0', kind: 'table', x: 270, y: 280, w: 100, h: 46 })
    furniture.push({ id: 'plant-0', kind: 'plant', x: 40, y: 400, w: 26, h: 26 })
    furniture.push({ id: 'plant-1', kind: 'plant', x: 600, y: 60, w: 26, h: 26 })
    zones.push({ id: 'floor', kind: 'parquet', x: 24, y: 28, w: 712, h: 428 }, { id: 'rug', kind: 'rug', x: 200, y: 200, w: 240, h: 150 })
    lamps.push({ x: 320, y: 270, r: 130, warm: true }, { x: 160, y: 80, r: 100 }, { x: 500, y: 80, r: 100 })
    spots.push(
      { id: 'gallery', label: 'GALERIE', x: 330, y: 100, text: 'Die Galerieetage: Bilder in Reihe, Platz zum Stehen und Reden. Hier hängen die größeren Ausstellungen.' },
      { id: 'lounge', label: 'SOFA', x: 320, y: 200, action: 'sit', text: 'Ein Sofa vor der Bilderwand – gut für eine Pause zwischen zwei Ausstellungen.' },
      stairsUp(2, 262), stairsDown(0, 318),
    )
    return { kind: 'artlounge', ...base, start: STAIRS_LANDING, exit: { x: -100, y: -100 }, staff: null, floorName: '1. Obergeschoss · Galerie' }
  }
  if (level === 2) {
    furniture.push({ id: 'desk', kind: 'desk', x: 80, y: 80, w: 130, h: 46 })
    furniture.push({ id: 'chair', kind: 'chair', x: 130, y: 134, w: 26, h: 26 })
    furniture.push({ id: 'armchair-0', kind: 'armchair', x: 360, y: 240, w: 40, h: 40 })
    furniture.push({ id: 'armchair-1', kind: 'armchair', x: 440, y: 240, w: 40, h: 40 })
    furniture.push({ id: 'table-0', kind: 'table', x: 380, y: 300, w: 80, h: 40 })
    furniture.push({ id: 'artwork-0', kind: 'artwork', x: 300, y: 34, w: 60, h: 10 })
    furniture.push({ id: 'plant-0', kind: 'plant', x: 560, y: 60, w: 26, h: 26 })
    furniture.push({ id: 'plant-1', kind: 'plant', x: 40, y: 400, w: 26, h: 26 })
    zones.push({ id: 'floor', kind: 'parquet', x: 24, y: 28, w: 712, h: 428 }, { id: 'rug', kind: 'carpet', x: 320, y: 220, w: 200, h: 140 })
    lamps.push({ x: 145, y: 110, r: 110 }, { x: 420, y: 290, r: 120, warm: true })
    spots.push(
      { id: 'studio', label: 'DACHSTUDIO', x: 150, y: 190, text: 'Unter dem Dach: ein Schreibtisch und viel Ruhe. Dieses Geschoss ist noch nicht fertig eingerichtet.' },
      { id: 'lounge', label: 'SESSEL', x: 420, y: 218, action: 'sit', text: 'Zwei Sessel unter der Dachschräge.' },
      stairsDown(1, 290),
    )
    return { kind: 'artlounge', ...base, start: STAIRS_LANDING, exit: { x: -100, y: -100 }, staff: null, floorName: '2. Obergeschoss · Dachstudio' }
  }

  // Erdgeschoss
  // Hinterzimmer (Büro): Trennwand mit Türlücke zwischen x=174 und x=226.
  furniture.push({ id: 'office-wall-a', kind: 'wall', x: 24, y: 196, w: 150, h: 8 })
  furniture.push({ id: 'office-wall-b', kind: 'wall', x: 226, y: 196, w: 40, h: 8 })
  furniture.push({ id: 'office-wall-c', kind: 'wall', x: 258, y: 28, w: 8, h: 176 })
  furniture.push({ id: 'office-desk', kind: 'desk', x: 50, y: 70, w: 120, h: 44 })
  furniture.push({ id: 'office-chair', kind: 'chair', x: 96, y: 124, w: 26, h: 26 })
  furniture.push({ id: 'office-board', kind: 'pinboard', x: 50, y: 32, w: 90, h: 10 })
  furniture.push({ id: 'office-crate', kind: 'crate', x: 200, y: 130, w: 40, h: 32 })
  furniture.push({ id: 'office-plant', kind: 'plant', x: 220, y: 40, w: 26, h: 26 })
  // Bühne rechts oben mit kleinem Flügel und Hocker.
  furniture.push({ id: 'grand-piano', kind: 'piano', x: 520, y: 52, w: 130, h: 96 })
  furniture.push({ id: 'piano-stool', kind: 'chair', x: 570, y: 158, w: 24, h: 24 })
  // Ausstellung: Bilder an der Saalwand links und an der Rückwand.
  for (let i = 0; i < 3; i++) furniture.push({ id: `artwork-${i}`, kind: 'artwork', x: 300 + i * 66, y: 34, w: 50, h: 10 })
  for (let i = 0; i < 3; i++) furniture.push({ id: `artwork-l-${i}`, kind: 'artwork', x: 26, y: 252 + i * 54, w: 10, h: 40 })
  // Sitzplätze: drei Reihen zu je fünf Stühlen, Blick zum Flügel.
  for (let row = 0; row < 3; row++) for (let col = 0; col < 5; col++) {
    furniture.push({ id: `seat-${row}-${col}`, kind: 'chair', x: 330 + col * 58, y: 236 + row * 52, w: 26, h: 26 })
  }
  // Theke am Eingang, kleine Stehtische links, Pflanzen.
  furniture.push({ id: 'counter', kind: 'counter', x: 470, y: 392, w: 150, h: 30 })
  furniture.push({ id: 'table-0', kind: 'table', x: 90, y: 300, w: 70, h: 44 })
  furniture.push({ id: 'table-1', kind: 'table', x: 90, y: 380, w: 70, h: 44 })
  furniture.push({ id: 'plant-0', kind: 'plant', x: 700, y: 410, w: 26, h: 26 })
  furniture.push({ id: 'plant-1', kind: 'plant', x: 700, y: 150, w: 26, h: 26 })
  zones.push(
    { id: 'floor', kind: 'parquet', x: 24, y: 28, w: 712, h: 348 },
    { id: 'stage', kind: 'rug', x: 480, y: 40, w: 230, h: 150 },
    { id: 'office', kind: 'carpet', x: 24, y: 28, w: 234, h: 168 },
    { id: 'entry', kind: 'tiles', x: 24, y: 376, w: 712, h: 80 },
  )
  lamps.push({ x: 585, y: 100, r: 110, warm: true }, { x: 430, y: 290, r: 120, warm: true }, { x: 110, y: 110, r: 90 }, { x: 360, y: 60, r: 80, warm: true }, { x: 555, y: 400, r: 90, warm: true })
  spots.push(
    { id: 'piano', label: 'FLÜGEL', x: 585, y: 196, text: 'Ein kleiner Flügel auf der Bühne. Hier gibt es Konzerte im kleinen Kreis – der Raum trägt jeden Ton.' },
    { id: 'seats', label: 'SITZPLÄTZE', x: 372, y: 275, action: 'sit', text: 'Reihenbestuhlung für Konzerte und Lesungen. Von hier hört man alles.' },
    { id: 'exhibit', label: 'AUSSTELLUNG', x: 80, y: 270, text: 'Bilder an der Wand – die Ausstellung wechselt, der Raum bleibt.' },
    { id: 'tables', label: 'STEHTISCHE', x: 190, y: 340, action: 'sit', text: 'Zwei kleine Tische für das Gespräch nach der Veranstaltung.' },
    { id: 'office', label: 'BÜRO', x: 110, y: 168, text: 'Das Hinterzimmer: Schreibtisch, Pinnwand mit Terminen, ein Karton mit Programmheften. Hier wird geplant.' },
    { id: 'desk', label: 'THEKE', x: 545, y: 440, action: 'staff', text: 'Die Theke am Eingang. Hier arbeitet jemand, der das Programm kennt.' },
    stairsUp(1, 290),
  )
  return {
    kind: 'artlounge', ...base,
    start: byStairs ? STAIRS_LANDING : { x: 380, y: 430 },
    exit: { x: 380, y: 452 },
    staff: { id: 'host', role: 'Gastgeber(in)', x: 545, y: 378, greeting: 'Willkommen in der ArtLounge! Heute Abend ist der Flügel frei – und die Stühle sind fast schon gestellt.' },
    floorName: 'Erdgeschoss · ArtLounge',
    hostAt: { x: 540, y: 236 },
    gatherAt: [{ x: 372, y: 275 }, { x: 190, y: 340 }, { x: 230, y: 380 }, { x: 300, y: 400 }],
  }
}

/** Raum eines Gotteshauses nach Religion (OSM `religion`) oder Bauart (`building=mosque` …). */
export function worshipRoomKind(religion?: string | null, buildingType?: string | null): LandmarkRoomKind {
  const r = String(religion ?? '').toLowerCase(), b = String(buildingType ?? '').toLowerCase()
  if (r === 'muslim' || b === 'mosque') return 'mosque'
  if (r === 'jewish' || b === 'synagogue') return 'synagogue'
  if (r === 'hindu') return 'hindu_temple'
  if (r === 'buddhist') return 'buddhist_temple'
  if (b === 'temple') return 'buddhist_temple'
  return 'worship'
}

/** Landmark classes that have a walkable interior; all others show the place card. */
export function landmarkRoomKind(landmarkClass: string, tags?: Record<string, string>): LandmarkRoomKind | null {
  if (landmarkClass === 'library') return 'library'
  if (landmarkClass === 'place_of_worship') return worshipRoomKind(tags?.religion, tags?.building)
  if (landmarkClass === 'artlounge') return 'artlounge'
  if (landmarkClass === 'community_centre') return 'community_hall'
  if (landmarkClass === 'resonance_place') return 'resonance_place'
  return null
}

/**
 * Reale Gebäude der Weltkarte mit begehbarem Raum, nach heutiger Nutzung
 * (`lib/worldlab/buildingUse.ts`, z. B. „a:place_of_worship“, „b:church“) oder
 * OSM-Kennung (CAMALEO-ArtLounge). `tags` stammen von einem Wahrzeichen im Haus.
 */
export const ARTLOUNGE_OSM_ID = 'osm:way:265117408'
export function buildingRoomKind(useCode?: string | null, source?: string | null, tags?: Record<string, string>): LandmarkRoomKind | null {
  if (source === ARTLOUNGE_OSM_ID) return 'artlounge'
  const [prefix, value = ''] = String(useCode ?? '').split(':')
  if (prefix === 'a' && value === 'place_of_worship') return worshipRoomKind(tags?.religion, tags?.building)
  if (prefix === 'a' && value === 'community_centre') return 'community_hall'
  if (prefix === 'b' && ['church', 'chapel', 'cathedral'].includes(value)) return 'worship'
  if (prefix === 'b' && ['mosque', 'synagogue', 'temple'].includes(value)) return worshipRoomKind(tags?.religion, value)
  return null
}

export function landmarkRoomLayout(kind: LandmarkRoomKind, level = 0, byStairs = false): LandmarkRoomLayout {
  switch (kind) {
    case 'library': return libraryLayout()
    case 'worship': return worshipLayout()
    case 'shop': return shopLayout()
    case 'artlounge': return artLoungeLayout(level, byStairs)
    case 'mosque': return mosqueLayout()
    case 'synagogue': return synagogueLayout()
    case 'hindu_temple': return hinduTempleLayout()
    case 'buddhist_temple': return buddhistTempleLayout()
    case 'community_hall': return communityHallLayout()
    case 'resonance_place': return resonancePlaceLayout()
    default: return workshopLayout()
  }
}

export function isLandmarkRoomBlocked(layout: LandmarkRoomLayout, p: LandmarkPoint, radius = LANDMARK_PLAYER_RADIUS) {
  if (p.x < LANDMARK_ROOM.left || p.x > LANDMARK_ROOM.right || p.y < LANDMARK_ROOM.top || p.y > LANDMARK_ROOM.bottom) return true
  return layout.furniture.some(item =>
    p.x + radius > item.x && p.x - radius < item.x + item.w
    && p.y + radius > item.y && p.y - radius < item.y + item.h)
}

/**
 * Plätze für eine größere Gemeinde: zuerst die festen Plätze (`gatherAt`), dann
 * Sitzplätze auf Bänken, Stühlen und Kissen, dann freie Bodenpunkte (28 px Raster,
 * nicht am Eingang, nicht zu dicht).
 */
export function crowdSpots(layout: LandmarkRoomLayout, count: number): LandmarkPoint[] {
  const spots = [...(layout.gatherAt ?? [])].slice(0, count)
  if (spots.length >= count) return spots
  const taken = [...spots, ...(layout.hostAt ? [layout.hostAt] : [])]
  const seeds = spots.length ? spots : [layout.hostAt ?? layout.start]
  // Sitzplätze zuerst: auf Bänken, Stühlen und Kissen (man sitzt dort, statt im Gang zu stehen).
  const seats: Array<{ p: LandmarkPoint; d: number }> = []
  for (const item of layout.furniture) {
    if (item.kind === 'pew' || item.kind === 'bench') {
      for (let x = item.x + 16; x <= item.x + item.w - 12; x += 30) seats.push({ p: { x, y: item.y + item.h / 2 }, d: 0 })
    } else if (item.kind === 'chair' || item.kind === 'cushion') seats.push({ p: { x: item.x + item.w / 2, y: item.y + item.h / 2 }, d: 0 })
  }
  for (const seat of seats) seat.d = Math.min(...seeds.map(seed => Math.hypot(seed.x - seat.p.x, seed.y - seat.p.y)))
  seats.sort((a, b) => a.d - b.d || a.p.y - b.p.y || a.p.x - b.p.x)
  for (const { p } of seats) {
    if (spots.length >= count) break
    if (taken.some(q => Math.hypot(q.x - p.x, q.y - p.y) < 22)) continue
    spots.push(p); taken.push(p)
  }
  const candidates: Array<{ p: LandmarkPoint; d: number }> = []
  for (let x = LANDMARK_ROOM.left + 20; x <= LANDMARK_ROOM.right - 20; x += 28) {
    for (let y = LANDMARK_ROOM.top + 20; y <= LANDMARK_ROOM.bottom - 60; y += 28) {
      const p = { x, y }
      if (isLandmarkRoomBlocked(layout, p, 8)) continue
      if (Math.hypot(p.x - layout.start.x, p.y - layout.start.y) < 50) continue
      candidates.push({ p, d: Math.min(...seeds.map(seed => Math.hypot(seed.x - x, seed.y - y))) })
    }
  }
  candidates.sort((a, b) => a.d - b.d || a.p.y - b.p.y || a.p.x - b.p.x)
  for (const { p } of candidates) {
    if (spots.length >= count) break
    if (taken.some(q => Math.hypot(q.x - p.x, q.y - p.y) < 24)) continue
    spots.push(p); taken.push(p)
  }
  return spots
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
