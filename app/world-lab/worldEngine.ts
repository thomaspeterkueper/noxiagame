// app/world-lab/worldEngine.ts
// Prototyp „eine Welt“ mit PixiJS – die Zeichenmaschine ohne React.
//
// WorldLab.tsx stellt nur Bühne und Anzeige; Kacheln, NOXIA-Gebäude und Bilder
// kommen über die Optionen herein. So lässt sich dieselbe Maschine auch ohne
// Anmeldung und Datenbank mit Testkacheln messen.

import type { Application, Container, Graphics as PixiGraphics, Texture } from 'pixi.js'
import { geoToMerc, mercPerGroundMetre, mercToGeo, tileAt, tileKey, tileOrigin, TILE_SIZE_MERC, type GeoPoint, type TileId } from '@/lib/worldlab/mercator'
import { shouldReanchor } from '@/lib/worldlab/reanchor'
import { DEFAULT_VIEW, placeHasFunction, type ViewOptions } from '@/lib/worldlab/viewOptions'
import { COMMUTE_THRESHOLD_M, commuteSeconds, distanceToNearestVertex, pathLength, shouldCommute } from '@/lib/game/population/visibleMovement'
import { AREA_COLORS, AREA_OUTLINES, AREA_PATTERNS, BLOCK_STYLES, TRACK_STYLE, NOXIA_DEFAULT_LOOK, NOXIA_LOOKS, publicSymbol, type BlockArt, GROUND_COLOR, OUTLINE, RIVER_STYLE, ROAD_STYLES } from '@/lib/worldlab/blocks'
import { iso, ISO_Y, leftToRight, roofMatrix, wallMatrix, type Affine } from '@/lib/worldlab/facade'
import { paintPattern, patternMatrix, PATTERN_PX } from '@/lib/worldlab/areaPatterns'
import { streetLabels } from '@/lib/worldlab/streetLabels'
import { boxFootprint, HOUSE_DRAW_SCALE, insidePolygon, RoadGraph, scaleRing, stepWithObstacles, type Footprint } from '@/lib/worldlab/walking'
import { pointAlong, trainState, type TrainState } from '@/lib/worldlab/railLine'
import { paintTree, treeVariant, TREE_PX, TREE_VARIANTS, TREE_WORLD } from '@/lib/worldlab/treeSprites'
import { FrameStats, type FrameSummary } from '@/lib/worldlab/frameStats'
import type { BlockKind, SimplifiedTile, TileBlock, TilePlace } from '@/lib/worldlab/simplify'
import { polygonArea } from '@/lib/worldlab/simplify'
import { apronOutline, facilityClusters, nativeStandKind, padOutline, pointsAlong, type Pt } from '@/lib/worldlab/facility'
import { growView, minZoomForTiles, tilesForView, type ViewRect } from '@/lib/worldlab/viewTiles'

type Pixi = typeof import('pixi.js')

export type NoxiaBuilding = { id: string; typeId: string; name: string; lat: number; lon: number; w: number; d: number; rotation?: number; own?: boolean; ownerLabel?: string; /** OSM-Kennung des realen Hauses (gekauft oder Gebäude des Ortes). */ source?: string; /** Gebäude des Ortes, nicht von Spielern gekauft (W-7) */ public?: boolean; /** Im realen Haus, aber mit NOXIA-Dach (Startcafé) */ noxiaRoof?: boolean; /** Laufender Umbau zum Lokal (R-13) */ conversion?: { type: string; name: string; readyAt: string | null } }
/** Bahnstrecke: beginnt am Bahnhof, wenn einer an ihrem Ende liegt. */
export type WorldRailLine = { points: GeoPoint[]; lengthM: number; station: { name: string; at: GeoPoint } | null }
/** Freie Fläche nach Abriss eines gekauften Gebäudes. */
export type WorldPlot = { source: string; own: boolean; name: string; lat: number; lon: number; w: number; d: number; rotation: number; /** Zeitpunkt des Abrisses (Zeitregler) */ clearedAt?: string }
export type Hud = { frame: FrameSummary; rebuildsPerS: number; here: { loaded: boolean; blocks: number; built: boolean }; tiles: number; loading: number; blocks: number; lat: number; lon: number; near: string; zoom: number
  /** Gezeigter Weg zum Ziel: Länge und ob er dem Straßennetz folgt. */
  route: { lengthM: number; viaRoads: boolean } | null }

export interface WorldSettings {
  /** Kantenglättung (MSAA). Messschalter: ?aa=0 */
  antialias: boolean
  /** Höchste Pixeldichte. Messschalter: ?res=1 */
  maxResolution: number
}

export interface WorldEngineOptions {
  host: HTMLElement
  start: GeoPoint
  settings: WorldSettings
  /** Gezeichnete Bilder je Blockart (lib/worldlab/blocks.ts → blockArt). Fehlt eins, bleibt die Fläche einfarbig. */
  art?: Partial<Record<BlockKind, BlockArt>>
  loadTile: (tile: TileId) => Promise<SimplifiedTile>
  loadNoxia?: () => Promise<NoxiaBuilding[]>
  noxiaVisual?: (typeId: string) => { mapAsset?: string; mapScale?: number } | null | undefined
  onHud: (hud: Hud) => void
  /** Klick auf die Karte (kein Ziehen). */
  onPick?: (pick: WorldPick) => void
  /** Zeiger über einem Objekt (Bildschirmpunkt) oder über nichts. */
  onHover?: (hover: { pick: WorldPick; x: number; y: number } | null) => void
  onError: (message: string) => void
  /** Anfangszoom (beim Neuverankern der bisherige). */
  zoom?: number
  /** Was beschriftet wird (Straßennamen, Orte aus OSM) – `lib/worldlab/viewOptions.ts` */
  view?: ViewOptions
  /**
   * Die Figur steht zu weit vom Zeichenanker (Aufgabe 6, `lib/worldlab/reanchor.ts`).
   * Die Ansicht startet die Welt dann an `at` neu. Wird einmal je Engine gemeldet.
   */
  onFarFromAnchor?: (at: GeoPoint, zoom: number) => void
}

/** Was unter dem Zeiger lag, als geklickt wurde. */
export type WorldPick =
  | { type: 'person'; id: string }
  | { type: 'building'; at: GeoPoint; address?: string; name?: string; kind: BlockKind; noxiaId?: string; landmark?: WorldLandmark; poi?: WorldLandmark; source?: string; areaM2: number; levels: number; /** Heutige Nutzung aus OSM (Kennung, `lib/worldlab/buildingUse.ts`) */ use?: string; /** Flurstück, auf dem das Haus steht */ parcel?: string }
  | { type: 'landmark'; landmark: WorldLandmark }
  | { type: 'noxia'; noxiaId: string; at: GeoPoint }
  | { type: 'site'; id: string }
  | { type: 'plot'; source: string }
  | { type: 'parcel'; id: string; at: GeoPoint }
  | { type: 'ground'; at: GeoPoint }

/** Plakette einer Begegnungsstätte: in jeder Zoomstufe sichtbar, ein Klick öffnet den Ort. */
export interface WorldBeacon { at: GeoPoint; label?: string; pick: WorldPick; /** resonance: Begegnungsstätte (grün), worship: laufender Gottesdienst (gold) */ tone?: 'resonance' | 'worship' }

/** Baustelle (laufender Bau) auf der Karte. */
export interface WorldSite { id: string; name: string; at: GeoPoint; w: number; d: number; rotation: number; progress: number | null; phase: string }

/** Was um einen Punkt herum ist – für Gespräche und Orientierung. */
export interface WorldSurroundings { landmarks: Array<{ landmark: WorldLandmark; distanceM: number }>; water: boolean; forest: boolean; street: string | null }

type Box = { cx: number; cy: number; hw: number; hd: number; cos: number; sin: number }

/** Wahrzeichen aus den Kartendaten (Kirche, Bibliothek, Museum …). */
export interface WorldLandmark { at: GeoPoint; name: string; kind: string; tags: Record<string, string>; /** Laden oder Lokal statt Wahrzeichen */ poi?: boolean }

/** Eine Person auf der Karte. `anchor`: Haus, vor dem sie sich aufhält; sonst geht sie die Straßen entlang. */
export interface WorldPerson {
  id: string; label: string; anchor?: GeoPoint | null; /** Halbe Größe des Hauses, vor dem sie steht (m). */ anchorRadiusM?: number; tint?: number
  /** Tätigkeit: unterwegs geht man zügig, untätig langsam mit Pausen (wie in der bisherigen Erdszene). */
  activity?: 'move' | 'work' | 'idle' | 'other'
  /** Arbeitet gerade in einem betretbaren Gebäude: drinnen, auf der Karte nicht zu sehen. */
  inside?: boolean
  /** Ohne Anker: Spaziergang auf Straßen in der Nähe dieses Punkts (Wohnung) statt irgendwo. */
  strollAround?: GeoPoint | null
}

export interface WorldEngine {
  jump: (at: GeoPoint) => void
  /** Personen setzen (ersetzt die bisherige Liste). */
  setPeople: (people: WorldPerson[]) => void
  /** Wo eine Person gerade steht. */
  personAt: (id: string) => GeoPoint | null
  /** Person geht in `seconds` Sekunden zu `to` und bleibt dort, bis `release` sie freigibt. */
  sendPerson: (id: string, to: GeoPoint, seconds: number) => void
  /** Die Person geht die Straße entlang voraus (Gespräch: lead_walk). */
  leadPerson: (id: string, distanceM: number, seconds: number) => void
  releasePerson: (id: string) => void
  /** Spielfigur geht selbst zu einem Ziel, bis sie `withinM` Meter nah ist; Tasten brechen ab. */
  walkTo: (target: () => GeoPoint | null, withinM: number, onArrive?: () => void) => void
  stopWalking: () => void
  /** Tasten und Klicks der Karte an/aus (aus, solange ein Innenraum offen ist). */
  setInputEnabled: (enabled: boolean) => void
  /** Abstand der Spielfigur in Metern (zu einem Punkt oder zum Rand eines Grundrisses). */
  distanceTo: (at: GeoPoint) => number
  /** Nächste benannte Straße zur Spielfigur (für Gespräche). */
  nearestStreet: () => string | null
  /** Wo die Spielfigur steht. */
  position: () => GeoPoint
  /** Alle Kacheln verwerfen und neu holen (nach einem Nachladen von Kartendaten). */
  reloadTiles: () => void
  /** Name über der eigenen Figur. */
  setPlayerName: (name: string) => void
  /** Bahnstrecken mit Zug (Fahrplan nach Uhrzeit, siehe lib/worldlab/railLine.ts). */
  setRailLines: (lines: WorldRailLine[]) => void
  /** Zug einer Strecke, deren Bahnhof so heißt (für die Tafel des Bahnhofs). */
  trainAt: (stationName: string) => TrainState | null
  /** Freie Flächen nach Abriss: der OSM-Grundriss wird dort nicht mehr gezeichnet. */
  setPlots: (plots: WorldPlot[]) => void
  /** Zeitregler: zeigt den Stand der Abrisse zu diesem Zeitpunkt (null = jetzt). */
  setAsOf: (iso: string | null) => void
  /** Flurstücke mit Eigentümer: eigene golden umrandet, fremde blau. */
  setParcelOwners: (owners: Array<{ id: string; own: boolean }>) => void
  /** Baustellen zeigen (ersetzt die vorigen). */
  setSites: (sites: WorldSite[]) => void
  /** Plaketten der Omnizedenz-Begegnungsstätten (ersetzt die vorigen). */
  setBeacons: (beacons: WorldBeacon[]) => void
  /** Weg zu einem Ziel als Linie zeigen (null: keiner). */
  setRouteTarget: (at: GeoPoint | null) => void
  /** Wahrzeichen, Wasser, Wald und Straße um einen Punkt (nur geladene Kacheln). */
  surroundings: (at: GeoPoint, radiusM: number) => WorldSurroundings
  /** Alle Wahrzeichen der geladenen Kacheln mit Abstand zur Figur. */
  landmarks: () => Array<{ landmark: WorldLandmark; distanceM: number }>
  /** NOXIA-Gebäude neu holen (nach Kauf oder Bau). */
  reloadNoxia: () => Promise<void>
  /** Flurstück an einem Punkt (nur geladene Kacheln). */
  parcelIdAt: (at: GeoPoint) => string | null
  /** Richtung der nächsten Straße bis 50 m (Grad wie tile_entities.rotation_deg), sonst null. */
  roadAngleAt: (at: GeoPoint) => number | null
  /** Umriss eines Grundstücks zeigen, das abgesteckt wird (null: ausblenden). */
  setLandPreview: (ring: GeoPoint[] | null, ok: boolean) => void
  /** Beschriftung an/aus: Straßennamen, Orte aus OSM ohne Funktion */
  setView: (view: ViewOptions) => void
  destroy: () => void
}

// Schrägansicht 2:1, geometrisch richtig (lib/worldlab/facade.ts): ein Meter nach
// Osten geht nach rechts unten, nach Süden nach links unten, nach oben um √1,5.

// Geladen wird, was der Bildschirm zeigt – beim Herauszoomen mehr Kacheln.
// Damit das begrenzt bleibt, endet das Herauszoomen bei rund 60 Kacheln Bodenfläche.
const MAX_VIEW_TILES = 60
const PRELOAD_MARGIN = 40         // Bildeinheiten: knapp außerhalb schon laden
const HEIGHT_MARGIN = 50          // Bildeinheiten: hohe Gebäude, deren Fuß unter dem Bildrand steht
const KEEP_MARGIN_TILES = 0.6     // erst so weit außerhalb fällt eine Kachel weg
const MAX_ZOOM = 7
const LABEL_MIN_ZOOM = 1.6
const FETCHED_CACHE = 600         // so viele Kacheldaten bleiben im Speicher
// Aufbau neuer Kacheln, verteilt über mehrere Bilder: je Bild höchstens so viele
// Einheiten (ein Gebäudeblock = 1, der Boden einer Kachel = 20 + Linien/Flächen).
const BUILD_BUDGET = 80
// Tiefenstreifen: Objekte werden nach ihrer Tiefe (x + y in Metern) auf Streifen
// dieser Breite verteilt. Geht die Figur an einem Block vorbei, wird nur ihr
// Streifen neu sortiert, nicht die ganze Stadt.
const BAND_M = 32
const WALK_M_PER_S = 16
const RUN_FACTOR = 2.6

function shade(color: number, factor: number) {
  const r = Math.min(255, Math.round(((color >> 16) & 255) * factor))
  const g = Math.min(255, Math.round(((color >> 8) & 255) * factor))
  const b = Math.min(255, Math.round((color & 255) * factor))
  return (r << 16) | (g << 8) | b
}

export async function startWorldEngine(PIXI: Pixi, options: WorldEngineOptions): Promise<WorldEngine> {
  const { host, settings } = options
  let disposed = false
  const cleanup: Array<() => void> = []

  const app: Application = new PIXI.Application()
  await app.init({ resizeTo: host, background: GROUND_COLOR, antialias: settings.antialias, autoDensity: true, resolution: Math.min(settings.maxResolution, window.devicePixelRatio || 1) })
  host.appendChild(app.canvas)

  // ── Gezeichnete Bilder ──────────────────────────────────────────────
  // Vor der ersten Kachel geladen, damit kein Block erst einfarbig erscheint.
  type ArtTextures = { wallGround?: Texture; wallUpper?: Texture; roof?: Texture }
  const art = new Map<BlockKind, ArtTextures>()
  await Promise.all(Object.entries(options.art ?? {}).flatMap(([kind, paths]) =>
    (Object.entries(paths ?? {}) as Array<[keyof BlockArt, string]>).map(async ([part, src]) => {
      try {
        const texture: Texture = await PIXI.Assets.load({ src, data: { autoGenerateMipmaps: true } })
        const entry = art.get(kind as BlockKind) ?? {}
        entry[part] = texture
        art.set(kind as BlockKind, entry)
      } catch { options.onError('Bild ' + src + ' fehlt oder ist kaputt – die Fläche bleibt einfarbig.') }
    })))
  const matrix = (m: Affine) => new PIXI.Matrix(m.a, m.b, m.c, m.d, m.tx, m.ty)

  // Flächenmuster einmal je Art erzeugen (Leinwand im Browser, keine Dateien).
  const patterns = new Map<string, { texture: Texture; matrix: InstanceType<typeof PIXI.Matrix> }>()
  for (const [kind, spec] of Object.entries(AREA_PATTERNS)) {
    if (!spec) continue
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = PATTERN_PX
    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    paintPattern(ctx, spec, AREA_COLORS[kind as keyof typeof AREA_COLORS])
    patterns.set(kind, { texture: PIXI.Texture.from(canvas), matrix: matrix(patternMatrix(spec.sizeM, ISO_Y)) })
  }
  // Baumbilder (Laubbäume, Fichte).
  const treeTextures: Texture[] = []
  for (let variant = 0; variant < TREE_VARIANTS; variant++) {
    const canvas = document.createElement('canvas')
    canvas.width = TREE_PX.w; canvas.height = TREE_PX.h
    const ctx = canvas.getContext('2d')
    if (!ctx) break
    paintTree(ctx, variant)
    treeTextures.push(PIXI.Texture.from(canvas))
  }

  // ── Messung ─────────────────────────────────────────────────────────
  const stats = new FrameStats(120)
  let renderStart = 0, renderMs = 0, logicMs = 0
  app.renderer.runners.prerender.add({ prerender: () => { renderStart = performance.now() } })
  app.renderer.runners.postrender.add({ postrender: () => { renderMs = performance.now() - renderStart } })
  // Wie oft PixiJS die Zeichenliste einer Gruppe ganz neu aufbaut. Das ist der
  // teure Fall (alle Ecken neu in den Puffer); im Stand sollte er nie vorkommen.
  // Interne Schnittstelle von PixiJS 8 – fehlt sie, bleibt der Zähler auf 0.
  let rebuilds = 0
  const groupSystem = (app.renderer as unknown as { renderGroup?: { _buildInstructions?: (...args: unknown[]) => void } }).renderGroup
  const build = groupSystem?._buildInstructions
  if (groupSystem && typeof build === 'function') groupSystem._buildInstructions = function (this: unknown, ...args: unknown[]) { rebuilds++; return build.apply(this, args) }

  // ── Welt ────────────────────────────────────────────────────────────
  // Die Welt wird relativ zu einem festen Punkt gezeichnet, damit die
  // Grafikkarte mit kleinen Zahlen rechnet. Die wahre Position bleibt Mercator.
  const startGeo = options.start
  const anchorTile = tileAt(geoToMerc(startGeo))
  const anchor = tileOrigin(anchorTile)
  const k = mercPerGroundMetre(startGeo.lat)
  const toWorld = (geo: GeoPoint) => { const m = geoToMerc(geo); return { x: (m.x - anchor.x) / k, y: (anchor.y - m.y) / k } }
  const toGeo = (p: { x: number; y: number }) => mercToGeo({ x: anchor.x + p.x * k, y: anchor.y - p.y * k })
  const tileSizeM = TILE_SIZE_MERC / k

  // Zeichengruppen (render groups): Die Kamera verschiebt nur die Welt – das
  // rechnet die Grafikkarte, ohne dass Ecken neu verpackt werden. Boden und jeder
  // Tiefenstreifen der Objekte haben eine eigene Zeichenliste; ändert sich die
  // Reihenfolge in einem Streifen, bleibt alles andere unberührt.
  const world = new PIXI.Container({ isRenderGroup: true })
  const ground = new PIXI.Container({ isRenderGroup: true })
  // Straßen und Gewässer über allen Flächen: Eine später geladene Kachel darf
  // die Straßen ihrer Nachbarn nicht zudecken.
  const lines = new PIXI.Container({ isRenderGroup: true })
  const objects = new PIXI.Container({ isRenderGroup: true })
  objects.sortableChildren = true
  // Straßennamen über allem, erst ab einer Zoomstufe, in der sie lesbar sind
  // und sich nicht drängen (LABEL_MIN_ZOOM).
  const labels = new PIXI.Container({ isRenderGroup: true })
  // Baustellen und Weg zum Ziel: über den Straßen, unter Häusern und Figuren.
  const overlay = new PIXI.Container({ isRenderGroup: true })
  const poiLabels = new PIXI.Container()
  labels.addChild(poiLabels)
  // Schaltbare Beschriftung (28.10.2026): Straßennamen und Orte aus OSM ohne Funktion im Spiel
  let view: ViewOptions = { ...(options.view ?? DEFAULT_VIEW) }
  const streetNameLayer = new PIXI.Container()
  const osmLabelLayer = new PIXI.Container()
  labels.addChild(streetNameLayer, osmLabelLayer)
  /** Schilder von Orten ohne Funktion (stehen zwischen den Häusern, nicht in einer eigenen Ebene) */
  const osmBadges = new Set<Container>()
  function applyView() {
    streetNameLayer.visible = view.streetNames
    osmLabelLayer.visible = view.osmPlaces
    for (const badge of osmBadges) badge.visible = view.osmPlaces
  }
  applyView()
  // Flurstücke: Grenzen unter den Straßen, Eigentum darüber
  const parcelLayer = new PIXI.Container()
  lines.addChild(parcelLayer)
  // Ränder (Ufer, Bordstein, Gehweg, Gleise) aller Kacheln unter den Oberflächen (Wasser,
  // Fahrbahn) aller Kacheln: Straßen laufen über Kachelgrenzen, sonst legt die später
  // geladene Kachel ihren Gehweg über die Fahrbahn der Nachbarkachel.
  const edgeLayer = new PIXI.Container()
  const surfaceLayer = new PIXI.Container()
  lines.addChild(edgeLayer, surfaceLayer)
  const ownedLayer = new PIXI.Container()
  // Symbole öffentlicher Gebäude (W-7): in jeder Zoomstufe sichtbar, gleich groß auf dem Bildschirm.
  const marks = new PIXI.Container({ isRenderGroup: true })
  // Begegnungsstätten (Omnizedenz, 28.10.2026): eigene Plaketten, ebenfalls in jeder Zoomstufe.
  const beacons = new PIXI.Container({ isRenderGroup: true })
  world.addChild(ground, lines, overlay, objects, labels, marks, beacons)
  app.stage.addChild(world)

  const player = { ...toWorld(startGeo) }
  const camera = { ...player }
  // Beim Laufen näher heran (W-3: die Figur war zu klein)
  let zoom = options.zoom ?? 3.4

  const playerSprite = new PIXI.Graphics()
  // Boden-Ring: man findet sich auch zwischen Häusern (W-3)
  playerSprite.ellipse(0, 0, 4.6, 2.3).stroke({ width: 0.7, color: 0xf2c94c, alpha: 0.95 })
  playerSprite.ellipse(0, 0, 3.2, 1.6).fill({ color: 0x000000, alpha: 0.22 })
  playerSprite.roundRect(-1.6, -6.4, 3.2, 5.4, 1.4).fill(0xd7ad3c).stroke({ width: 0.5, color: 0x5c481c })
  playerSprite.circle(0, -7.6, 1.5).fill(0xf0c9a0).stroke({ width: 0.4, color: 0x5c481c })

  // Tiefenstreifen: gleiche Reihenfolge wie eine einzige sortierte Liste, weil
  // die Streifen selbst nach Tiefe geordnet sind und jedes Objekt nach seiner
  // Tiefe genau einem Streifen gehört.
  const bands = new Map<number, Container>()
  function bandFor(depth: number) {
    const index = Math.floor(depth / BAND_M)
    let band = bands.get(index)
    if (!band) {
      band = new PIXI.Container({ isRenderGroup: true })
      band.sortableChildren = true
      band.zIndex = index
      bands.set(index, band)
      objects.addChild(band)
    }
    return band
  }
  function addObject(object: Container) { bandFor(object.zIndex).addChild(object) }
  function pruneBands() {
    for (const [index, band] of bands) if (!band.children.length) { band.destroy(); bands.delete(index) }
  }
  playerSprite.scale.set(1.35)
  playerSprite.zIndex = player.x + player.y
  addObject(playerSprite)
  const playerName = new PIXI.Text({ text: '', style: { fontFamily: 'system-ui, sans-serif', fontSize: 24, fontWeight: '800', fill: 0xf3f7f8, stroke: { color: 0x173845, width: 6, join: 'round' } } })
  playerName.anchor.set(0.5, 1)
  playerName.scale.set(0.12)
  labels.addChild(playerName)
  // Weg zum Ziel und Baustellen liegen auf dem Boden, über den Straßen.
  const routeLine = new PIXI.Graphics()
  const siteLayer = new PIXI.Container()
  // Grundstück, das gerade abgesteckt wird (Landkauf ohne Kataster, 28.10.2026)
  const landPreview = new PIXI.Graphics()
  overlay.addChild(siteLayer, routeLine, landPreview)
  // Vorfeld der Anlagen; früh angelegt, weil drawFacilities schon beim ersten Aufbau läuft.
  const apronLayer = new PIXI.Container()
  let apronKey = ''

  // NOXIA-Gebäude zuerst holen, damit jede Kachel beim Aufbau weiß, welches
  // echte Gebäude einem Spieler gehört.
  type NoxiaPlaced = NoxiaBuilding & { rotation: number; x: number; y: number; claimed: boolean; stand: Container | null }
  const noxia: NoxiaPlaced[] = []
  try {
    for (const building of options.loadNoxia ? await options.loadNoxia() : []) {
      noxia.push({ ...building, rotation: Number(building.rotation ?? 0) || 0, ...toWorld({ lat: building.lat, lon: building.lon }), claimed: false, stand: null })
    }
  } catch { /* ohne Anmeldung keine NOXIA-Gebäude */ }

  // ── Kacheln ─────────────────────────────────────────────────────────
  // Eine gezeigte Kachel wird nicht in einem Bild aufgebaut, sondern Stück für
  // Stück (BUILD_BUDGET): erst der Boden, dann die Blöcke in Portionen.
  type Loaded = { tile: TileId; data: SimplifiedTile; ox: number; oy: number; ground: PixiGraphics | null; lines: PixiGraphics | null; surface: PixiGraphics | null; blocks: Container[]; trees: Container[]; labels: Container[]; footprints: Array<{ ring: Footprint; minX: number; maxX: number; minY: number; maxY: number }>; parcels: PixiGraphics | null; owned: PixiGraphics | null; done: boolean }
  const loaded = new Map<string, Loaded>()
  const fetched = new Map<string, SimplifiedTile>()
  const inFlight = new Set<string>()
  let building: string[] = []
  let generation = 0          // steigt bei reloadTiles; ältere Antworten werden verworfen
  let keepKeys = new Set<string>()

  /**
   * Ein Baukörper: Quader mit Walmdach (bei quadratischem Grundriss eine Pyramide).
   * Mitte (cx, cy) und Achsen in Bodenmetern; `eave` Traufhöhe, `roofM` Dachaufbau.
   */
  function drawMass(g: PixiGraphics, kind: BlockKind, cx: number, cy: number, hw: number, hd: number, cos: number, sin: number, eave: number, roofM: number, roofColor?: number) {
    const style = BLOCK_STYLES[kind]
    const textures = art.get(kind)
    const corner = (lx: number, ly: number) => ({ x: cx + lx * cos - ly * sin, y: cy + lx * sin + ly * cos })
    const c = [corner(-hw, -hd), corner(hw, -hd), corner(hw, hd), corner(-hw, hd)]
    const outline = { width: 0.35, color: OUTLINE, alpha: 0.7 }
    // Wände: nur die beiden, die zur Kamera zeigen.
    for (let i = 0; i < 4; i++) {
      const a = c[i], b = c[(i + 1) % 4]
      const nx = b.y - a.y, ny = -(b.x - a.x)
      if (nx + ny <= 0) continue
      const lit = nx - ny > 0
      const quad = (h0: number, h1: number) => { const a0 = iso(a.x, a.y, h0), b0 = iso(b.x, b.y, h0), a1 = iso(a.x, a.y, h1), b1 = iso(b.x, b.y, h1); return [a0.x, a0.y, b0.x, b0.y, b1.x, b1.y, a1.x, a1.y] }
      const ground = textures?.wallGround, upper = textures?.wallUpper ?? textures?.wallGround
      if (ground && upper) {
        // Bild links oben an der im Bild linken Ecke; Erdgeschoss und darüber getrennt,
        // damit das Erdgeschossbild (Tür, Sockel) nur unten erscheint.
        const [left, right] = leftToRight(a, b)
        const tint = lit ? 0xffffff : 0xd2d2d2
        const groundTop = Math.min(eave, style.storeyM)
        g.poly(quad(0, groundTop)).fill({ texture: ground, matrix: matrix(wallMatrix(left, right, groundTop)), color: tint, textureSpace: 'global' })
        if (eave > groundTop + 0.01) g.poly(quad(groundTop, eave)).fill({ texture: upper, matrix: matrix(wallMatrix(left, right, eave)), color: tint, textureSpace: 'global' })
        g.poly(quad(0, eave)).stroke(outline)
      } else {
        g.poly(quad(0, eave)).fill(lit ? style.wallLight : style.wallDark).stroke(outline)
      }
    }
    // Flachdach (Fabrik): eine Fläche, Dachbild entlang der langen Achse.
    if (roofM <= 0.01) {
      drawFlatRoof(g, kind, c, eave, { x: -sin, y: cos }, roofColor)
      return c
    }
    // Dach: Walmdach über der langen Achse; bei flachen Bauten fast eben.
    const ridgeHalf = Math.max(0, hw - hd)
    const r = [corner(-ridgeHalf, 0), corner(ridgeHalf, 0)]
    const top = eave + roofM
    const pitch = roofM / Math.max(0.5, Math.min(hw, hd))
    type Face = { pts: Array<{ x: number; y: number; h: number }>; n: { x: number; y: number }; eave: [{ x: number; y: number }, { x: number; y: number }] }
    const faces: Face[] = [
      { pts: [{ ...c[0], h: eave }, { ...c[1], h: eave }, { ...r[1], h: top }, { ...r[0], h: top }], n: { x: sin, y: -cos }, eave: [c[0], c[1]] },
      { pts: [{ ...c[2], h: eave }, { ...c[3], h: eave }, { ...r[0], h: top }, { ...r[1], h: top }], n: { x: -sin, y: cos }, eave: [c[2], c[3]] },
      { pts: [{ ...c[1], h: eave }, { ...c[2], h: eave }, { ...r[1], h: top }], n: { x: cos, y: sin }, eave: [c[1], c[2]] },
      { pts: [{ ...c[3], h: eave }, { ...c[0], h: eave }, { ...r[0], h: top }], n: { x: -cos, y: -sin }, eave: [c[3], c[0]] },
    ]
    faces.sort((a, b) => (a.n.x + a.n.y) - (b.n.x + b.n.y))
    for (const face of faces) {
      const pts = face.pts.flatMap(p => { const s = iso(p.x, p.y, p.h); return [s.x, s.y] })
      const light = 0.86 + 0.14 * Math.max(-1, Math.min(1, face.n.x - face.n.y))
      if (roofColor !== undefined) {
        g.poly(pts).fill(shade(roofColor, light)).stroke({ width: 0.3, color: OUTLINE, alpha: 0.55 })
      } else if (textures?.roof) {
        const roof = roofMatrix(face.eave[0], face.eave[1], eave, { x: -face.n.x, y: -face.n.y }, pitch)
        g.poly(pts).fill({ texture: textures.roof, matrix: matrix(roof), color: shade(0xffffff, light), textureSpace: 'global' }).stroke({ width: 0.3, color: OUTLINE, alpha: 0.55 })
      } else {
        g.poly(pts).fill(shade(style.roof, light)).stroke({ width: 0.3, color: OUTLINE, alpha: 0.55 })
      }
    }
    return c
  }

  /** Ebenes Dach auf Höhe `eave`; `inward` zeigt quer zur Längsachse (Richtung der Dachbild-Reihen). */
  function drawFlatRoof(g: PixiGraphics, kind: BlockKind, ring: Array<{ x: number; y: number }>, eave: number, inward: { x: number; y: number }, roofColor?: number) {
    const style = BLOCK_STYLES[kind]
    const pts = ring.flatMap(p => { const s = iso(p.x, p.y, eave); return [s.x, s.y] })
    const roofTexture = art.get(kind)?.roof
    const along = { x: inward.y, y: -inward.x }
    if (roofColor === undefined && roofTexture) {
      const m = roofMatrix(ring[0], { x: ring[0].x + along.x, y: ring[0].y + along.y }, eave, inward, 0)
      g.poly(pts).fill({ texture: roofTexture, matrix: matrix(m), color: 0xf2f2f2, textureSpace: 'global' })
    } else {
      g.poly(pts).fill(shade(roofColor ?? style.roof, 0.95))
    }
    g.poly(pts).stroke({ width: 0.5, color: OUTLINE, alpha: 0.6 })
  }

  /**
   * Bau mit echtem Grundriss (Hallen, Fabriken): senkrechte Wände entlang jeder
   * Kante, die zur Kamera zeigt, von hinten nach vorn gezeichnet, darüber ein
   * Flachdach. Gibt den Grundriss in Weltmetern zurück.
   */
  function drawPrism(g: PixiGraphics, kind: BlockKind, ring: Array<{ x: number; y: number }>, eave: number, inward: { x: number; y: number }, roofColor?: number) {
    const style = BLOCK_STYLES[kind]
    const textures = art.get(kind)
    let signed = 0
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) signed += (ring[j].x * ring[i].y - ring[i].x * ring[j].y)
    const outward = signed > 0 ? 1 : -1   // y zeigt nach Süden: Umlaufsinn entscheidet, wo außen ist
    const walls: Array<{ a: { x: number; y: number }; b: { x: number; y: number }; depth: number; lit: boolean }> = []
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length]
      if (a.x === b.x && a.y === b.y) continue
      const nx = (b.y - a.y) * outward, ny = -(b.x - a.x) * outward
      if (nx + ny <= 0) continue
      walls.push({ a, b, depth: (a.x + b.x + a.y + b.y) / 2, lit: nx - ny > 0 })
    }
    walls.sort((p, q) => p.depth - q.depth)
    const outline = { width: 0.35, color: OUTLINE, alpha: 0.7 }
    for (const { a, b, lit } of walls) {
      const quad = (h0: number, h1: number) => { const a0 = iso(a.x, a.y, h0), b0 = iso(b.x, b.y, h0), a1 = iso(a.x, a.y, h1), b1 = iso(b.x, b.y, h1); return [a0.x, a0.y, b0.x, b0.y, b1.x, b1.y, a1.x, a1.y] }
      const ground = textures?.wallGround, upper = textures?.wallUpper ?? textures?.wallGround
      if (ground && upper) {
        const [left, right] = leftToRight(a, b)
        const tint = lit ? 0xffffff : 0xd2d2d2
        const groundTop = Math.min(eave, style.storeyM)
        g.poly(quad(0, groundTop)).fill({ texture: ground, matrix: matrix(wallMatrix(left, right, groundTop)), color: tint, textureSpace: 'global' })
        if (eave > groundTop + 0.01) g.poly(quad(groundTop, eave)).fill({ texture: upper, matrix: matrix(wallMatrix(left, right, eave)), color: tint, textureSpace: 'global' })
        g.poly(quad(0, eave)).stroke(outline)
      } else {
        g.poly(quad(0, eave)).fill(lit ? style.wallLight : style.wallDark).stroke(outline)
      }
    }
    drawFlatRoof(g, kind, ring, eave, inward, roofColor)
    return ring
  }

  function drawBlock(block: TileBlock, ox: number, oy: number, footprints?: Loaded['footprints']) {
    const style = BLOCK_STYLES[block.k]
    const g = new PIXI.Graphics()
    let cos = Math.cos(block.a), sin = Math.sin(block.a)
    // Gezeichnet minimal kleiner als in den Kartendaten (mehr Platz zum Gehen, HOUSE_DRAW_SCALE)
    const hw = block.w / 2 * HOUSE_DRAW_SCALE, hd = block.d / 2 * HOUSE_DRAW_SCALE
    const cx = ox + block.x, cy = oy + block.y
    const realRing = block.f && block.f.length >= 8 ? Array.from({ length: block.f.length / 2 }, (_, i) => ({ x: ox + block.f![i * 2], y: oy + block.f![i * 2 + 1] })) : null
    if (realRing && realRing.length > 3 && realRing[0].x === realRing[realRing.length - 1].x && realRing[0].y === realRing[realRing.length - 1].y) realRing.pop()
    const shownRing = realRing ? scaleRing(realRing, { x: cx, y: cy }, HOUSE_DRAW_SCALE) : null
    // Steht hier ein NOXIA-Gebäude, übernimmt es den echten Grundriss: gleiche
    // Lage, Größe und Drehung wie die Nachbarn, aber sein eigenes Dach.
    // Gekaufte reale Gebäude gehören über ihre OSM-Kennung, die übrigen NOXIA-Gebäude über ihre Lage.
    const owner = (block.i ? noxia.find(building => building.source === block.i) : undefined) ?? noxiaOn(cx, cy, block.w / 2, block.d / 2, cos, sin)
    // Gekaufte reale Gebäude behalten ihr Aussehen, auch nach einem Umbau.
    // Gebäude des Ortes im realen Haus (Bank, Metropol, W-7): realer Grundriss
    // und reale Höhe, aber NOXIA-Dach, damit man sie als öffentlich erkennt.
    const look = !owner ? null
      : owner.source && !owner.public && !owner.noxiaRoof ? { ...NOXIA_DEFAULT_LOOK, roof: undefined }
        : owner.source ? { ...NOXIA_DEFAULT_LOOK, ...NOXIA_LOOKS[owner.typeId], levels: undefined }
          : { ...NOXIA_DEFAULT_LOOK, ...NOXIA_LOOKS[owner.typeId] }
    const eave = (look?.levels ?? block.l) * style.storeyM
    let c: Array<{ x: number; y: number }>
    if (shownRing) {
      c = drawPrism(g, block.k, shownRing, eave, { x: -sin, y: cos }, look?.roof)
    } else {
      c = drawMass(g, block.k, cx, cy, hw, hd, cos, sin, eave, style.roofM, look?.roof)
    }
    if (owner) claim(owner)
    if (block.k === 'church' && block.w >= 12) {
      // Kirchturm an der Stirnseite, die zur Kamera zeigt: quadratisch, mit
      // spitzem Pyramidendach – macht eine Kirche von Weitem erkennbar.
      if (cos + sin < 0) { cos = -cos; sin = -sin }
      const side = Math.min(8, Math.max(4, block.d * 0.5))
      const tx = cx + (hw - side / 2) * cos, ty = cy + (hw - side / 2) * sin
      const towerEave = eave + style.roofM + Math.max(8, side * 1.6)
      drawMass(g, block.k, tx, ty, side / 2 + 0.3, side / 2 + 0.3, cos, sin, towerEave, side * 1.8)
    }
    // Tiefe: der vorderste Fußpunkt entscheidet, was vor wem steht.
    g.zIndex = Math.max(...c.map(p => p.x + p.y))
    // Für Klicks: was dieses Gebäude ist. Ein Wahrzeichen in oder dicht an ihm
    // wird beim Klick gesucht (es kann in der Nachbarkachel liegen).
    g.eventMode = 'static'
    ;(g as unknown as { pick: WorldPick }).pick = { type: 'building', at: toGeo({ x: cx, y: cy }), address: block.h, name: block.nm, kind: block.k, noxiaId: owner?.id, source: block.i, areaM2: Math.round(block.f && block.f.length >= 8 ? polygonArea(Array.from({ length: block.f.length / 2 }, (_, i) => ({ x: block.f![i * 2], y: block.f![i * 2 + 1] }))) : block.w * block.d), levels: block.l, use: block.u }
    ;(g as unknown as { box: Box }).box = { cx, cy, hw, hd, cos, sin }
    // Hindernis für die Spielfigur: genau das gezeichnete Haus (ohne zusätzlichen Rand)
    if (footprints) {
      const ring = shownRing ?? boxFootprint(cx, cy, hw, hd, block.a, 0)
      footprints.push({ ring, minX: Math.min(...ring.map(p => p.x)), maxX: Math.max(...ring.map(p => p.x)), minY: Math.min(...ring.map(p => p.y)), maxY: Math.max(...ring.map(p => p.y)) })
    }
    return g
  }

  /** Wahrzeichen in einem Gebäude oder bis 12 m davor (Kacheln rundum). */
  function landmarkIn(box: Box, poi = false): WorldLandmark | undefined {
    const tx = anchorTile.x + Math.floor(box.cx / tileSizeM), ty = anchorTile.y + Math.floor(box.cy / tileSizeM)
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const entry = loaded.get(tileKey({ x: tx + dx, y: ty + dy }))
      for (const place of entry?.data.places ?? []) {
        if (Boolean(place.p) !== poi) continue
        const px = entry!.ox + place.x - box.cx, py = entry!.oy + place.y - box.cy
        if (Math.abs(px * box.cos + py * box.sin) <= box.hw + 12 && Math.abs(-px * box.sin + py * box.cos) <= box.hd + 12) return landmarkOf(place, entry!.ox, entry!.oy)
      }
    }
    return undefined
  }
  function landmarkOf(place: TilePlace, ox: number, oy: number): WorldLandmark {
    return { at: toGeo({ x: ox + place.x, y: oy + place.y }), name: place.n, kind: place.k, tags: place.t ?? {}, ...(place.p ? { poi: true } : {}) }
  }

  /** Linie (x/y abwechselnd, Meter) um `by` Meter seitlich versetzt (Geländer). */
  function offsetLine(flat: number[], by: number) {
    const pts: Array<{ x: number; y: number }> = []
    for (let i = 0; i + 1 < flat.length; i += 2) pts.push({ x: flat[i], y: flat[i + 1] })
    return pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]
      const length = Math.hypot(b.x - a.x, b.y - a.y) || 1
      return { x: p.x - (b.y - a.y) / length * by, y: p.y + (b.x - a.x) / length * by }
    })
  }

  function drawGround(entry: Loaded) {
    const { data, ox, oy } = entry
    const g = new PIXI.Graphics()
    const path = (flat: number[]) => { const out: number[] = []; for (let i = 0; i < flat.length; i += 2) { const s = iso(ox + flat[i], oy + flat[i + 1]); out.push(s.x, s.y) } return out }
    // Kanten, die nur durch das Zuschneiden auf die Kachel entstanden (auf dem
    // Kachelrand), bekommen keine Randlinie.
    const onBorder = (v: number) => Math.abs(v + 0.2) < 0.06 || Math.abs(v - data.size - 0.2) < 0.06
    for (const area of data.areas) {
      const p = path(area.p)
      const pattern = patterns.get(area.k)
      if (pattern) g.poly(p).fill({ texture: pattern.texture, matrix: pattern.matrix, textureSpace: 'global' })
      else g.poly(p).fill(AREA_COLORS[area.k])
      const outline = AREA_OUTLINES[area.k]
      if (!outline) continue
      for (let i = 0; i + 3 < area.p.length; i += 2) {
        const x0 = area.p[i], y0 = area.p[i + 1], x1 = area.p[i + 2], y1 = area.p[i + 3]
        if ((onBorder(x0) && onBorder(x1) && Math.abs(x0 - x1) < 0.06) || (onBorder(y0) && onBorder(y1) && Math.abs(y0 - y1) < 0.06)) continue
        g.moveTo(p[i], p[i + 1]).lineTo(p[i + 2], p[i + 3])
      }
      g.stroke({ width: outline.widthM * 0.75, color: outline.color, cap: 'square' })
    }
    const l = new PIXI.Graphics()
    const sf = new PIXI.Graphics()
    const stroke = (target: PixiGraphics, p: number[], width: number, color: number) => {
      target.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) target.lineTo(p[i], p[i + 1])
      target.stroke({ width: width * 0.75, color, cap: 'round', join: 'round' })
    }
    // Gewässer: Breite nach Art (Fluss, Bach, Graben); Ufer als erdiger Saum darunter (W-3)
    data.rivers.forEach((river, i) => {
      const width = data.rw?.[i] ?? RIVER_STYLE.widthM
      stroke(l, path(river), width + Math.min(2.6, 0.8 + width * 0.35), 0x9a8f6a)
      stroke(sf, path(river), width, RIVER_STYLE.color)
    })
    // Bürgersteige: Bordstein und Gehweg nur an Fahrstraßen (nicht an Zufahrten,
    // Parkplatzgassen, Fußgängerzonen), damit Kreuzungen als Platz ineinanderlaufen (W-3).
    for (const road of data.roads) {
      if (road.c !== 'street' && road.c !== 'main') continue
      const style = ROAD_STYLES[road.c], p = path(road.p)
      stroke(l, p, style.widthM + 4.2, 0xa39d90)
      stroke(l, p, style.widthM + 3.6, 0xd9d4c8)
    }
    for (const road of data.roads) {
      if (road.c === 'path') continue
      stroke(l, path(road.p), ROAD_STYLES[road.c].widthM + 0.5, 0x8f8a7e)
    }
    // Gleise: Schotterbett, Schwellen, zwei Schienen (unter den Straßen: Bahnübergänge)
    for (const rail of data.rails ?? []) {
      const w: Array<{ x: number; y: number }> = []
      for (let i = 0; i + 1 < rail.p.length; i += 2) w.push({ x: ox + rail.p[i], y: oy + rail.p[i + 1] })
      const bed = path(rail.p)
      l.moveTo(bed[0], bed[1]); for (let i = 2; i < bed.length; i += 2) l.lineTo(bed[i], bed[i + 1])
      l.stroke({ width: (rail.s ? 2.4 : 3.2) * 0.75, color: 0x9a8f80, cap: 'round', join: 'round' })
      for (let i = 1; i < w.length; i++) {
        const a = w[i - 1], b = w[i], length = Math.hypot(b.x - a.x, b.y - a.y)
        if (length < 0.01) continue
        const ux = (b.x - a.x) / length, uy = (b.y - a.y) / length, nx = -uy, ny = ux
        for (let t = 0.4; t < length; t += 1.4) {
          const cx = a.x + ux * t, cy = a.y + uy * t
          const s1 = iso(cx + nx * 1.25, cy + ny * 1.25), s2 = iso(cx - nx * 1.25, cy - ny * 1.25)
          l.moveTo(s1.x, s1.y).lineTo(s2.x, s2.y)
        }
        l.stroke({ width: 0.3, color: 0x6b5440 })
        for (const side of [0.72, -0.72]) {
          const r1 = iso(a.x + nx * side, a.y + ny * side), r2 = iso(b.x + nx * side, b.y + ny * side)
          l.moveTo(r1.x, r1.y).lineTo(r2.x, r2.y)
        }
        l.stroke({ width: 0.16, color: 0x3d4347 })
      }
    }
    for (const road of data.roads) stroke(sf, path(road.p), ROAD_STYLES[road.c].widthM, ROAD_STYLES[road.c].color)
    // Brücken: Schatten aufs Wasser, Fußweg seitlich, Geländer auf beiden Seiten, Fahrbahn obenauf
    for (const road of data.roads) {
      if (!road.b) continue
      const width = ROAD_STYLES[road.c].widthM, deck = road.c === 'path' ? width + 0.6 : width + 2.4
      const shadow: number[] = []
      for (let i = 0; i < road.p.length; i += 2) { const q = iso(ox + road.p[i] + 0.9, oy + road.p[i + 1] + 0.9); shadow.push(q.x, q.y) }
      sf.moveTo(shadow[0], shadow[1]); for (let i = 2; i < shadow.length; i += 2) sf.lineTo(shadow[i], shadow[i + 1])
      sf.stroke({ width: deck * 0.75, color: 0x24363d, alpha: 0.28, cap: 'butt', join: 'round' })
      stroke(sf, path(road.p), deck, 0xcfc9bd)
      for (const side of [deck / 2, -deck / 2]) {
        const rail = offsetLine(road.p, side).flatMap(q => { const v = iso(ox + q.x, oy + q.y); return [v.x, v.y] })
        sf.moveTo(rail[0], rail[1]); for (let i = 2; i < rail.length; i += 2) sf.lineTo(rail[i], rail[i + 1])
        sf.stroke({ width: 0.45, color: 0x5d6466, cap: 'butt', join: 'round' })
      }
      stroke(sf, path(road.p), width, ROAD_STYLES[road.c].color)
    }
    // Kreisverkehr: begrünte Mittelinsel mit Bordstein
    for (const island of data.islands ?? []) {
      const p = path(island)
      sf.poly(p).fill(AREA_COLORS.garden)
      sf.poly(p).stroke({ width: 0.35, color: 0xa39d90 })
    }
    for (const track of data.tracks ?? []) {
      const p = path(track)
      stroke(sf, p, TRACK_STYLE.widthM + 0.6, TRACK_STYLE.laneColor)
      stroke(sf, p, TRACK_STYLE.widthM, TRACK_STYLE.color)
      stroke(sf, p, 0.25, TRACK_STYLE.laneColor)
    }
    for (const mark of data.marks ?? []) {
      const p = path(mark)
      sf.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) sf.lineTo(p[i], p[i + 1])
      sf.stroke({ width: 0.12 * 0.75 * 4, color: 0xf2f5ec, cap: 'butt', join: 'miter' })
    }
    ground.addChild(g)
    edgeLayer.addChild(l)
    surfaceLayer.addChild(sf)
    entry.ground = g
    entry.lines = l
    entry.surface = sf
    // Flurstücksgrenzen: feine Linien unter den Straßen, erst bei näherem Hinsehen
    if (data.parcels?.length) {
      const pg = new PIXI.Graphics()
      for (const parcel of data.parcels) {
        const p = path(parcel.p)
        pg.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) pg.lineTo(p[i], p[i + 1]); pg.closePath()
      }
      pg.stroke({ width: 0.22, color: 0x4f5e46, alpha: 0.55 })
      parcelLayer.addChild(pg)
      entry.parcels = pg
      drawOwned(entry)
    }
    // Straßennamen: in Laufrichtung, Text groß gesetzt und verkleinert, damit er scharf bleibt.
    for (const label of streetLabels(data.roads, (x, y) => iso(ox + x, oy + y))) {
      const text = new PIXI.Text({ text: label.name, style: { fontFamily: 'system-ui, sans-serif', fontSize: 30, fontWeight: '600', fill: 0x3d4a52, stroke: { color: 0xf4f1e8, width: 7, join: 'round' } } })
      text.anchor.set(0.5)
      text.scale.set(0.14)
      const at = iso(ox + label.x, oy + label.y)
      text.position.set(at.x, at.y)
      text.rotation = label.angle
      streetNameLayer.addChild(text)
      entry.labels.push(text)
    }
    // Wahrzeichen: Schild mit Namen (klickbar), steht am Ort des Wahrzeichens.
    for (const place of data.places ?? []) {
      const at = iso(ox + place.x, oy + place.y)
      const badge = new PIXI.Graphics()
      if (place.p) {
        // Laden oder Lokal: kleines Schild in Blaugrün
        badge.moveTo(0, 0).lineTo(0, -4).stroke({ width: 0.4, color: 0x17313c })
        badge.roundRect(-1.8, -7.4, 3.6, 3.4, 0.8).fill(0x2f7f86).stroke({ width: 0.5, color: 0x17313c })
      } else {
        badge.moveTo(0, 0).lineTo(0, -6).stroke({ width: 0.5, color: 0x17313c })
        badge.circle(0, -8, 2.6).fill(0xf4ecd2).stroke({ width: 0.6, color: 0x17313c })
        badge.circle(0, -8, 0.9).fill(0x8a5a2b)
      }
      badge.position.set(at.x, at.y)
      badge.zIndex = ox + place.x + oy + place.y + 0.5
      badge.eventMode = 'static'
      badge.hitArea = new PIXI.Rectangle(-4, -12, 8, 13)
      ;(badge as unknown as { pick: WorldPick }).pick = { type: 'landmark', landmark: landmarkOf(place, ox, oy) }
      // Ohne Funktion im Spiel: mit „Orte aus OSM“ ausblendbar
      const functional = !place.p && placeHasFunction(place.k, place.t)
      if (!functional) {
        osmBadges.add(badge)
        badge.visible = view.osmPlaces
        badge.on('destroyed', () => osmBadges.delete(badge))
      }
      addObject(badge)
      entry.trees.push(badge)
      const name = new PIXI.Text({ text: place.n, style: { fontFamily: 'system-ui, sans-serif', fontSize: place.p ? 22 : 26, fontWeight: '700', fill: place.p ? 0x1f4f54 : 0x5a3a1c, stroke: { color: 0xf8f4e8, width: 6, join: 'round' } } })
      name.anchor.set(0.5, 1)
      name.scale.set(0.12)
      name.position.set(at.x, at.y - (place.p ? 8 : 11))
      // Läden erst bei näherem Hinsehen beschriften, sonst drängen sich die Namen.
      ;(place.p ? poiLabels : functional ? labels : osmLabelLayer).addChild(name)
      entry.labels.push(name)
    }
    // Bäume: Objekte mit Tiefe, damit sie vor und hinter Häusern stehen.
    const trees = data.trees ?? []
    if (treeTextures.length) for (let i = 0; i + 1 < trees.length; i += 2) {
      const x = ox + trees[i], y = oy + trees[i + 1]
      const sprite = new PIXI.Sprite(treeTextures[treeVariant(x, y) % treeTextures.length])
      sprite.anchor.set(0.5, (TREE_PX.h - 4) / TREE_PX.h)
      sprite.width = TREE_WORLD.w; sprite.height = TREE_WORLD.h
      const foot = iso(x, y)
      sprite.position.set(foot.x, foot.y)
      sprite.zIndex = x + y
      addObject(sprite)
      entry.trees.push(sprite)
    }
  }

  function showTile(tile: TileId, data: SimplifiedTile) {
    const key = tileKey(tile)
    if (loaded.has(key) || disposed) return
    const ox = (tile.x - anchorTile.x) * tileSizeM, oy = (tile.y - anchorTile.y) * tileSizeM
    loaded.set(key, { tile, data, ox, oy, ground: null, lines: null, surface: null, blocks: [], trees: [], labels: [], footprints: [], parcels: null, owned: null, done: false })
    building.push(key)
  }

  /** Baut je Bild ein begrenztes Stück der wartenden Kacheln. */
  function buildSome() {
    let budget = BUILD_BUDGET
    while (budget > 0 && building.length) {
      const entry = loaded.get(building[0])
      if (!entry) { building.shift(); continue }
      if (!entry.ground) {
        drawGround(entry)
        budget -= 20 + (entry.data.roads.length + entry.data.rivers.length + entry.data.areas.length) / 2 + (entry.data.trees?.length ?? 0) / 8
        continue
      }
      const from = entry.blocks.length
      const to = Math.min(entry.data.blocks.length, from + Math.max(1, Math.floor(budget)))
      if (to > from) {
        const chunk: Container[] = []
        for (let i = from; i < to; i++) {
          const block = entry.data.blocks[i]
          if (block.i && cleared.has(block.i)) continue   // abgerissen
          chunk.push(drawBlock(block, entry.ox, entry.oy, entry.footprints))
        }
        for (const block of chunk) addObject(block)
        entry.blocks.push(...chunk)
        budget -= to - from
      }
      if (entry.blocks.length >= entry.data.blocks.length) { entry.done = true; building.shift(); refreshStands() }
    }
  }

  function dropTile(key: string, entry: Loaded) {
    entry.ground?.destroy()
    entry.lines?.destroy()
    entry.surface?.destroy()
    entry.parcels?.destroy()
    entry.owned?.destroy()
    for (const tree of entry.trees) tree.destroy()
    for (const label of entry.labels) label.destroy()
    for (const block of entry.blocks) block.destroy()
    loaded.delete(key)
    pruneBands()
  }

  async function loadTile(tile: TileId) {
    const key = tileKey(tile)
    if (loaded.has(key) || inFlight.has(key)) return
    const known = fetched.get(key)
    if (known) { showTile(tile, known); return }
    inFlight.add(key)
    const asked = generation
    try {
      const data = await options.loadTile(tile)
      if (asked !== generation) return
      fetched.set(key, data)
      if (fetched.size > FETCHED_CACHE) fetched.delete(fetched.keys().next().value as string)
      // Nur zeigen, wenn die Kachel noch gebraucht wird.
      if (keepKeys.has(key)) showTile(tile, data)
    } catch (reason) {
      if (!disposed) options.onError('Kachel ' + key + ' konnte nicht geladen werden (' + String((reason as Error)?.message ?? reason) + ').')
    } finally { inFlight.delete(key) }
  }

  /** Sichtbarer Ausschnitt in Bildkoordinaten der Welt (vor Zoom und Verschiebung). */
  function viewRect(): ViewRect {
    const centre = iso(camera.x, camera.y)
    const w = app.screen.width / zoom / 2, h = app.screen.height / zoom / 2
    return { left: centre.x - w, right: centre.x + w, top: centre.y - h, bottom: centre.y + h }
  }

  let lastViewKey = ''
  function updateTiles() {
    // Nur neu rechnen, wenn Kamera, Zoom oder Fenster sich spürbar geändert haben.
    const centre = iso(camera.x, camera.y)
    const viewKey = `${Math.round(centre.x / 8)},${Math.round(centre.y / 8)},${zoom.toFixed(3)},${app.screen.width}x${app.screen.height}`
    if (viewKey === lastViewKey) return
    lastViewKey = viewKey
    const view = viewRect()
    const tileOptions = { anchorTile, tileSizeM, isoY: ISO_Y }
    // Von der Mitte nach außen laden: was nah ist, zuerst.
    const wanted = tilesForView(growView(view, PRELOAD_MARGIN, HEIGHT_MARGIN), tileOptions)
    keepKeys = new Set(tilesForView(growView(view, tileSizeM * KEEP_MARGIN_TILES * 2, HEIGHT_MARGIN), tileOptions).map(tileKey))
    for (const tile of wanted) keepKeys.add(tileKey(tile))
    for (const tile of wanted) void loadTile(tile)
    for (const [key, entry] of loaded) if (!keepKeys.has(key)) dropTile(key, entry)
    // Wartende Kacheln in derselben Reihenfolge aufbauen: nahe zuerst.
    const rank = new Map(wanted.map((tile, index) => [tileKey(tile), index]))
    building = building.filter(key => loaded.has(key)).sort((a, b) => (rank.get(a) ?? 1e9) - (rank.get(b) ?? 1e9))
  }

  /**
   * Die Spielfigur steht zwischen den Blöcken. Ihre Tiefe wird nur nachgetragen,
   * wenn sie an einem Nachbarn vorbeigeht oder den Streifen wechselt – jedes
   * Nachtragen sortiert ihren Streifen neu und baut dessen Zeichenliste neu auf.
   */
  function placePlayerDepth() {
    const depth = player.x + player.y
    const band = bandFor(depth)
    if (playerSprite.parent !== band) { playerSprite.zIndex = depth; band.addChild(playerSprite); return }
    const list = band.children
    const index = list.indexOf(playerSprite)
    const before = index > 0 ? list[index - 1].zIndex : -Infinity
    const after = index < list.length - 1 ? list[index + 1].zIndex : Infinity
    if (band.sortDirty || depth < before || depth > after) playerSprite.zIndex = depth
  }

  /**
   * Häuser, die vor der Figur gezeichnet werden und sie verdecken, werden
   * durchscheinend (sonst verschwindet sie in engen Gassen hinter der richtigen
   * Höhe). Geprüft wird alle 120 ms in den Kacheln um die Figur.
   */
  const SEE_THROUGH_ALPHA = 0.4
  const faded = new Set<Container>()
  const isoBounds = new WeakMap<Container, { minX: number; maxX: number; minY: number; maxY: number }>()
  let seeThroughAt = 0
  function updateSeeThrough(now: number) {
    if (now - seeThroughAt < 120) return
    seeThroughAt = now
    const foot = iso(player.x, player.y)
    // Figur samt Beschriftungsabstand, in Bildkoordinaten der Welt
    const left = foot.x - 2.5, right = foot.x + 2.5, top = foot.y - 10, bottom = foot.y + 1
    const depth = playerSprite.zIndex
    const now_ = new Set<Container>()
    const tx = anchorTile.x + Math.floor(player.x / tileSizeM), ty = anchorTile.y + Math.floor(player.y / tileSizeM)
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const entry = loaded.get(tileKey({ x: tx + dx, y: ty + dy }))
      if (!entry) continue
      for (const block of entry.blocks) {
        if (block.destroyed || block.zIndex <= depth) continue
        let b = isoBounds.get(block)
        if (!b) { const r = block.getLocalBounds(); b = { minX: r.minX, maxX: r.maxX, minY: r.minY, maxY: r.maxY }; isoBounds.set(block, b) }
        if (b.maxX < left || b.minX > right || b.maxY < top || b.minY > bottom) continue
        now_.add(block)
      }
    }
    for (const block of faded) if (!now_.has(block) && !block.destroyed) block.alpha = 1
    for (const block of now_) block.alpha = SEE_THROUGH_ALPHA
    faded.clear()
    for (const block of now_) faded.add(block)
  }

  // ── NOXIA-Gebäude ───────────────────────────────────────────────────
  // Ein NOXIA-Gebäude, das auf einem echten Gebäude steht, wird mit dessen
  // Grundriss gezeichnet (siehe drawBlock); das eigene Bild oder der Ersatzblock
  // tritt dann zurück. Gebäude ohne echtes Gegenstück behalten Bild oder Block.
  function noxiaOn(cx: number, cy: number, hw: number, hd: number, cos: number, sin: number) {
    for (const building of noxia) {
      const dx = building.x - cx, dy = building.y - cy
      const lx = dx * cos + dy * sin, ly = -dx * sin + dy * cos
      if (Math.abs(lx) <= hw + 2 && Math.abs(ly) <= hd + 2) return building
    }
    return null
  }
  function claim(building: NoxiaPlaced) {
    building.claimed = true
    if (building.stand) building.stand.visible = false
  }
  /** Kachel, in der ein Punkt der Welt liegt, ist fertig gezeichnet. */
  function tileDoneAt(x: number, y: number) {
    return Boolean(loaded.get(tileKey({ x: anchorTile.x + Math.floor(x / tileSizeM), y: anchorTile.y + Math.floor(y / tileSizeM) }))?.done)
  }
  /**
   * Eigener Block eines NOXIA-Gebäudes nur, wenn es kein Haus der Karte übernommen hat.
   * Gehört es zu einem realen Haus (`source`), erst wenn dessen Kachel fertig ist und
   * das Haus dort nicht vorkam – sonst blitzt der Ersatzblock kurz auf (W-7).
   */
  function standVisible(building: NoxiaPlaced) {
    return !building.claimed && (!building.source || tileDoneAt(building.x, building.y))
  }
  function refreshStands() {
    drawFacilities()
    for (const building of noxia) if (building.stand && building.source) building.stand.visible = standVisible(building)
  }
  // Namensschilder an NOXIA-Gebäuden (W-3), fremde Häuser nicht.
  const noxiaSigns: Container[] = []
  function placeSigns() {
    for (const sign of noxiaSigns.splice(0)) sign.destroy({ children: true })
    for (const mark of marks.removeChildren()) mark.destroy({ children: true })
    for (const building of noxia) {
      if (building.public) placeMark(building)
      const height = (NOXIA_LOOKS[building.typeId]?.levels ?? 2) * 3.2 + 3
      const at = iso(building.x, building.y, height)
      const sign = new PIXI.Container()
      const text = new PIXI.Text({ text: building.name, style: { fontFamily: 'system-ui, sans-serif', fontSize: 22, fontWeight: '800', fill: 0xf3e8c8 } })
      text.anchor.set(0.5, 0.5)
      text.scale.set(0.12)
      const w = text.width + 3, h = text.height + 1.6
      const plate = new PIXI.Graphics()
      plate.roundRect(-w / 2, -h / 2, w, h, 1).fill({ color: 0x173845, alpha: 0.92 }).stroke({ width: 0.3, color: 0xd9bb6a })
      sign.addChild(plate, text)
      sign.position.set(at.x, at.y)
      labels.addChild(sign)
      noxiaSigns.push(sign)
    }
  }
  /** Runde Plakette mit dem Symbol der Gebäudeart über einem öffentlichen Gebäude. */
  function placeMark(building: NoxiaPlaced) {
    const at = iso(building.x, building.y, building.source ? 12 : (NOXIA_LOOKS[building.typeId]?.levels ?? 2) * 3.2 + 6)
    const mark = new PIXI.Container()
    const disc = new PIXI.Graphics()
    disc.moveTo(0, 6).lineTo(-2.2, 2).lineTo(2.2, 2).closePath().fill(0xd9bb6a)
    disc.circle(0, -2, 5).fill({ color: 0x173845, alpha: 0.95 }).stroke({ width: 0.8, color: 0xd9bb6a })
    const glyph = new PIXI.Text({ text: publicSymbol(building.typeId), style: { fontFamily: 'system-ui, sans-serif', fontSize: 48, fontWeight: '800', fill: 0xf3e8c8 } })
    glyph.anchor.set(0.5, 0.5)
    glyph.scale.set(0.13)
    glyph.position.set(0, -2)
    mark.addChild(disc, glyph)
    mark.pivot.set(0, 6)
    mark.position.set(at.x, at.y)
    mark.scale.set(2.2 / zoom)
    mark.eventMode = 'static'
    ;(mark as unknown as { pick: WorldPick }).pick = { type: 'noxia', noxiaId: building.id, at: { lat: building.lat, lon: building.lon } }
    marks.addChild(mark)
  }
  async function placeStands(list: NoxiaPlaced[]) {
    for (const building of list) {
      if (disposed || !noxia.includes(building)) return
      const visual = options.noxiaVisual?.(building.typeId)
      const foot = iso(building.x, building.y)
      let stand: Container | null = null
      const native = nativeStandKind(building.typeId)
      if (native) stand = native === 'pad' ? drawPad(building) : drawSolar(building)
      if (!stand && visual?.mapAsset) {
        try {
          const texture = await PIXI.Assets.load({ src: visual.mapAsset, data: { resolution: 2 } })
          if (disposed) return
          const sprite = new PIXI.Sprite(texture)
          // Die Grundfläche ist echt: das Bild darf kleiner, aber nicht größer als sein Grundriss werden
          // (vorher bis 1,4-fach – die Landeplätze lagen übereinander, 27.10.2026).
          const side = (building.w + building.d) * 1.18 * Math.min(1, (visual.mapScale ?? 1.7) / 1.7)
          sprite.anchor.set(0.5, 0.86)
          sprite.width = side; sprite.height = side
          sprite.position.set(foot.x, foot.y + (building.w + building.d) / 2 * ISO_Y)
          sprite.zIndex = building.x + building.y + (building.w + building.d) / 2
          stand = sprite
        } catch { /* ohne Bild: Block */ }
      }
      if (!stand) {
        const a = building.rotation * Math.PI / 180
        const g = new PIXI.Graphics()
        const c = drawMass(g, 'hall', building.x, building.y, building.w / 2, building.d / 2, Math.cos(a), Math.sin(a), 2 * BLOCK_STYLES.hall.storeyM, BLOCK_STYLES.hall.roofM, NOXIA_DEFAULT_LOOK.roof)
        g.zIndex = Math.max(...c.map(p => p.x + p.y))
        stand = g
      }
      building.stand = stand
      stand.eventMode = 'static'
      ;(stand as unknown as { pick: WorldPick }).pick = { type: 'noxia', noxiaId: building.id, at: { lat: building.lat, lon: building.lon } }
      stand.visible = standVisible(building)
      addObject(stand)
    }
  }
  /** Landeplatz in echter Größe: Betonplattform, Warnrand, Zielkreis, Landelichter (statt eines vergrößerten Bildes). */
  function drawPad(building: NoxiaPlaced) {
    const g = new PIXI.Graphics()
    const f = { x: building.x, y: building.y, w: building.w, d: building.d, rotation: building.rotation }
    const ring = padOutline(f)
    const H = 0.9
    // Seitenwände, die zur Kamera zeigen
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length]
      const nx = b.y - a.y, ny = -(b.x - a.x)
      if (nx + ny <= 0) continue
      const pts = [iso(a.x, a.y), iso(b.x, b.y), iso(b.x, b.y, H), iso(a.x, a.y, H)].flatMap(p => [p.x, p.y])
      g.poly(pts).fill(nx - ny > 0 ? 0x7c8187 : 0x62676d).stroke({ width: 0.25, color: OUTLINE, alpha: 0.6 })
    }
    const top = (pts: readonly Pt[]) => pts.flatMap(p => { const s = iso(p.x, p.y, H); return [s.x, s.y] })
    g.poly(top(ring)).fill(0x9a9fa4).stroke({ width: 0.35, color: OUTLINE, alpha: 0.7 })
    const a = building.rotation * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a)
    const at = (lx: number, ly: number) => ({ x: f.x + lx * cos - ly * sin, y: f.y + lx * sin + ly * cos })
    const hw = f.w / 2, hd = f.d / 2
    // Plattenfugen alle 10 m
    for (let lx = -hw + 10; lx < hw; lx += 10) { const p = iso(at(lx, -hd).x, at(lx, -hd).y, H), q = iso(at(lx, hd).x, at(lx, hd).y, H); g.moveTo(p.x, p.y).lineTo(q.x, q.y) }
    for (let ly = -hd + 10; ly < hd; ly += 10) { const p = iso(at(-hw, ly).x, at(-hw, ly).y, H), q = iso(at(hw, ly).x, at(hw, ly).y, H); g.moveTo(p.x, p.y).lineTo(q.x, q.y) }
    g.stroke({ width: 0.15, color: 0x7a7f85, alpha: 0.75 })
    // Warnrand: gelb-schwarze Streifen 2 m innen
    const inner = padOutline({ ...f, w: f.w - 4, d: f.d - 4 })
    for (let i = 0; i < inner.length; i++) {
      const p0 = inner[i], p1 = inner[(i + 1) % inner.length]
      const length = Math.hypot(p1.x - p0.x, p1.y - p0.y)
      for (let t = 0, k = 0; t < length; t += 3, k++) {
        const e = Math.min(length, t + 3)
        const s = iso(p0.x + (p1.x - p0.x) * t / length, p0.y + (p1.y - p0.y) * t / length, H), u = iso(p0.x + (p1.x - p0.x) * e / length, p0.y + (p1.y - p0.y) * e / length, H)
        g.moveTo(s.x, s.y).lineTo(u.x, u.y).stroke({ width: 1.1, color: k % 2 ? 0x1d1f21 : 0xe8b923 })
      }
    }
    // Zielkreis, Kreuz und Mitte
    const r = Math.min(hw, hd) * 0.6
    const circle = (radius: number) => Array.from({ length: 48 }, (_, i) => { const t = i / 48 * Math.PI * 2; return at(Math.cos(t) * radius, Math.sin(t) * radius) })
    g.poly(top(circle(r))).fill({ color: 0x8a9095, alpha: 0.9 }).stroke({ width: 0.9, color: 0xf2f2ee })
    g.poly(top(circle(r * 0.2))).stroke({ width: 0.7, color: 0xe8b923 })
    for (const [x0, y0, x1, y1] of [[-r * 0.75, 0, r * 0.75, 0], [0, -r * 0.75, 0, r * 0.75]]) {
      const p = iso(at(x0, y0).x, at(x0, y0).y, H), q = iso(at(x1, y1).x, at(x1, y1).y, H)
      g.moveTo(p.x, p.y).lineTo(q.x, q.y).stroke({ width: 0.9, color: 0xe8b923 })
    }
    // Landelichter an den Ecken des Achtecks und auf dem Zielkreis
    for (const p of [...ring, ...circle(r).filter((_, i) => i % 6 === 0)]) {
      const s = iso(p.x, p.y, H)
      g.circle(s.x, s.y, 1.8).fill({ color: 0xffd36b, alpha: 0.22 })
      g.circle(s.x, s.y, 0.6).fill(0xffe9a8)
    }
    // Liegt ganz unten in der Tiefe: alles, was darauf steht, wird danach gezeichnet.
    g.zIndex = Math.min(...ring.map(p => p.x + p.y))
    return g
  }
  /** Solarfeld in echter Größe: Reihen geneigter Paneele (statt eines vergrößerten Bildes). */
  function drawSolar(building: NoxiaPlaced) {
    const g = new PIXI.Graphics()
    const a = building.rotation * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a)
    const hw = building.w / 2, hd = building.d / 2
    const at = (lx: number, ly: number, h = 0) => iso(building.x + lx * cos - ly * sin, building.y + lx * sin + ly * cos, h)
    const ROW = 5.5, DEPTH = 3.4
    // hintere Reihen zuerst, damit vordere sie überdecken
    for (let ly = -hd + 1; ly + DEPTH <= hd; ly += ROW) {
      // Stützen
      for (let lx = -hw + 2; lx <= hw - 2; lx += 6) { const p = at(lx, ly + DEPTH, 0), q = at(lx, ly + DEPTH, 0.5); g.moveTo(p.x, p.y).lineTo(q.x, q.y) }
      g.stroke({ width: 0.25, color: 0x5a5f63 })
      const panel = [at(-hw + 1, ly, 2.0), at(hw - 1, ly, 2.0), at(hw - 1, ly + DEPTH, 0.6), at(-hw + 1, ly + DEPTH, 0.6)].flatMap(p => [p.x, p.y])
      g.poly(panel).fill(0x223a5a).stroke({ width: 0.25, color: 0xa9bdd2 })
      for (let lx = -hw + 3; lx < hw - 1; lx += 2) { const p = at(lx, ly, 2.0), q = at(lx, ly + DEPTH, 0.6); g.moveTo(p.x, p.y).lineTo(q.x, q.y) }
      g.stroke({ width: 0.1, color: 0x6f8fb3, alpha: 0.5 })
    }
    const corners = [at(-hw, -hd), at(hw, -hd), at(hw, hd), at(-hw, hd)]
    void corners
    g.zIndex = building.x + building.y + (Math.abs(hw * cos) + Math.abs(hd * sin) + Math.abs(hw * sin) + Math.abs(hd * cos)) / 2
    return g
  }

  void placeStands(noxia)
  placeSigns()
  drawFacilities()
  /** NOXIA-Gebäude neu holen (nach Kauf oder Bau) und die Kacheln neu zeichnen. */
  async function reloadNoxia() {
    let list: NoxiaBuilding[] = []
    try { list = options.loadNoxia ? await options.loadNoxia() : [] } catch { return }
    if (disposed) return
    for (const building of noxia) building.stand?.destroy()
    noxia.length = 0
    for (const building of list) noxia.push({ ...building, rotation: Number(building.rotation ?? 0) || 0, ...toWorld({ lat: building.lat, lon: building.lon }), claimed: false, stand: null })
    reload()
    void placeStands([...noxia])
    placeSigns()
    drawFacilities()
  }
  function reload() {
    for (const [key, entry] of loaded) dropTile(key, entry)
    fetched.clear()
    inFlight.clear()
    generation++
    building = []
    lastViewKey = ''
  }

  // ── Personen ────────────────────────────────────────────────────────
  // Jede Person ist eine kleine Figur mit Beschriftung. Wer ein Zuhause oder
  // eine Arbeit in der Nähe hat, steht davor; die anderen gehen eine Straße
  // der geladenen Kacheln auf und ab. Gespräche können sie irgendwohin schicken.
  type Walker = {
    spec: WorldPerson; figure: PixiGraphics; label: InstanceType<typeof PIXI.Text>
    x: number; y: number; seed: number
    route: Array<{ x: number; y: number }> | null; routeLength: number
    /** Unterwegs zu einem Ort: Weg entlang der Straßen, Länge, Start, Dauer.
     *  `commute`: eigener Weg zum neuen Ort aus der Simulation; endet am Ziel von selbst. */
    sent: { path: Array<{ x: number; y: number }>; length: number; start: number; seconds: number; commute?: boolean } | null
    /** Zurückgelegter Weg auf der eigenen Straße (m) und Zeit des letzten Schritts */
    runM: number; lastAt: number
  }
  const walkers = new Map<string, Walker>()
  const PERSON_COLORS = [0x4f7fb3, 0xa4553f, 0x5f8f4a, 0x8a6aa8, 0x3f8f8a, 0xb08a3a]
  const hash = (text: string) => { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return h >>> 0 }
  function makeFigure(color: number) {
    const g = new PIXI.Graphics()
    g.ellipse(0, 0, 3, 1.5).fill({ color: 0x000000, alpha: 0.2 })
    g.roundRect(-1.5, -6.1, 3, 5.1, 1.3).fill(color).stroke({ width: 0.45, color: 0x2e2a24 })
    g.circle(0, -7.2, 1.4).fill(0xe8c4a0).stroke({ width: 0.4, color: 0x2e2a24 })
    g.eventMode = 'static'
    // Größer als die Figur, damit man sie auch beim Herauszoomen trifft.
    g.hitArea = new PIXI.Rectangle(-4.5, -11, 9, 13)
    g.scale.set(1.3)
    return g
  }
  /** Eine Straße für eine Person: aus den geladenen Kacheln um `base`, unter den nächsten fest nach ihrer Kennung gewählt. */
  function pickRoute(seed: number, base: { x: number; y: number } = player) {
    const near: Array<{ pts: Array<{ x: number; y: number }>; d: number }> = []
    for (const entry of loaded.values()) {
      if (Math.hypot(entry.ox + tileSizeM / 2 - base.x, entry.oy + tileSizeM / 2 - base.y) > tileSizeM * 1.6) continue
      for (const road of entry.data.roads) {
        if (road.c === 'main' || road.p.length < 4) continue
        const pts: Array<{ x: number; y: number }> = []
        for (let i = 0; i < road.p.length; i += 2) pts.push({ x: entry.ox + road.p[i], y: entry.oy + road.p[i + 1] })
        const d = Math.min(...pts.map(p => Math.hypot(p.x - base.x, p.y - base.y)))
        near.push({ pts, d })
      }
    }
    if (!near.length) return null
    // Nur die Straßen in der Nähe: so bleibt der Spaziergang im eigenen Viertel.
    near.sort((a, b) => a.d - b.d)
    const choice = near.slice(0, Math.min(6, near.length))
    return choice[seed % choice.length].pts
  }
  /** Wo eine Person an ihrem Anker steht: vor dem Haus auf der Kameraseite, ohne Wiegen. */
  function standPoint(spec: WorldPerson, seed: number) {
    if (!spec.anchor) return null
    const home = toWorld(spec.anchor)
    const out = (spec.anchorRadiusM ?? 6) + 3
    const spread = ((seed % 5) - 2) * 2.2
    return { x: home.x + out * 0.71 + spread * 0.71, y: home.y + out * 0.71 - spread * 0.71 }
  }
  /** Eigener Weg zum neuen Ort entlang der Straßen (sichtbares Pendeln, NOXIA-VISUAL-0001). */
  function startCommute(walker: Walker, to: { x: number; y: number }) {
    const from = { x: walker.x, y: walker.y }
    if (Math.hypot(to.x - from.x, to.y - from.y) <= COMMUTE_THRESHOLD_M) return
    const path = [from, ...planRoute(to, from)]
    if (Math.hypot(path[path.length - 1].x - to.x, path[path.length - 1].y - to.y) > 0.5) path.push(to)
    const length = pathLength(path)
    walker.sent = { path, length, start: performance.now(), seconds: commuteSeconds(length), commute: true }
  }
  function along(route: Array<{ x: number; y: number }>, distance: number) {
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1], b = route[i], length = Math.hypot(b.x - a.x, b.y - a.y)
      if (distance <= length) return { x: a.x + (b.x - a.x) * distance / Math.max(length, 0.001), y: a.y + (b.y - a.y) * distance / Math.max(length, 0.001) }
      distance -= length
    }
    return route[route.length - 1]
  }
  /** Tiefe eines bewegten Objekts nachtragen (wie bei der Spielfigur: nur wenn nötig). */
  function placeDepth(object: Container, depth: number) {
    const band = bandFor(depth)
    if (object.parent !== band) { object.zIndex = depth; band.addChild(object); return }
    const list = band.children, index = list.indexOf(object)
    const before = index > 0 ? list[index - 1].zIndex : -Infinity
    const after = index < list.length - 1 ? list[index + 1].zIndex : Infinity
    if (band.sortDirty || depth < before || depth > after) object.zIndex = depth
  }
  function setPeople(list: WorldPerson[]) {
    const keep = new Set(list.map(person => person.id))
    for (const [id, walker] of walkers) if (!keep.has(id)) { walker.figure.destroy(); walker.label.destroy(); walkers.delete(id) }
    for (const spec of list) {
      const known = walkers.get(spec.id)
      if (known) {
        const before = standPoint(known.spec, known.seed)
        known.spec = spec; known.label.text = spec.label
        const after = standPoint(spec, known.seed)
        // Neuer Ort aus der Simulation (z. B. Wohnung → Arbeit): hingehen statt springen.
        // Ein Weg aus einem Gespräch (Mitgehen, Hinschicken) hat Vorrang.
        if (after && (!known.sent || known.sent.commute) && (shouldCommute(before, after) || (!before && Math.hypot(after.x - known.x, after.y - known.y) > COMMUTE_THRESHOLD_M))) startCommute(known, after)
        // Kein Ort mehr (frei): neuer Spaziergang in der Nähe.
        if (!after && before) known.route = null
        continue
      }
      const seed = hash(spec.id)
      const figure = makeFigure(spec.tint ?? PERSON_COLORS[seed % PERSON_COLORS.length])
      ;(figure as unknown as { pick: WorldPick }).pick = { type: 'person', id: spec.id }
      const label = new PIXI.Text({ text: spec.label, style: { fontFamily: 'system-ui, sans-serif', fontSize: 26, fontWeight: '600', fill: 0x1f2a30, stroke: { color: 0xf8f6ef, width: 6, join: 'round' } } })
      label.anchor.set(0.5, 1)
      label.scale.set(0.12)
      labels.addChild(label)
      const start = spec.anchor ? toWorld(spec.anchor) : { x: player.x + (seed % 40) - 20, y: player.y + ((seed >> 8) % 40) - 20 }
      const walker: Walker = { spec, figure, label, x: start.x, y: start.y, seed, route: null, routeLength: 0, sent: null, runM: seed % 997, lastAt: 0 }
      walkers.set(spec.id, walker)
      placeDepth(figure, start.x + start.y)
    }
  }
  function moveWalkers(now: number) {
    for (const walker of walkers.values()) {
      let x = walker.x, y = walker.y
      if (walker.sent) {
        const t = Math.min(1, (now - walker.sent.start) / 1000 / walker.sent.seconds)
        const at = along(walker.sent.path, walker.sent.length * t)
        x = at.x; y = at.y
        // Angekommen: ab jetzt steht die Figur wieder an ihrem Ort.
        if (t >= 1 && walker.sent.commute) walker.sent = null
      } else if (walker.spec.anchor) {
        // Vor dem Haus auf der Kameraseite (Süd-Ost), nicht darin – dort sieht man sie.
        const home = toWorld(walker.spec.anchor)
        const out = (walker.spec.anchorRadiusM ?? 6) + 3
        const spread = ((walker.seed % 5) - 2) * 2.2
        const sway = now / 1000 * 0.35 + walker.seed % 7
        x = home.x + out * 0.71 + spread * 0.71 + Math.cos(sway) * 1.2
        y = home.y + out * 0.71 - spread * 0.71 + Math.sin(sway * 0.8) * 1.2
      } else {
        // Neue Straße, wenn noch keine da ist oder die Figur weit weg zurückblieb.
        // Spaziergang um die eigene Wohnung; ohne Wohnung wie bisher in Spielernähe.
        const base = walker.spec.strollAround ? toWorld(walker.spec.strollAround) : null
        if (!walker.route || (!base && Math.hypot(walker.x - player.x, walker.y - player.y) > 260)) {
          const route = pickRoute(walker.seed, base ?? player)
          if (route) {
            walker.route = route
            walker.routeLength = route.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - route[i].x, p.y - route[i].y), 0)
            // Dort weitergehen, wo die Figur gerade ist, statt ans Straßenende zu springen.
            walker.runM = distanceToNearestVertex(route, { x: walker.x, y: walker.y })
            const entry = along(route, walker.runM)
            if (walker.lastAt && Math.hypot(entry.x - walker.x, entry.y - walker.y) > COMMUTE_THRESHOLD_M) startCommute(walker, entry)
          }
        }
        if (walker.route && walker.routeLength > 1) {
          // Tempo nach Tätigkeit; wer nichts zu tun hat, bleibt immer wieder stehen.
          const activity = walker.spec.activity ?? 'other'
          const base = activity === 'move' || activity === 'work' ? 1.45 : activity === 'idle' ? 0.35 : 0.85
          const pause = activity === 'idle' && (Math.sin(now / 1000 * 0.22 + (walker.seed % 628) / 100) + 1) / 2 < 0.42
          const speed = pause ? 0 : base * (0.9 + (walker.seed % 5) * 0.05)
          const dt = walker.lastAt ? Math.min(0.25, (now - walker.lastAt) / 1000) : 0
          walker.lastAt = now
          walker.runM += speed * dt
          const run = walker.runM % (walker.routeLength * 2)
          const at = along(walker.route, run <= walker.routeLength ? run : walker.routeLength * 2 - run)
          // Auf dem Gehweg: etwas neben der Straßenmitte
          x = at.x + ((walker.seed % 2) ? 2.2 : -2.2); y = at.y + ((walker.seed % 2) ? -2.2 : 2.2)
        }
      }
      walker.x = x; walker.y = y
      const foot = iso(x, y)
      walker.figure.position.set(foot.x, foot.y)
      placeDepth(walker.figure, x + y)
      walker.label.position.set(foot.x, foot.y - 12)
      const near = Math.hypot(x - player.x, y - player.y) < 200 && !(walker.spec.inside && !walker.sent)
      walker.figure.visible = near
      walker.label.visible = near && zoom >= 2.2
    }
  }

  /** Weg entlang der nächsten Straße, vom Spieler weg, etwa `distanceM` lang. */
  function roadAhead(from: { x: number; y: number }, distanceM: number) {
    let best: { points: Array<{ x: number; y: number }>; index: number; d: number } | null = null
    for (const entry of loaded.values()) for (const road of entry.data.roads) {
      const points: Array<{ x: number; y: number }> = []
      for (let i = 0; i + 1 < road.p.length; i += 2) points.push({ x: entry.ox + road.p[i], y: entry.oy + road.p[i + 1] })
      points.forEach((p, index) => { const d = Math.hypot(p.x - from.x, p.y - from.y); if (!best || d < best.d) best = { points, index, d } })
    }
    if (!best) return []
    const { points, index } = best as { points: Array<{ x: number; y: number }>; index: number; d: number }
    // Richtung: weg vom Spieler (der folgt hinterher)
    const forward = index + 1 < points.length ? points[index + 1] : null, backward = index > 0 ? points[index - 1] : null
    const away = (p: { x: number; y: number } | null) => p ? Math.hypot(p.x - player.x, p.y - player.y) : -1
    const step = away(forward) >= away(backward) ? 1 : -1
    const out: Array<{ x: number; y: number }> = [points[index]]
    let walked = Math.hypot(points[index].x - from.x, points[index].y - from.y)
    for (let i = index + step; i >= 0 && i < points.length && walked < distanceM; i += step) {
      walked += Math.hypot(points[i].x - out[out.length - 1].x, points[i].y - out[out.length - 1].y)
      out.push(points[i])
    }
    return out
  }

  // ── Hindernisse ─────────────────────────────────────────────────────
  // Häuser der geladenen Kacheln sind Hindernisse. Geprüft werden nur die
  // Kacheln um den Punkt (ein Haus gehört der Kachel seiner Mitte, ragt aber hinaus).
  function blocked(p: { x: number; y: number }) {
    const tx = anchorTile.x + Math.floor(p.x / tileSizeM), ty = anchorTile.y + Math.floor(p.y / tileSizeM)
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const entry = loaded.get(tileKey({ x: tx + dx, y: ty + dy }))
      if (!entry) continue
      for (const f of entry.footprints) {
        if (p.x < f.minX || p.x > f.maxX || p.y < f.minY || p.y > f.maxY) continue
        if (insidePolygon(p, f.ring)) return true
      }
    }
    return false
  }
  function movePlayer(nx: number, ny: number) {
    const next = stepWithObstacles(player, { x: nx, y: ny }, blocked)
    const moved = Math.hypot(next.x - player.x, next.y - player.y)
    player.x = next.x; player.y = next.y
    return moved
  }

  // ── Selbst gehen ────────────────────────────────────────────────────
  // Nahe Ziele (unter 30 m) gerade, weite entlang der Straßen der geladenen
  // Kacheln. Bewegt sich das Ziel weit weg (Person), wird neu geplant.
  let autoWalk: { target: () => GeoPoint | null; withinM: number; onArrive?: () => void; path: Array<{ x: number; y: number }>; planFor: { x: number; y: number } | null; planAt: number; stuck: number } | null = null
  function planRoute(to: { x: number; y: number }, from: { x: number; y: number } = player) {
    if (Math.hypot(to.x - from.x, to.y - from.y) < 30) return [to]
    const graph = new RoadGraph()
    for (const entry of loaded.values()) {
      if (Math.hypot(entry.ox + tileSizeM / 2 - (from.x + to.x) / 2, entry.oy + tileSizeM / 2 - (from.y + to.y) / 2) > Math.hypot(to.x - from.x, to.y - from.y) / 2 + tileSizeM) continue
      for (const road of entry.data.roads) {
        const pts: Array<{ x: number; y: number }> = []
        for (let i = 0; i + 1 < road.p.length; i += 2) pts.push({ x: entry.ox + road.p[i], y: entry.oy + road.p[i + 1] })
        graph.addLine(pts)
      }
    }
    const route = graph.size ? graph.route({ x: from.x, y: from.y }, to) : null
    return route ? route.slice(1) : [to]
  }
  function stepAutoWalk(dt: number) {
    if (!autoWalk) return
    const target = autoWalk.target()
    if (!target) { autoWalk = null; return }
    const to = toWorld(target)
    if (Math.hypot(to.x - player.x, to.y - player.y) <= autoWalk.withinM) { const done = autoWalk.onArrive; autoWalk = null; done?.(); return }
    // Neu planen, wenn das Ziel sich bewegt hat oder (bei weiten Zielen) neue Kacheln geladen sind.
    const now = performance.now()
    if (!autoWalk.planFor || Math.hypot(to.x - autoWalk.planFor.x, to.y - autoWalk.planFor.y) > 12 || (autoWalk.path.length <= 1 && now - autoWalk.planAt > 4000)) {
      autoWalk.path = planRoute(to); autoWalk.planFor = to; autoWalk.planAt = now
    }
    let next = autoWalk.path[0] ?? to
    if (autoWalk.path.length > 1 && Math.hypot(next.x - player.x, next.y - player.y) < 1.5) { autoWalk.path.shift(); next = autoWalk.path[0] }
    if (autoWalk.path.length <= 1) next = to
    const dx = next.x - player.x, dy = next.y - player.y, distance = Math.hypot(dx, dy)
    if (distance < 0.01) return
    const step = Math.min(distance, WALK_M_PER_S * dt)
    const moved = movePlayer(player.x + dx / distance * step, player.y + dy / distance * step)
    // Hängt die Figur an einer Wand fest, den nächsten Wegpunkt nehmen.
    autoWalk.stuck = moved < step * 0.2 ? autoWalk.stuck + dt : 0
    if (autoWalk.stuck > 0.8 && autoWalk.path.length > 1) { autoWalk.path.shift(); autoWalk.stuck = 0 }
    // Ziel liegt hinter einer Wand (Schild mitten im Haus): so nah wie möglich gilt als angekommen.
    else if (autoWalk.stuck > 1.2) { const done = autoWalk.onArrive; autoWalk = null; done?.() }
  }

  // ── Weg zum Ziel ────────────────────────────────────────────────────
  // Gestrichelte Linie vom Spieler zum Ziel, entlang der Straßen; jede Sekunde neu.
  let routeTarget: GeoPoint | null = null, routeAt = 0
  let routeInfo: { lengthM: number; viaRoads: boolean } | null = null
  function updateRoute(now: number) {
    if (!routeTarget || now - routeAt < 1000) return
    routeAt = now
    const to = toWorld(routeTarget)
    const path = [{ x: player.x, y: player.y }, ...planRoute(to)]
    if (Math.hypot(path[path.length - 1].x - to.x, path[path.length - 1].y - to.y) > 1) path.push(to)
    let lengthM = 0
    routeLine.clear()
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i], length = Math.hypot(b.x - a.x, b.y - a.y)
      // Striche von 3 m mit 2 m Lücke
      for (let t = 0; t < length; t += 5) {
        const p = iso(a.x + (b.x - a.x) * t / length, a.y + (b.y - a.y) * t / length)
        const e = Math.min(length, t + 3)
        const q = iso(a.x + (b.x - a.x) * e / length, a.y + (b.y - a.y) * e / length)
        routeLine.moveTo(p.x, p.y).lineTo(q.x, q.y)
      }
      lengthM += length
    }
    routeLine.stroke({ width: 1.1, color: 0xe0b23c, alpha: 0.95, cap: 'round' })
    const end = iso(to.x, to.y)
    routeLine.circle(end.x, end.y, 2.4).stroke({ width: 0.8, color: 0xe0b23c })
    routeInfo = { lengthM: Math.round(lengthM), viaRoads: path.length > 3 }
  }

  // ── Zug ─────────────────────────────────────────────────────────────
  // Je Strecke ein Zug aus Triebwagen und zwei Wagen; Lage aus dem Fahrplan
  // (Uhrzeit), damit jeder ihn an derselben Stelle sieht.
  let railLines: WorldRailLine[] = []
  const trainCars: PixiGraphics[][] = []
  const CAR_LENGTH = 15, CAR_GAP = 1, CAR_WIDTH = 2.9, CAR_HEIGHT = 3.6
  function setTrains(list: WorldRailLine[]) {
    for (const cars of trainCars) for (const car of cars) car.destroy()
    trainCars.length = 0
    railLines = list
    for (let i = 0; i < list.length; i++) trainCars.push([0, 1, 2].map(() => { const g = new PIXI.Graphics(); g.visible = false; return g }))
  }
  function drawCar(g: PixiGraphics, cx: number, cy: number, ux: number, uy: number, body: number, roof: number, front: boolean) {
    g.clear()
    const nx = -uy, ny = ux, hl = CAR_LENGTH / 2, hw = CAR_WIDTH / 2
    const c = [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]].map(([l, w]) => ({ x: cx + ux * l + nx * w, y: cy + uy * l + ny * w }))
    const base = c.map(p => iso(p.x, p.y)), top = c.map(p => iso(p.x, p.y, CAR_HEIGHT))
    // Nur die Seiten zur Kamera (Süd-Ost): Normalen mit positivem x+y
    for (let i = 0; i < 4; i++) {
      const a = c[i], b = c[(i + 1) % 4]
      // Nach außen zeigende Richtung der Seite; sichtbar ist, was zur Kamera (x+y wächst) zeigt.
      const outX = (a.x + b.x) / 2 - cx, outY = (a.y + b.y) / 2 - cy
      if (outX + outY <= 0) continue
      const lit = outX > outY
      g.poly([base[i].x, base[i].y, base[(i + 1) % 4].x, base[(i + 1) % 4].y, top[(i + 1) % 4].x, top[(i + 1) % 4].y, top[i].x, top[i].y]).fill(lit ? body : shade(body, 0.8)).stroke({ width: 0.25, color: 0x1d2326, alpha: 0.7 })
      // Fensterband
      const w1 = 0.55, w2 = 0.8
      const lerp = (p: { x: number; y: number }, q: { x: number; y: number }, t: number) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t })
      const aw = lerp(base[i], top[i], w1), bw = lerp(base[(i + 1) % 4], top[(i + 1) % 4], w1), at = lerp(base[i], top[i], w2), bt = lerp(base[(i + 1) % 4], top[(i + 1) % 4], w2)
      g.poly([aw.x, aw.y, bw.x, bw.y, bt.x, bt.y, at.x, at.y]).fill({ color: 0x2b3c48, alpha: 0.85 })
    }
    g.poly(top.flatMap(p => [p.x, p.y])).fill(roof).stroke({ width: 0.25, color: 0x1d2326, alpha: 0.7 })
    if (front) { const f = iso(cx + ux * hl, cy + uy * hl, CAR_HEIGHT * 0.45); g.circle(f.x, f.y, 0.35).fill(0xfff3b0) }
  }
  function moveTrains() {
    const now = Date.now()
    for (let i = 0; i < railLines.length; i++) {
      const line = railLines[i], cars = trainCars[i]
      if (!line || !cars) continue
      const state = trainState(line.lengthM, now)
      // Der Triebwagen fährt vorn. Vom Bahnhof weg (und am Streckenende) liegt der Zug
      // hinter der Spitze; zum Bahnhof hin (und am Bahnhof) vor ihr.
      const away = state.direction === 1 || (state.direction === 0 && state.distanceM > 0)
      const forward = away ? 1 : -1
      const total = cars.length * CAR_LENGTH + (cars.length - 1) * CAR_GAP
      const head = away ? Math.max(total, Math.min(line.lengthM, state.distanceM)) : Math.max(0, Math.min(line.lengthM - total, state.distanceM))
      for (let k = 0; k < cars.length; k++) {
        const d = away ? head - CAR_LENGTH / 2 - k * (CAR_LENGTH + CAR_GAP) : head + CAR_LENGTH / 2 + k * (CAR_LENGTH + CAR_GAP)
        const { at, heading } = pointAlong(line.points, d)
        const p = toWorld(at)
        const car = cars[k]
        if (Math.hypot(p.x - player.x, p.y - player.y) > 450) { car.visible = false; continue }
        const ux = Math.cos(heading) * forward, uy = -Math.sin(heading) * forward
        drawCar(car, p.x, p.y, ux, uy, k === 0 ? 0xc8102e : 0xe8e2d4, k === 0 ? 0x5a5f63 : 0x8a8f92, k === 0)
        car.visible = true
        placeDepth(car, p.x + p.y + CAR_LENGTH / 2)
      }
    }
  }

  // ── Freie Flächen (nach Abriss) ─────────────────────────────────────
  let plots: WorldPlot[] = []
  let allPlots: WorldPlot[] = []
  let asOf: string | null = null
  let cleared = new Set<string>()
  /** Sichtbar sind nur Abrisse bis zum gewählten Zeitpunkt (Zeitregler, Issue #541). */
  const applyPlots = () => {
    const before = [...cleared].sort().join('|')
    plots = asOf ? allPlots.filter(plot => !plot.clearedAt || plot.clearedAt <= asOf!) : allPlots
    cleared = new Set(plots.map(plot => plot.source))
    drawPlots()
    if ([...cleared].sort().join('|') !== before) reload()
  }
  const plotLayer = new PIXI.Container()
  overlay.addChildAt(plotLayer, 0)
  overlay.addChildAt(ownedLayer, 0)
  // Vorfeld und Zaun der Anlagen (NOXIA-Gebäude ohne echtes Haus): ganz unten im Overlay.
  overlay.addChildAt(apronLayer, 0)
  /** Anlagen: nahe beieinander stehende NOXIA-Gebäude ohne echtes Haus bekommen Beton und Zaun. */
  function drawFacilities() {
    const free = noxia.filter(building => !building.source && !building.claimed)
    const key = free.map(building => building.id).sort().join(',')
    if (key === apronKey) return
    apronKey = key
    for (const child of apronLayer.removeChildren()) child.destroy({ children: true })
    const items = free.map(building => ({ x: building.x, y: building.y, w: building.w, d: building.d, rotation: building.rotation }))
    for (const group of facilityClusters(items)) {
      const members = group.map(index => items[index])
      const single = members.length === 1
      const outline = apronOutline(members, single ? 4 : 8)
      const flat = (ring: readonly Pt[], h = 0) => ring.flatMap(p => { const s = iso(p.x, p.y, h); return [s.x, s.y] })
      const g = new PIXI.Graphics()
      // Beton mit Fugen im 8-m-Raster entlang der Hülle (nur die Fläche, keine Textur)
      g.poly(flat(outline)).fill(0xb4b2a8).stroke({ width: 0.6, color: 0x77746a })
      const xs = outline.map(p => p.x), ys = outline.map(p => p.y)
      const inside = (x: number, y: number) => {
        let hit = false
        for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
          const a = outline[i], b = outline[j]
          if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) hit = !hit
        }
        return hit
      }
      for (let x = Math.ceil(Math.min(...xs) / 8) * 8; x < Math.max(...xs); x += 8) {
        for (let y = Math.min(...ys); y < Math.max(...ys); y += 2) if (inside(x, y) && inside(x, y + 2)) { const a = iso(x, y), b = iso(x, y + 2); g.moveTo(a.x, a.y).lineTo(b.x, b.y) }
      }
      for (let y = Math.ceil(Math.min(...ys) / 8) * 8; y < Math.max(...ys); y += 8) {
        for (let x = Math.min(...xs); x < Math.max(...xs); x += 2) if (inside(x, y) && inside(x + 2, y)) { const a = iso(x, y), b = iso(x + 2, y); g.moveTo(a.x, a.y).lineTo(b.x, b.y) }
      }
      g.stroke({ width: 0.18, color: 0x8f8c82, alpha: 0.7 })
      if (!single) {
        // Zaun: Pfosten alle 4 m, zwei Drähte in 1 m und 2,2 m Höhe
        for (const p of pointsAlong(outline, 4)) { const a = iso(p.x, p.y), b = iso(p.x, p.y, 2.2); g.moveTo(a.x, a.y).lineTo(b.x, b.y) }
        g.stroke({ width: 0.25, color: 0x3d4347 })
        g.poly(flat(outline, 2.2)).stroke({ width: 0.2, color: 0x4b5257, alpha: 0.9 })
        g.poly(flat(outline, 1.0)).stroke({ width: 0.15, color: 0x4b5257, alpha: 0.6 })
        // Mastleuchten alle 40 m am Zaun
        for (const p of pointsAlong(outline, 40)) {
          const foot = iso(p.x, p.y), top = iso(p.x, p.y, 7)
          g.moveTo(foot.x, foot.y).lineTo(top.x, top.y).stroke({ width: 0.3, color: 0x2f3438 })
          g.circle(top.x, top.y, 2.2).fill({ color: 0xffe2a0, alpha: 0.18 })
          g.circle(top.x, top.y, 0.7).fill(0xfff1c8)
        }
      }
      apronLayer.addChild(g)
    }
  }
  let parcelOwners = new Map<string, boolean>()
  function drawOwned(entry: Loaded) {
    entry.owned?.destroy(); entry.owned = null
    if (!parcelOwners.size || !entry.data.parcels?.length) return
    const g = new PIXI.Graphics()
    let any = false
    for (const parcel of entry.data.parcels) {
      const own = parcelOwners.get(parcel.i)
      if (own === undefined) continue
      any = true
      const pts: number[] = []
      for (let i = 0; i + 1 < parcel.p.length; i += 2) { const q = iso(entry.ox + parcel.p[i], entry.oy + parcel.p[i + 1]); pts.push(q.x, q.y) }
      g.poly(pts).fill({ color: own ? 0xf2c94c : 0x6c9bd2, alpha: 0.13 }).stroke({ width: 0.55, color: own ? 0xd9a62a : 0x4a78b0, alpha: 0.9 })
    }
    if (!any) { g.destroy(); return }
    ownedLayer.addChild(g)
    entry.owned = g
  }
  /** Flurstück an einem Weltpunkt (nur geladene Kacheln). */
  function parcelAtWorld(p: { x: number; y: number }): string | null {
    const tx = anchorTile.x + Math.floor(p.x / tileSizeM), ty = anchorTile.y + Math.floor(p.y / tileSizeM)
    const entry = loaded.get(tileKey({ x: tx, y: ty }))
    // Das kleinste Flurstück am Punkt: ein abgestecktes Teilstück geht dem Flurstück vor, in dem es liegt.
    let best: string | null = null, bestArea = Infinity
    for (const parcel of entry?.data.parcels ?? []) {
      const ring: Array<{ x: number; y: number }> = []
      for (let i = 0; i + 1 < parcel.p.length; i += 2) ring.push({ x: entry!.ox + parcel.p[i], y: entry!.oy + parcel.p[i + 1] })
      if (!insidePolygon(p, ring)) continue
      const area = Math.abs(ring.reduce((sum, a, i) => { const b = ring[(i + 1) % ring.length]; return sum + a.x * b.y - b.x * a.y }, 0)) / 2
      if (area < bestArea) { best = parcel.i; bestArea = area }
    }
    return best
  }
  function drawPlots() {
    for (const child of plotLayer.removeChildren()) child.destroy({ children: true })
    for (const plot of plots) {
      const c = toWorld({ lat: plot.lat, lon: plot.lon })
      const a = plot.rotation * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a)
      const hw = plot.w / 2, hd = plot.d / 2
      const corners = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([lx, ly]) => iso(c.x + lx * cos - ly * sin, c.y + lx * sin + ly * cos))
      const g = new PIXI.Graphics()
      g.poly(corners.flatMap(p => [p.x, p.y])).fill({ color: 0xb59a6a, alpha: plot.own ? 0.55 : 0.35 })
      for (let i = 0; i < 4; i++) {
        const p = corners[i], q = corners[(i + 1) % 4], length = Math.hypot(q.x - p.x, q.y - p.y)
        for (let t = 0; t < length; t += 3) { const e = Math.min(length, t + 1.6); g.moveTo(p.x + (q.x - p.x) * t / length, p.y + (q.y - p.y) * t / length).lineTo(p.x + (q.x - p.x) * e / length, p.y + (q.y - p.y) * e / length) }
      }
      g.stroke({ width: 0.7, color: plot.own ? 0xf3e2b0 : 0x7d6a48 })
      g.eventMode = 'static'
      ;(g as unknown as { pick: WorldPick }).pick = { type: 'plot', source: plot.source }
      plotLayer.addChild(g)
    }
  }

  // ── Baustellen ──────────────────────────────────────────────────────
  let sites: WorldSite[] = []
  function drawSites() {
    for (const child of siteLayer.removeChildren()) child.destroy({ children: true })
    for (const site of sites) {
      const c = toWorld(site.at)
      const a = site.rotation * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a)
      const hw = Math.max(4, site.w / 2), hd = Math.max(4, site.d / 2)
      const corners = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([lx, ly]) => iso(c.x + lx * cos - ly * sin, c.y + lx * sin + ly * cos))
      const g = new PIXI.Graphics()
      g.poly(corners.flatMap(p => [p.x, p.y])).fill({ color: 0xd7a941, alpha: 0.55 })
      // gestrichelter Rand
      for (let i = 0; i < 4; i++) {
        const p = corners[i], q = corners[(i + 1) % 4], length = Math.hypot(q.x - p.x, q.y - p.y)
        for (let t = 0; t < length; t += 4) { const e = Math.min(length, t + 2.5); g.moveTo(p.x + (q.x - p.x) * t / length, p.y + (q.y - p.y) * t / length).lineTo(p.x + (q.x - p.x) * e / length, p.y + (q.y - p.y) * e / length) }
      }
      g.stroke({ width: 0.8, color: 0x6e5317 })
      // Fortschrittsbalken in der Mitte
      const m = iso(c.x, c.y)
      g.roundRect(m.x - 7, m.y - 1.2, 14, 2.4, 1).fill(0x2d2410)
      if (site.progress !== null) g.roundRect(m.x - 7, m.y - 1.2, 14 * Math.max(0, Math.min(1, site.progress)), 2.4, 1).fill(0xf0d27a)
      g.eventMode = 'static'
      ;(g as unknown as { pick: WorldPick }).pick = { type: 'site', id: site.id }
      siteLayer.addChild(g)
    }
  }

  // ── Begegnungsstätten ───────────────────────────────────────────────
  let beaconList: WorldBeacon[] = []
  function drawBeacons() {
    for (const child of beacons.removeChildren()) child.destroy({ children: true })
    for (const beacon of beaconList) {
      const c = toWorld(beacon.at)
      const at = iso(c.x, c.y, 14)
      const mark = new PIXI.Container()
      const disc = new PIXI.Graphics()
      const worship = beacon.tone === 'worship'
      const rim = worship ? 0xe9c46a : 0x9fd3c0, body = worship ? 0x4a3412 : 0x1f4f54, ink = worship ? 0xfff3d6 : 0xe8f4ee
      disc.moveTo(0, 6).lineTo(-2.2, 2).lineTo(2.2, 2).closePath().fill(rim)
      disc.circle(0, -2, 5.4).fill({ color: body, alpha: 0.96 }).stroke({ width: 0.9, color: rim })
      if (worship) {
        // Glocke: läuft gerade ein Gottesdienst oder Gebet
        disc.moveTo(-2.6, 0.2).quadraticCurveTo(-2.6, -4.4, 0, -4.6).quadraticCurveTo(2.6, -4.4, 2.6, 0.2).closePath().fill(ink)
        disc.circle(0, 0.9, 0.8).fill(ink)
      } else {
        disc.circle(0, -2, 1.3).fill(ink)
        disc.circle(0, -2, 3.2).stroke({ width: 0.55, color: ink })
      }
      mark.addChild(disc)
      if (beacon.label) {
        const text = new PIXI.Text({ text: beacon.label, style: { fontFamily: 'system-ui, sans-serif', fontSize: 40, fontWeight: '800', fill: beacon.tone === 'worship' ? 0x4a3412 : 0x1f4f54, stroke: { color: 0xf4f1e8, width: 8, join: 'round' } } })
        text.anchor.set(0.5, 1)
        text.scale.set(0.11)
        text.position.set(0, -8.4)
        mark.addChild(text)
      }
      mark.pivot.set(0, 6)
      mark.position.set(at.x, at.y)
      mark.scale.set(2.6 / zoom)
      mark.eventMode = 'static'
      ;(mark as unknown as { pick: WorldPick }).pick = beacon.pick
      beacons.addChild(mark)
    }
  }

  // ── Umgebung ────────────────────────────────────────────────────────
  function surroundingsOf(p: { x: number; y: number }, radiusM: number): WorldSurroundings {
    const landmarks: WorldSurroundings['landmarks'] = []
    let water = false, forest = false, street: string | null = null, streetD = Math.min(60, radiusM)
    const near = (x: number, y: number) => Math.hypot(x - p.x, y - p.y) <= radiusM
    for (const entry of loaded.values()) {
      if (Math.abs(entry.ox + tileSizeM / 2 - p.x) > tileSizeM / 2 + radiusM || Math.abs(entry.oy + tileSizeM / 2 - p.y) > tileSizeM / 2 + radiusM) continue
      for (const place of entry.data.places ?? []) {
        const d = Math.hypot(entry.ox + place.x - p.x, entry.oy + place.y - p.y)
        if (d <= radiusM) landmarks.push({ landmark: landmarkOf(place, entry.ox, entry.oy), distanceM: d })
      }
      for (const area of entry.data.areas) {
        if ((area.k !== 'water' && area.k !== 'forest') || (area.k === 'water' ? water : forest)) continue
        const ring = Array.from({ length: area.p.length / 2 }, (_, i) => ({ x: entry.ox + area.p[i * 2], y: entry.oy + area.p[i * 2 + 1] }))
        if (insidePolygon(p, ring) || ring.some(q => near(q.x, q.y))) { if (area.k === 'water') water = true; else forest = true }
      }
      if (!water) for (const river of entry.data.rivers) for (let i = 0; i + 1 < river.length; i += 2) if (near(entry.ox + river[i], entry.oy + river[i + 1])) { water = true; break }
      for (const road of entry.data.roads) {
        if (!road.n) continue
        for (let i = 0; i + 1 < road.p.length; i += 2) {
          const d = Math.hypot(entry.ox + road.p[i] - p.x, entry.oy + road.p[i + 1] - p.y)
          if (d < streetD) { streetD = d; street = road.n }
        }
      }
    }
    landmarks.sort((a, b) => a.distanceM - b.distanceM)
    return { landmarks, water, forest, street }
  }

  // ── Klicks ──────────────────────────────────────────────────────────
  // Ein Klick ist ein Zeigerdruck ohne nennenswertes Ziehen. Getroffen wird das
  // oberste Objekt unter dem Zeiger (Person, Gebäude), sonst der Boden.
  let pressAt: { x: number; y: number } | null = null
  const pointerDown = (event: PointerEvent) => { pressAt = { x: event.offsetX, y: event.offsetY } }
  /** Objekt unter einem Bildpunkt, das eine Auswahl trägt. */
  function pickNode(x: number, y: number): Container | null {
    let node: Container | null = app.renderer.events.rootBoundary.hitTest(x, y)
    while (node && !(node as unknown as { pick?: WorldPick }).pick) node = node.parent
    return node
  }
  /** Oberstes Objekt unter einem Bildpunkt (ohne Boden). */
  function pickAt(x: number, y: number): WorldPick | null {
    const node = pickNode(x, y)
    const pick = (node as unknown as { pick?: WorldPick } | null)?.pick
    const box = (node as unknown as { box?: Box } | null)?.box
    if (pick?.type === 'building' && box) {
      const parcel = parcelAtWorld({ x: box.cx, y: box.cy })
      if (parcel) pick.parcel = parcel
      const landmark = landmarkIn(box)
      if (landmark) return { ...pick, name: landmark.name, landmark }
      const poi = landmarkIn(box, true)
      return poi ? { ...pick, poi } : pick
    }
    return pick ?? null
  }
  // Was anklickbar ist, hellt beim Überfahren auf; der Zeiger wird zur Hand (W-3).
  let hoverAt = 0, hovering = false
  let lit: Container | null = null
  const glow = new PIXI.ColorMatrixFilter()
  glow.brightness(1.22, false)
  function light(node: Container | null) {
    if (node === lit) return
    if (lit && !lit.destroyed) lit.filters = null
    lit = node
    if (node) node.filters = [glow]
    app.canvas.style.cursor = node ? 'pointer' : ''
  }
  const pointerMove = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return
    const now = performance.now()
    if (now - hoverAt < 60) return
    hoverAt = now
    const node = inputEnabled ? pickNode(event.offsetX, event.offsetY) : null
    light(node)
    if (!options.onHover) return
    const pick = node ? pickAt(event.offsetX, event.offsetY) : null
    if (pick) { hovering = true; options.onHover({ pick, x: event.clientX, y: event.clientY }) }
    else if (hovering) { hovering = false; options.onHover(null) }
  }
  const pointerLeave = () => { light(null); if (hovering) { hovering = false; options.onHover?.(null) } }
  const pointerUp = (event: PointerEvent) => {
    if (!inputEnabled) { pressAt = null; return }
    if (!pressAt || Math.hypot(event.offsetX - pressAt.x, event.offsetY - pressAt.y) > 6 || !options.onPick) { pressAt = null; return }
    pressAt = null
    const pick = pickAt(event.offsetX, event.offsetY)
    if (pick) { options.onPick(pick); return }
    // Boden: Bildpunkt → Bodenpunkt (Höhe 0)
    const centre = iso(camera.x, camera.y)
    const u = (event.offsetX - app.screen.width / 2) / zoom + centre.x, v = (event.offsetY - app.screen.height / 2) / zoom + centre.y
    const groundX = (u + v / ISO_Y) / 2, groundY = (v / ISO_Y - u) / 2
    const parcel = parcelAtWorld({ x: groundX, y: groundY })
    options.onPick(parcel ? { type: 'parcel', id: parcel, at: toGeo({ x: groundX, y: groundY }) } : { type: 'ground', at: toGeo({ x: groundX, y: groundY }) })
  }
  app.canvas.addEventListener('pointerdown', pointerDown)
  app.canvas.addEventListener('pointerup', pointerUp)
  app.canvas.addEventListener('pointermove', pointerMove)
  app.canvas.addEventListener('pointerleave', pointerLeave)

  // ── Eingabe ─────────────────────────────────────────────────────────
  // ── Zeichenanker (Aufgabe 6) ───────────────────────────────────────
  // Steht die Figur weit vom Anker, meldet die Maschine das einmal; die Ansicht
  // baut die Welt um die Figur neu auf. Beim Laufen erst im Stillstand.
  let anchorJumped = false, anchorReported = false, idleS = 0
  const lastSpot = { x: 0, y: 0 }
  function checkAnchor(dt: number) {
    if (anchorReported || !options.onFarFromAnchor) return
    idleS = Math.hypot(player.x - lastSpot.x, player.y - lastSpot.y) < 0.01 ? idleS + dt : 0
    lastSpot.x = player.x; lastSpot.y = player.y
    if (!shouldReanchor({ distanceM: Math.hypot(player.x, player.y), jumped: anchorJumped, idleS, autoWalking: autoWalk !== null })) { anchorJumped = false; return }
    anchorReported = true
    options.onFarFromAnchor(toGeo(player), zoom)
  }
  const keys = new Set<string>()
  // Pfeiltasten wie WASD
  const ARROWS: Record<string, string> = { arrowup: 'w', arrowdown: 's', arrowleft: 'a', arrowright: 'd' }
  const keyName = (event: KeyboardEvent) => { const key = event.key.toLowerCase(); return ARROWS[key] ?? key }
  let inputEnabled = true
  const down = (event: KeyboardEvent) => {
    if (!inputEnabled) return
    const target = event.target as HTMLElement | null
    if (target?.closest?.('input,textarea,select')) return
    const key = keyName(event)
    if (['w', 'a', 's', 'd', 'shift'].includes(key)) { keys.add(key); if (key !== 'shift') event.preventDefault() }
  }
  const up = (event: KeyboardEvent) => keys.delete(keyName(event))
  const blur = () => keys.clear()
  const wheel = (event: WheelEvent) => { event.preventDefault(); zoom = Math.max(minZoom(), Math.min(MAX_ZOOM, zoom * (event.deltaY > 0 ? 0.9 : 1.1))) }
  const minZoom = () => Math.min(MAX_ZOOM, minZoomForTiles(app.screen.width, app.screen.height, tileSizeM, MAX_VIEW_TILES))
  window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur)
  app.canvas.addEventListener('wheel', wheel, { passive: false })
  cleanup.push(() => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur) })

  // ── Bild für Bild ───────────────────────────────────────────────────
  let hudAt = performance.now(), hudRebuilds = 0
  app.ticker.add(ticker => {
    const logicStart = performance.now()
    stats.push({ intervalMs: ticker.deltaMS, logicMs, renderMs })
    const dt = Math.min(0.05, ticker.deltaMS / 1000)
    // Tasten wirken in Bildschirmrichtung: W läuft im Bild nach oben.
    let sx = 0, sy = 0
    if (keys.has('w')) sy -= 1
    if (keys.has('s')) sy += 1
    if (keys.has('a')) sx -= 1
    if (keys.has('d')) sx += 1
    if (sx || sy) {
      autoWalk = null
      const wx = sx + sy, wy = sy - sx
      const length = Math.hypot(wx, wy)
      const speed = WALK_M_PER_S * (keys.has('shift') ? RUN_FACTOR : 1)
      movePlayer(player.x + wx / length * speed * dt, player.y + wy / length * speed * dt)
    }
    stepAutoWalk(dt)
    checkAnchor(dt)
    moveWalkers(logicStart)
    moveTrains()
    // Die Kamera gleitet hinterher statt zu springen.
    const follow = 1 - Math.exp(-dt * 9)
    camera.x += (player.x - camera.x) * follow
    camera.y += (player.y - camera.y) * follow

    const foot = iso(player.x, player.y)
    playerSprite.position.set(foot.x, foot.y)
    placePlayerDepth()
    updateSeeThrough(logicStart)
    playerName.position.set(foot.x, foot.y - 13)
    updateRoute(logicStart)
    // Ein größer gezogenes Fenster kann den Zoom nach innen schieben.
    zoom = Math.max(zoom, minZoom())
    labels.visible = zoom >= LABEL_MIN_ZOOM
    for (const mark of marks.children) mark.scale.set(2.2 / zoom)
    for (const beacon of beacons.children) beacon.scale.set(2.6 / zoom)
    poiLabels.visible = zoom >= 2.4 && view.osmPlaces
    parcelLayer.visible = zoom >= 2.2
    const centre = iso(camera.x, camera.y)
    world.scale.set(zoom)
    world.position.set(app.screen.width / 2 - centre.x * zoom, app.screen.height / 2 - centre.y * zoom)
    updateTiles()
    buildSome()

    if (logicStart - hudAt > 250) {
      const seconds = (logicStart - hudAt) / 1000
      hudAt = logicStart
      const geo = toGeo(player)
      let near = '', best = 60
      for (const building of noxia) { const d = Math.hypot(building.x - player.x, building.y - player.y); if (d < best) { best = d; near = building.name + ' · ' + Math.round(d) + ' m' } }
      let blocks = 0
      for (const entry of loaded.values()) blocks += entry.blocks.length
      const rebuildsPerS = (rebuilds - hudRebuilds) / seconds
      hudRebuilds = rebuilds
      const hereTile = loaded.get(tileKey(tileAt(geoToMerc(geo))))
      const here = { loaded: Boolean(hereTile?.done), blocks: hereTile?.data.blocks.length ?? 0, built: Boolean(hereTile?.data.areas.some(area => area.k === 'built' || area.k === 'garden')) }
      options.onHud({ frame: stats.summary(), rebuildsPerS, here, tiles: loaded.size, loading: inFlight.size + building.length, blocks, lat: geo.lat, lon: geo.lon, near, zoom, route: routeInfo })
    }
    logicMs = performance.now() - logicStart
  })

  return {
    jump(at) {
      const p = toWorld(at)
      player.x = p.x; player.y = p.y; camera.x = p.x; camera.y = p.y
      lastViewKey = ''
      anchorJumped = true
    },
    position: () => toGeo(player),
    setPeople,
    personAt(id) { const walker = walkers.get(id); return walker && !(walker.spec.inside && !walker.sent) ? toGeo(walker) : null },
    leadPerson(id, distanceM, seconds) {
      const walker = walkers.get(id)
      if (!walker) return
      const path = [{ x: walker.x, y: walker.y }, ...roadAhead({ x: walker.x, y: walker.y }, distanceM)]
      const length = path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - path[i].x, p.y - path[i].y), 0)
      if (length < 1) return
      walker.sent = { path, length, start: performance.now(), seconds: Math.max(3, seconds) }
    },
    sendPerson(id, to, seconds) {
      const walker = walkers.get(id)
      if (!walker) return
      // Entlang der Straßen statt quer durch Häuser; weitere Wege dauern entsprechend länger.
      const from = { x: walker.x, y: walker.y }
      const path = [from, ...planRoute(toWorld(to), from)]
      const length = path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - path[i].x, p.y - path[i].y), 0)
      const straight = Math.hypot(path[path.length - 1].x - from.x, path[path.length - 1].y - from.y) || 1
      walker.sent = { path, length, start: performance.now(), seconds: Math.max(1, seconds) * Math.min(3, Math.max(1, length / straight)) }
    },
    releasePerson(id) {
      const walker = walkers.get(id)
      if (!walker) return
      walker.sent = null
      // Nach dem Gespräch zurück an den eigenen Ort gehen, nicht dorthin springen.
      const back = standPoint(walker.spec, walker.seed)
      if (back) startCommute(walker, back)
    },
    walkTo(target, withinM, onArrive) { autoWalk = { target, withinM, onArrive, path: [], planFor: null, planAt: 0, stuck: 0 } },
    setPlayerName(name) { playerName.text = name.slice(0, 40) },
    setSites(list) { sites = list; drawSites() },
    setBeacons(list) { beaconList = list; drawBeacons() },
    setRailLines(list) { setTrains(list) },
    trainAt(stationName) { const line = railLines.find(item => item.station?.name === stationName); return line ? trainState(line.lengthM, Date.now()) : null },
    setParcelOwners(list) {
      parcelOwners = new Map(list.map(item => [item.id, item.own]))
      for (const entry of loaded.values()) drawOwned(entry)
    },
    setPlots(list) { allPlots = list; applyPlots() },
    setAsOf(iso) { asOf = iso; applyPlots() },
    setRouteTarget(at) { routeTarget = at; routeAt = 0; if (!at) { routeLine.clear(); routeInfo = null } },
    surroundings(at, radiusM) { return surroundingsOf(toWorld(at), radiusM) },
    landmarks() {
      const out: Array<{ landmark: WorldLandmark; distanceM: number }> = []
      for (const entry of loaded.values()) for (const place of entry.data.places ?? []) {
        out.push({ landmark: landmarkOf(place, entry.ox, entry.oy), distanceM: Math.hypot(entry.ox + place.x - player.x, entry.oy + place.y - player.y) })
      }
      return out
    },
    stopWalking() { autoWalk = null },
    setInputEnabled(enabled) { inputEnabled = enabled; if (!enabled) { keys.clear(); autoWalk = null } },
    distanceTo(at) { const p = toWorld(at); return Math.hypot(p.x - player.x, p.y - player.y) },
    nearestStreet() {
      let best: string | null = null, bestD = 60
      for (const entry of loaded.values()) for (const road of entry.data.roads) {
        if (!road.n) continue
        for (let i = 0; i + 1 < road.p.length; i += 2) {
          const d = Math.hypot(entry.ox + road.p[i] - player.x, entry.oy + road.p[i + 1] - player.y)
          if (d < bestD) { bestD = d; best = road.n }
        }
      }
      return best
    },
    reloadTiles: reload,
    parcelIdAt(at) { return parcelAtWorld(toWorld(at)) },
    setView(next) { view = { ...next }; applyView() },
    roadAngleAt(at) {
      const p = toWorld(at)
      let best: { d: number; angle: number } | null = null
      for (const entry of loaded.values()) for (const road of entry.data.roads) {
        if (road.c === 'path') continue
        for (let i = 0; i + 3 < road.p.length; i += 2) {
          const a = { x: entry.ox + road.p[i], y: entry.oy + road.p[i + 1] }, b = { x: entry.ox + road.p[i + 2], y: entry.oy + road.p[i + 3] }
          const dx = b.x - a.x, dy = b.y - a.y, len = dx * dx + dy * dy
          if (!len) continue
          const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len))
          const d = Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
          if (d < 50 && (!best || d < best.d)) best = { d, angle: Math.atan2(dy, dx) * 180 / Math.PI }
        }
      }
      // Halbkreis: längliche Stücke liegen mit der Breite an der Straße
      return best ? Math.round(((best.angle % 180) + 180) % 180) : null
    },
    setLandPreview(ring, ok) {
      landPreview.clear()
      if (!ring || ring.length < 3) return
      const pts: number[] = []
      for (const point of ring) { const w = toWorld(point), q = iso(w.x, w.y); pts.push(q.x, q.y) }
      landPreview.poly(pts).fill({ color: ok ? 0xf2c94c : 0xd9534f, alpha: 0.18 }).stroke({ width: 0.8, color: ok ? 0xd9a62a : 0xb03a36, alpha: 0.95 })
    },
    reloadNoxia,
    destroy() {
      disposed = true
      app.canvas.removeEventListener('pointerdown', pointerDown)
      app.canvas.removeEventListener('pointerup', pointerUp)
      app.canvas.removeEventListener('pointermove', pointerMove)
      app.canvas.removeEventListener('pointerleave', pointerLeave)
      for (const run of cleanup) run()
      try { app.destroy(true, { children: true }) } catch { /* schon weg */ }
    },
  }
}
