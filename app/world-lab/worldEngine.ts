// app/world-lab/worldEngine.ts
// Aktualisiert: 06.11.2026 — Busse nach Fahrplan auf OSM-Buslinien (setBusLines, busAt); Echter Verkehr: Personen mit Auto fahren ihren Arbeitsweg sichtbar über die Straßen; eigene Fahrt als Fahrt (driveTo) statt Sprung; geparktes eigenes Auto (setOwnVehicle)
// Version:      1.2.0
// Prototyp „eine Welt“ mit PixiJS – die Zeichenmaschine ohne React.
//
// WorldLab.tsx stellt nur Bühne und Anzeige; Kacheln, NOXIA-Gebäude und Bilder
// kommen über die Optionen herein. So lässt sich dieselbe Maschine auch ohne
// Anmeldung und Datenbank mit Testkacheln messen.

import type { Application, Container, Graphics as PixiGraphics, Sprite, Texture } from 'pixi.js'
import { geoToMerc, mercPerGroundMetre, mercToGeo, tileAt, tileKey, tileOrigin, TILE_SIZE_MERC, type GeoPoint, type TileId } from '@/lib/worldlab/mercator'
import { heightTint, terrainShade, type TileTerrainPart } from '@/lib/worldlab/terrain'
import { shouldReanchor } from '@/lib/worldlab/reanchor'
import { KIESEL_POSES, kieselDirFrom, kieselSVG, type KieselDir, type KieselLook, type KieselPose } from '@/lib/figures/kiesel'
import { hasSpires, roofRegion, ROOF_FACTOR } from '@/lib/worldlab/roofRegion'
import { effectivePlaceKind, isTravelPlace } from '@/lib/worldlab/landmarks'
import { DEFAULT_VIEW, placeHasFunction, type ViewOptions } from '@/lib/worldlab/viewOptions'
import { ANCHOR_VISIBLE_MAX, COMMUTE_THRESHOLD_M, anchorSpread, commuteSeconds, distanceToNearestVertex, pathLength, shouldCommute, VISIBLE_WALK_MAX_M } from '@/lib/game/population/visibleMovement'
import { AREA_COLORS, AREA_OUTLINES, AREA_PATTERNS, BLOCK_STYLES, TRACK_STYLE, NOXIA_DEFAULT_LOOK, NOXIA_LOOKS, publicSymbol, type BlockArt, GROUND_COLOR, OUTLINE, RIVER_STYLE, ROAD_STYLES } from '@/lib/worldlab/blocks'
import { iso, ISO_HEIGHT, ISO_Y, leftToRight, roofMatrix, wallMatrix, type Affine } from '@/lib/worldlab/facade'
import { paintPattern, patternMatrix, PATTERN_PX } from '@/lib/worldlab/areaPatterns'
import { streetLabels } from '@/lib/worldlab/streetLabels'
import { boxFootprint, distanceToRing, HOUSE_DRAW_SCALE, WALK_CORE_SCALE, insidePolygon, RoadGraph, scaleRing, stepWithObstacles, type Footprint } from '@/lib/worldlab/walking'
import { pointAlong, trainState, type TrainState } from '@/lib/worldlab/railLine'
import { busState, type BusLine, type BusState } from '@/lib/worldlab/busLine'
import { paintPlant, plantTextureKey, TREE_BASE_HEIGHT_M, TREE_PX, TREE_WORLD } from '@/lib/worldlab/treeSprites'
import { foliage, plantDay, plantRegion, PLANTS, type PlantId, type PlantRegion } from '@/lib/worldlab/plants'
import { plantSpots, type PlantSpot } from '@/lib/worldlab/plantPlacement'
import { FrameStats, type FrameSummary } from '@/lib/worldlab/frameStats'
import type { BlockKind, SimplifiedTile, TileBlock, TilePlace } from '@/lib/worldlab/simplify'
import { polygonArea } from '@/lib/worldlab/simplify'
import { graveSpots } from '@/lib/worldlab/graves'
import { dayTint, hasChimney, hasSolar, heatingSeason, seeded, sunElevationDeg, windowLit } from '@/lib/worldlab/ambient'
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
  /** Mitspieler (W-16): andere Spieler in der Nähe */
  | { type: 'peer'; id: string; name: string }
  | { type: 'building'; at: GeoPoint; address?: string; name?: string; kind: BlockKind; noxiaId?: string; landmark?: WorldLandmark; poi?: WorldLandmark; source?: string; areaM2: number; levels: number; /** Heutige Nutzung aus OSM (Kennung, `lib/worldlab/buildingUse.ts`) */ use?: string; /** Flurstück, auf dem das Haus steht */ parcel?: string }
  | { type: 'landmark'; landmark: WorldLandmark }
  | { type: 'noxia'; noxiaId: string; at: GeoPoint }
  | { type: 'site'; id: string }
  | { type: 'plot'; source: string }
  | { type: 'parcel'; id: string; at: GeoPoint }
  | { type: 'ground'; at: GeoPoint }
  /** Baum oder Strauch (05.11.2026): Art, und woher wir sie kennen */
  | { type: 'plant'; at: GeoPoint; species: PlantId; source: 'osm-species' | 'osm' | 'estimate'; region: PlantRegion; hint?: string }

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
  /** W-17: Aussehen als Kiesel-Figur (`kieselLookFor`); fehlt es, die einfache Figur. */
  look?: KieselLook
  /** Arbeitspose vor dem Arbeitsort (`workPoseFor`), solange die Figur dort steht. */
  pose?: KieselPose | null
  /** Besitzt ein Auto: weite Wege fährt die Person sichtbar über die Straßen statt unsichtbar. */
  vehicle?: boolean
}

export interface WorldEngine {
  jump: (at: GeoPoint) => void
  /** Personen setzen (ersetzt die bisherige Liste). */
  setPeople: (people: WorldPerson[]) => void
  /** Wo eine Person gerade steht. */
  personAt: (id: string) => GeoPoint | null
  /** Sprechblase über einer Person zeigen (Text) oder entfernen (null). */
  speak: (id: string, text: string | null) => void
  /** Person geht in `seconds` Sekunden zu `to` und bleibt dort, bis `release` sie freigibt. */
  sendPerson: (id: string, to: GeoPoint, seconds: number) => void
  /** Die Person geht die Straße entlang voraus (Gespräch: lead_walk). */
  leadPerson: (id: string, distanceM: number, seconds: number) => void
  releasePerson: (id: string) => void
  /** Spielfigur geht selbst zu einem Ziel, bis sie `withinM` Meter nah ist; Tasten brechen ab. */
  walkTo: (target: () => GeoPoint | null, withinM: number, onArrive?: () => void) => void
  stopWalking: () => void
  /** Spielfigur fährt mit dem eigenen Auto über die Straßen zum Ziel; am Ende bleibt das Auto dort stehen. */
  driveTo: (target: () => GeoPoint | null, withinM: number, onArrive?: () => void) => void
  /** Geparktes eigenes Auto (aus der Datenbank), null = keins. */
  setOwnVehicle: (at: GeoPoint | null) => void
  /** Länge des Straßenwegs vom Spieler zum Ziel in Metern, null wenn kein Straßenweg in den geladenen Kacheln. */
  roadRouteLengthM: (to: GeoPoint) => number | null
  /** Tasten und Klicks der Karte an/aus (aus, solange ein Innenraum offen ist). */
  setInputEnabled: (enabled: boolean) => void
  /** Abstand der Spielfigur in Metern (zu einem Punkt oder zum Rand eines Grundrisses). */
  distanceTo: (at: GeoPoint) => number
  /** Abstand zum Ort: steht der Punkt in einem Haus (Kirche, Bibliothek), zählt der Abstand zur Hauswand. */
  distanceToPlace: (at: GeoPoint) => number
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
  /** Buslinien mit Fahrplan (aus /api/world-lab/bus). */
  setBusLines: (lines: BusLine[]) => void
  busAt: (lineId: string) => BusState | null
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
  /** Ist die Kachel an diesem Punkt fertig gezeichnet? */
  tileReadyAt: (at: GeoPoint) => boolean
  /** Richtung der nächsten Straße bis 50 m (Grad wie tile_entities.rotation_deg), sonst null. */
  roadAngleAt: (at: GeoPoint) => number | null
  /** Umriss eines Grundstücks zeigen, das abgesteckt wird (null: ausblenden). */
  setLandPreview: (ring: GeoPoint[] | null, ok: boolean) => void
  /** Beschriftung an/aus: Straßennamen, Orte aus OSM ohne Funktion */
  setView: (view: ViewOptions) => void
  /** W-17: Aussehen der eigenen Figur (Kiesel, wie in den Innenräumen). */
  setPlayerLook: (look: KieselLook) => void
  /** W-16: Mitspieler in der Nähe (ersetzt die bisherige Liste); `emote` erscheint als kurze Blase. */
  setPeers: (peers: Array<{ id: string; name: string; at: GeoPoint; look: KieselLook | null; emote?: string | null }>) => void
  /** Wo ein Mitspieler gerade steht. */
  peerAt: (id: string) => GeoPoint | null
  /** Kurze Blase über der eigenen Figur (eigene Geste, z. B. „winkt“), verschwindet nach 4 s. */
  playerEmote: (text: string) => void
  /** W-18: Veranstaltungen als Zeichen über dem Lokal (Zeichen und Uhrzeit, immer sichtbar). */
  setEventMarks: (marks: Array<{ id: string; lat: number; lon: number; text: string; running: boolean }>) => void
  /** Erster Start: hüpfender Pfeil über einem Ziel (null: keiner). */
  setGuideArrow: (at: GeoPoint | null) => void
  /** W-12: Ziel einer Vermittlung – Schild über dem Lokal (null: keins). */
  setJobMark: (mark: { at: GeoPoint; text: string } | null) => void
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
/** Autos: Personen der Simulation und die Spielfigur. Die Figur geht 16 m/s, Autos fahren zügiger. */
const NPC_DRIVE_M_PER_S = 22
const DRIVE_M_PER_S = 34
type VehicleDims = { length: number; width: number; height: number }
const PRIVATE_CAR: VehicleDims = { length: 4.4, width: 1.8, height: 1.5 }
const CAR_COLORS = [0xd8d4cc, 0x2f3a44, 0x8c1d2b, 0x2a4d7a, 0x5a6b5a, 0xb9b1a3, 0x1f1f22, 0xc9a24a, 0x6b7d8f, 0xe6e2da]
function carColorFor(seed: number) { return CAR_COLORS[seed % CAR_COLORS.length] }
/** Fahrtrichtung aus zwei Punkten; steht das Fahrzeug, die vorige Richtung behalten. */
function headingOf(px: number, py: number, ax: number, ay: number, x: number, y: number) {
  let dx = ax - x, dy = ay - y
  if (Math.hypot(dx, dy) < 0.05) { dx = x - px; dy = y - py }
  const length = Math.hypot(dx, dy)
  return length < 0.001 ? { ux: 0.71, uy: 0.71 } : { ux: dx / length, uy: dy / length }
}

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
  // Baum- und Strauchbilder je Art und heutigem Laub, bei Bedarf gezeichnet (05.11.2026)
  const plantTextures = new Map<string, Texture>()
  let plantDayNow = plantDay(Date.now(), options.start.lat)
  function plantTexture(id: PlantId, region: PlantRegion): Texture | null {
    const species = PLANTS[id], f = foliage(species, plantDayNow, region)
    const key = plantTextureKey(species, f)
    let texture = plantTextures.get(key)
    if (!texture) {
      const canvas = document.createElement('canvas')
      canvas.width = TREE_PX.w; canvas.height = TREE_PX.h
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      paintPlant(ctx, species, f)
      texture = PIXI.Texture.from(canvas)
      plantTextures.set(key, texture)
    }
    return texture
  }
  /** Bildgröße einer Pflanze gegenüber TREE_WORLD (12 m Baum) */
  function plantSize(spot: PlantSpot) {
    const species = PLANTS[spot.species]
    if (species.form === 'bush' || species.form === 'hedge') return 0.55 * spot.scale
    return Math.max(0.55, Math.min(1.8, species.heightM / TREE_BASE_HEIGHT_M * spot.scale))
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
  // W-18: Veranstaltungen – eigene Ebene, damit placeSigns sie nicht wegräumt
  const eventLayer = new PIXI.Container()
  // Begegnungsstätten (Omnizedenz, 28.10.2026): eigene Plaketten, ebenfalls in jeder Zoomstufe.
  const beacons = new PIXI.Container({ isRenderGroup: true })
  // Rauch aus Schornsteinen: eine Fläche über den Dächern, nur nahe der Kamera neu gezeichnet
  const smoke = new PIXI.Graphics()
  smoke.eventMode = 'none'
  // Erster Start (05.11.2026): Pfeil über dem ersten Ziel
  const guideLayer = new PIXI.Container()
  guideLayer.eventMode = 'none'
  // W-12: Schild über dem Lokal, in das die Agentur vermittelt hat
  const jobLayer = new PIXI.Container()
  jobLayer.eventMode = 'none'
  world.addChild(ground, lines, overlay, objects, smoke, labels, marks, beacons, eventLayer, jobLayer, guideLayer)
  // Tageszeit nach echtem Sonnenstand am Ort der Figur (Spieluhr = echte Zeit)
  let sunNow = 30
  let worldTint = 0xffffff
  const windowLights = new Map<Container, { key: string; lon: number }>()
  app.stage.addChild(world)

  const player = { ...toWorld(startGeo) }
  const camera = { ...player }
  // Beim Laufen näher heran (W-3: die Figur war zu klein)
  let zoom = options.zoom ?? 3.4

  const playerSprite = new PIXI.Container()
  // Boden-Ring: man findet sich auch zwischen Häusern (W-3)
  const playerRing = new PIXI.Graphics()
  playerRing.ellipse(0, 0, 4.6, 2.3).stroke({ width: 0.7, color: 0xf2c94c, alpha: 0.95 })
  playerRing.ellipse(0, 0, 3.2, 1.6).fill({ color: 0x000000, alpha: 0.22 })
  const playerFallback = new PIXI.Graphics()
  playerFallback.roundRect(-1.6, -6.4, 3.2, 5.4, 1.4).fill(0xd7ad3c).stroke({ width: 0.5, color: 0x5c481c })
  playerFallback.circle(0, -7.6, 1.5).fill(0xf0c9a0).stroke({ width: 0.4, color: 0x5c481c })
  playerSprite.addChild(playerRing, playerFallback)

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
  type Loaded = { tile: TileId; data: SimplifiedTile; ox: number; oy: number; ground: PixiGraphics | null; lines: PixiGraphics | null; surface: PixiGraphics | null; blocks: Container[]; trees: Container[]; labels: Container[]; footprints: Array<{ ring: Footprint; minX: number; maxX: number; minY: number; maxY: number; /** Hindernis für die Figur: kleiner als das Haus, damit man in dichten Orten durchkommt */ core: Footprint; cMinX: number; cMaxX: number; cMinY: number; cMaxY: number }>; parcels: PixiGraphics | null; owned: PixiGraphics | null; done: boolean; /** Schornsteine mit Rauch (Weltmeter, Höhe der Mündung) */ chimneys: Array<{ x: number; y: number; h: number; seed: number }>; /** Fensterlicht je Haus (abends sichtbar) */ lights: Container[]; /** Bäume und Sträucher (Weltmeter), für Klick und Jahreszeit */ plants: Array<{ x: number; y: number; spot: PlantSpot; region: PlantRegion; sprite: Sprite; k: number }>; /** Grabbeete (W-19), im Boden */ beds: PixiGraphics | null; /** Glitzern auf dem Wasser, zwei Gruppen im Wechsel */ glint: [PixiGraphics, PixiGraphics] | null }
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
  function drawMass(g: PixiGraphics, kind: BlockKind, cx: number, cy: number, hw: number, hd: number, cos: number, sin: number, eave: number, roofM: number, roofColor?: number, extras?: { solar?: boolean; chimney?: boolean; onChimney?: (x: number, y: number, h: number) => void }) {
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
    type Face = { pts: Array<{ x: number; y: number; h: number }>; n: { x: number; y: number }; eave: [{ x: number; y: number }, { x: number; y: number }]; solar?: boolean }
    const faces: Face[] = [
      { pts: [{ ...c[0], h: eave }, { ...c[1], h: eave }, { ...r[1], h: top }, { ...r[0], h: top }], n: { x: sin, y: -cos }, eave: [c[0], c[1]] },
      { pts: [{ ...c[2], h: eave }, { ...c[3], h: eave }, { ...r[0], h: top }, { ...r[1], h: top }], n: { x: -sin, y: cos }, eave: [c[2], c[3]] },
      { pts: [{ ...c[1], h: eave }, { ...c[2], h: eave }, { ...r[1], h: top }], n: { x: cos, y: sin }, eave: [c[1], c[2]] },
      { pts: [{ ...c[3], h: eave }, { ...c[0], h: eave }, { ...r[0], h: top }], n: { x: -cos, y: -sin }, eave: [c[3], c[0]] },
    ]
    // Solaranlage auf der langen Dachseite, die eher nach Süden zeigt (y zeigt nach Süden).
    if (extras?.solar) { const best = faces[0].n.y >= faces[1].n.y ? faces[0] : faces[1]; if (best.n.y > -0.25) best.solar = true }
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
      if (face.solar) drawSolarOnSlope(g, face.pts, light)
    }
    if (extras?.chimney) {
      // Schornstein auf dem First, etwas neben der Mitte
      const at = corner(ridgeHalf > 1 ? ridgeHalf * 0.45 : 0.6, ridgeHalf > 1 ? 0 : 0.6)
      const h0 = top - 0.9, h1 = top + 0.9
      drawStub(g, at.x, at.y, 0.34, cos, sin, h0, h1, 0x8a5646)
      extras.onChimney?.(at.x, at.y, h1)
    }
    return c
  }

  /** Quader von Höhe h0 bis h1 (Schornstein): zwei sichtbare Seiten und Deckel. */
  function drawStub(g: PixiGraphics, cx: number, cy: number, half: number, cos: number, sin: number, h0: number, h1: number, color: number) {
    const corner = (lx: number, ly: number) => ({ x: cx + lx * cos - ly * sin, y: cy + lx * sin + ly * cos })
    const c = [corner(-half, -half), corner(half, -half), corner(half, half), corner(-half, half)]
    for (let i = 0; i < 4; i++) {
      const a = c[i], b = c[(i + 1) % 4]
      const nx = b.y - a.y, ny = -(b.x - a.x)
      if (nx + ny <= 0) continue
      const a0 = iso(a.x, a.y, h0), b0 = iso(b.x, b.y, h0), a1 = iso(a.x, a.y, h1), b1 = iso(b.x, b.y, h1)
      g.poly([a0.x, a0.y, b0.x, b0.y, b1.x, b1.y, a1.x, a1.y]).fill(shade(color, nx - ny > 0 ? 1 : 0.8)).stroke({ width: 0.2, color: OUTLINE, alpha: 0.6 })
    }
    g.poly(c.flatMap(p => { const s = iso(p.x, p.y, h1); return [s.x, s.y] })).fill(0x3a2a24)
  }

  /**
   * Solarmodule auf einer Dachfläche (Trapez: zwei Traufpunkte, darüber zwei Firstpunkte).
   * Ein Rechteck mit Abstand zu Traufe, First und Graten, in Module geteilt.
   */
  function drawSolarOnSlope(g: PixiGraphics, pts: Array<{ x: number; y: number; h: number }>, light: number) {
    if (pts.length !== 4) return
    const [e0, e1, r1, r0] = pts
    const eaveLen = Math.hypot(e1.x - e0.x, e1.y - e0.y), ridgeLen = Math.hypot(r1.x - r0.x, r1.y - r0.y)
    const v0 = 0.14, v1 = 0.72
    // Am oberen Rand ist die Fläche um die Grate schmaler: so weit einrücken, dass das Rechteck passt.
    const inset = Math.max(0, (eaveLen - ridgeLen) / 2 / eaveLen) * v1 + 0.6 / Math.max(1, eaveLen)
    const u0 = inset, u1 = 1 - inset
    const widthM = (u1 - u0) * eaveLen
    if (widthM < 2.2) return
    const up = { x: (r0.x + r1.x - e0.x - e1.x) / 2, y: (r0.y + r1.y - e0.y - e1.y) / 2, h: (r0.h + r1.h - e0.h - e1.h) / 2 }
    const at = (u: number, v: number) => iso(e0.x + (e1.x - e0.x) * u + up.x * v, e0.y + (e1.y - e0.y) * u + up.y * v, e0.h + (e1.h - e0.h) * u + up.h * v + 0.06)
    const quad = (ua: number, ub: number, va: number, vb: number) => { const a = at(ua, va), b = at(ub, va), c = at(ub, vb), d = at(ua, vb); return [a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y] }
    g.poly(quad(u0, u1, v0, v1)).fill(shade(0x24385a, 0.8 + light * 0.25)).stroke({ width: 0.16, color: 0xc9d3dc, alpha: 0.9 })
    const cols = Math.max(2, Math.round(widthM / 1.1)), rows = 2
    for (let i = 1; i < cols; i++) { const u = u0 + (u1 - u0) * i / cols, a = at(u, v0), b = at(u, v1); g.moveTo(a.x, a.y).lineTo(b.x, b.y) }
    for (let j = 1; j < rows; j++) { const v = v0 + (v1 - v0) * j / rows, a = at(u0, v), b = at(u1, v); g.moveTo(a.x, a.y).lineTo(b.x, b.y) }
    g.stroke({ width: 0.08, color: 0x7f9cc0, alpha: 0.7 })
    // Ein heller Schimmer oben links: Glas
    g.poly(quad(u0 + 0.02, u0 + (u1 - u0) * 0.35, v1 - 0.12, v1 - 0.03)).fill({ color: 0xffffff, alpha: 0.12 })
  }

  /** Reihen aufgeständerter Module auf einem Flachdach (Halle, Fabrik, Flachdach in warmen Breiten). */
  function drawSolarFlat(g: PixiGraphics, cx: number, cy: number, hw: number, hd: number, cos: number, sin: number, eave: number) {
    // Reihen quer zur kurzen Achse, nach Süden geneigt (vorn tiefer)
    const long = hw >= hd
    const L = (long ? hw : hd) * 0.78, D = (long ? hd : hw) * 0.7
    if (L < 2 || D < 1.5) return
    const ax = long ? { x: cos, y: sin } : { x: -sin, y: cos }      // entlang der Reihe
    const bx = { x: -ax.y, y: ax.x }                                  // quer dazu
    const p = (a: number, b: number, h: number) => iso(cx + ax.x * a + bx.x * b, cy + ax.y * a + bx.y * b, eave + h)
    const step = 2.4
    for (let b = -D; b + 1.3 <= D; b += step) {
      const q = [p(-L, b, 0.25), p(L, b, 0.25), p(L, b + 1.3, 0.75), p(-L, b + 1.3, 0.75)]
      g.poly(q.flatMap(s => [s.x, s.y])).fill(0x2a4064).stroke({ width: 0.14, color: 0xc9d3dc, alpha: 0.85 })
      const cols = Math.max(2, Math.round(L * 2 / 1.1))
      for (let i = 1; i < cols; i++) { const a = -L + 2 * L * i / cols, s0 = p(a, b, 0.25), s1 = p(a, b + 1.3, 0.75); g.moveTo(s0.x, s0.y).lineTo(s1.x, s1.y) }
      g.stroke({ width: 0.07, color: 0x7f9cc0, alpha: 0.65 })
    }
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

  function drawBlock(block: TileBlock, ox: number, oy: number, footprints?: Loaded['footprints'], ambient?: { chimneys: Loaded['chimneys']; extra: Container[] }) {
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
    // Warme Breiten (Gujarat, Sahel, Tropen): Flachdächer statt roter Satteldächer, Tempel und Moscheen ohne Kirchturm (02.11.2026).
    const geo = toGeo({ x: cx, y: cy })
    const region = roofRegion(geo.lat, geo.lon)
    const warm = !hasSpires(region)
    // Moschee: Nutzung b:mosque oder Wahrzeichen im Haus mit religion=muslim (Istanbul hat daneben echte Kirchen).
    const mosque = block.k === 'church' && (block.u === 'b:mosque' || landmarkIn({ cx, cy, hw, hd, cos, sin })?.tags.religion === 'muslim')
    const roofM = mosque ? 0 : warm ? (block.k === 'church' ? 1.2 : 0) : style.roofM * ROOF_FACTOR[region]
    // Solaranlagen, Schornstein (05.11.2026): nur auf realen Häusern ohne NOXIA-Dach.
    const ambientKey = block.i ?? (() => { const geo = toGeo({ x: cx, y: cy }); return geo.lat.toFixed(5) + ',' + geo.lon.toFixed(5) })()
    const plainRoof = !look?.roof && !mosque
    const areaM2 = block.w * block.d
    const solar = plainRoof && hasSolar(block.k, ambientKey, areaM2)
    const chimney = plainRoof && !warm && roofM > 0.01 && !shownRing && hasChimney(block.k, ambientKey)
    let c: Array<{ x: number; y: number }>
    if (shownRing) {
      c = drawPrism(g, block.k, shownRing, eave, { x: -sin, y: cos }, look?.roof)
      // Nur bei rechteckigem Grundriss, sonst stehen Module über dem Rand
      if (solar && polygonArea(shownRing) > 0.85 * (2 * hw) * (2 * hd)) drawSolarFlat(g, cx, cy, hw, hd, cos, sin, eave)
    } else {
      c = drawMass(g, block.k, cx, cy, hw, hd, cos, sin, eave, roofM, look?.roof, { solar: solar && roofM > 0.01, chimney, onChimney: (x, y, h) => ambient?.chimneys.push({ x, y, h, seed: seeded('smoke:' + ambientKey) }) })
      if (solar && roofM <= 0.01) drawSolarFlat(g, cx, cy, hw, hd, cos, sin, eave)
    }
    g.tint = worldTint
    if (owner) claim(owner)
    if (mosque) {
      // Minarette an den beiden vorderen Ecken, Kuppel mittig auf dem Flachdach.
      const corners = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([u, v]) => ({ x: cx + u * hw * cos - v * hd * sin, y: cy + u * hw * sin + v * hd * cos }))
        .sort((p, q) => (q.x + q.y) - (p.x + p.y)).slice(0, hw * 2 > 14 ? 2 : 1)
      for (const m of corners.sort((p, q) => (p.x + p.y) - (q.x + q.y))) drawMass(g, block.k, m.x, m.y, 1.1, 1.1, cos, sin, eave + 12, 4.5, 0xd9d4c8)
      const r = Math.min(hw, hd) * 0.62, mid = iso(cx, cy, eave)
      const rx = r * Math.SQRT2, ry = r * ISO_HEIGHT
      const dome: number[] = []
      for (let i = 0; i <= 16; i++) { const t = Math.PI * i / 16; dome.push(mid.x + rx * Math.cos(t), mid.y - ry * Math.sin(t)) }
      g.poly(dome).fill(0xb9c7c2).stroke({ width: 0.4, color: OUTLINE, alpha: 0.7 })
      g.poly([mid.x - rx * 0.45, mid.y - ry * 0.75, mid.x - rx * 0.1, mid.y - ry * 0.98, mid.x - rx * 0.1, mid.y - ry * 0.5]).fill({ color: 0xffffff, alpha: 0.25 })
    }
    // Kapellen (Friedhofs-, Wegkapellen) haben keinen hohen Turm (05.11.2026: Auferstehungskapelle)
    const chapel = block.u === 'b:chapel' || /kapelle|chapel/i.test(block.nm ?? '')
    if (block.k === 'church' && block.w >= 12 && !warm && !mosque && !chapel) {
      // Kirchturm an der Stirnseite, die zur Kamera zeigt: quadratisch, mit
      // spitzem Pyramidendach – macht eine Kirche von Weitem erkennbar.
      if (cos + sin < 0) { cos = -cos; sin = -sin }
      const side = Math.min(8, Math.max(4, block.d * 0.5))
      const tx = cx + (hw - side / 2) * cos, ty = cy + (hw - side / 2) * sin
      const towerEave = eave + style.roofM + Math.max(8, side * 1.6)
      drawMass(g, block.k, tx, ty, side / 2 + 0.3, side / 2 + 0.3, cos, sin, towerEave, side * 1.8)
    }
    if (block.t && !warm && !mosque) {
      // Dachreiter auf dem First: schlanker Aufsatz mit spitzem Dach.
      drawMass(g, block.k, cx, cy, 0.9, 0.9, cos, sin, eave + style.roofM + 1.5, 3.2)
    }
    // Tiefe: der vorderste Fußpunkt entscheidet, was vor wem steht.
    g.zIndex = Math.max(...c.map(p => p.x + p.y))
    // Licht in den Fenstern am Abend: eigene Fläche knapp vor dem Haus, nicht getönt.
    if (ambient && !shownRing && !owner && (block.k === 'house' || block.k === 'row') && c.length === 4) {
      const lit = drawWindowLights(c, block.l, style.storeyM, style.bayM, ambientKey)
      if (lit) {
        lit.zIndex = g.zIndex + 0.001
        const geo = toGeo({ x: cx, y: cy })
        windowLights.set(lit, { key: ambientKey, lon: geo.lon })
        lit.visible = windowLit(sunNow, geo.lon, Date.now(), ambientKey)
        lit.on('destroyed', () => windowLights.delete(lit))
        ambient.extra.push(lit)
      }
    }
    // Für Klicks: was dieses Gebäude ist. Ein Wahrzeichen in oder dicht an ihm
    // wird beim Klick gesucht (es kann in der Nachbarkachel liegen).
    g.eventMode = block.o ? 'none' : 'static'
    ;(g as unknown as { pick: WorldPick }).pick = { type: 'building', at: toGeo({ x: cx, y: cy }), address: block.h, name: block.nm, kind: block.k, noxiaId: owner?.id, source: block.i, areaM2: Math.round(block.f && block.f.length >= 8 ? polygonArea(Array.from({ length: block.f.length / 2 }, (_, i) => ({ x: block.f![i * 2], y: block.f![i * 2 + 1] }))) : block.w * block.d), levels: block.l, use: block.u }
    ;(g as unknown as { box: Box }).box = { cx, cy, hw, hd, cos, sin }
    // Hindernis für die Spielfigur: genau das gezeichnete Haus (ohne zusätzlichen Rand)
    if (footprints) {
      const ring = shownRing ?? boxFootprint(cx, cy, hw, hd, block.a, 0)
      const core = scaleRing(ring, { x: cx, y: cy }, WALK_CORE_SCALE)
      footprints.push({ ring, minX: Math.min(...ring.map(p => p.x)), maxX: Math.max(...ring.map(p => p.x)), minY: Math.min(...ring.map(p => p.y)), maxY: Math.max(...ring.map(p => p.y)),
        core, cMinX: Math.min(...core.map(p => p.x)), cMaxX: Math.max(...core.map(p => p.x)), cMinY: Math.min(...core.map(p => p.y)), cMaxY: Math.max(...core.map(p => p.y)) })
    }
    return g
  }

  /** Warme Fenster auf den beiden Wänden zur Kamera, je Geschoss und Achse etwa jedes zweite. */
  function drawWindowLights(c: Array<{ x: number; y: number }>, levels: number, storeyM: number, bayM: number, key: string) {
    const lit = new PIXI.Graphics()
    let any = false
    for (let i = 0; i < 4; i++) {
      const a = c[i], b = c[(i + 1) % 4]
      const nx = b.y - a.y, ny = -(b.x - a.x)
      if (nx + ny <= 0) continue
      const length = Math.hypot(b.x - a.x, b.y - a.y)
      const bays = Math.max(1, Math.floor(length / bayM))
      const ux = (b.x - a.x) / length, uy = (b.y - a.y) / length
      const out = 0.05 / Math.hypot(nx, ny)
      for (let level = 0; level < Math.min(levels, 6); level++) for (let bay = 0; bay < bays; bay++) {
        if (seeded(key + ':' + i + ':' + level + ':' + bay) > 0.45) continue
        const mid = (bay + 0.5) * length / bays
        const h0 = level * storeyM + 1.0, h1 = h0 + 1.25
        const p = (t: number, h: number) => iso(a.x + ux * t + nx * out, a.y + uy * t + ny * out, h)
        const q = [p(mid - 0.5, h0), p(mid + 0.5, h0), p(mid + 0.5, h1), p(mid - 0.5, h1)]
        lit.poly(q.flatMap(s => [s.x, s.y])).fill({ color: 0xffd27a, alpha: 0.92 })
        any = true
      }
    }
    if (!any) { lit.destroy(); return null }
    lit.eventMode = 'none'
    return lit
  }

  /** Wahrzeichen in einem Gebäude oder bis 12 m davor (Kacheln rundum). */
  function landmarkIn(box: Box, poi = false): WorldLandmark | undefined {
    const tx = anchorTile.x + Math.floor(box.cx / tileSizeM), ty = anchorTile.y + Math.floor(box.cy / tileSizeM)
    // Nicht der erste Treffer im 12-m-Rand, sondern der beste: Orte im Haus gehen vor Orten davor,
    // unter gleichen der nächste zum Mittelpunkt (dichte Städte wie Istanbul).
    let best: { score: number; place: TilePlace; ox: number; oy: number } | undefined
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const entry = loaded.get(tileKey({ x: tx + dx, y: ty + dy }))
      for (const place of entry?.data.places ?? []) {
        if (Boolean(place.p) !== poi) continue
        const px = entry!.ox + place.x - box.cx, py = entry!.oy + place.y - box.cy
        const u = Math.abs(px * box.cos + py * box.sin), v = Math.abs(-px * box.sin + py * box.cos)
        if (u > box.hw + 12 || v > box.hd + 12) continue
        const inside = u <= box.hw && v <= box.hd
        const score = (inside ? 0 : 1000) + Math.hypot(px, py)
        if (!best || score < best.score) best = { score, place, ox: entry!.ox, oy: entry!.oy }
      }
    }
    return best ? landmarkOf(best.place, best.ox, best.oy) : undefined
  }
  function landmarkOf(place: TilePlace, ox: number, oy: number): WorldLandmark {
    return { at: toGeo({ x: ox + place.x, y: oy + place.y }), name: place.n, kind: effectivePlaceKind(place.k, place.t), tags: place.t ?? {}, ...(place.p ? { poi: true } : {}) }
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

  /**
   * Glitzern auf Wasser (05.11.2026): kurze helle Striche auf Flüssen und Wasserflächen,
   * in zwei Gruppen, die im Wechsel auf- und abblenden.
   */
  function drawGlint(entry: Loaded) {
    const { data, ox, oy } = entry
    const groups = [new PIXI.Graphics(), new PIXI.Graphics()]
    let count = 0
    const dash = (x: number, y: number) => {
      const a = iso(ox + x - 0.7, oy + y - 0.7), b = iso(ox + x + 0.7, oy + y + 0.7)
      groups[count++ % 2].moveTo(a.x, a.y).lineTo(b.x, b.y)
    }
    data.rivers.forEach((river, i) => {
      const width = data.rw?.[i] ?? RIVER_STYLE.widthM
      if (width < 1.5) return
      let carry = 0
      for (let j = 0; j + 3 < river.length && count < 80; j += 2) {
        const dx = river[j + 2] - river[j], dy = river[j + 3] - river[j + 1], len = Math.hypot(dx, dy)
        for (let t = carry; t < len; t += 7) dash(river[j] + dx * t / len, river[j + 1] + dy * t / len)
        carry = (carry + 7 - (len % 7)) % 7
      }
    })
    for (const area of data.areas) {
      if ((area.k !== 'water' && area.k !== 'pool') || count >= 140) continue
      const ring: Array<{ x: number; y: number }> = []
      for (let i = 0; i + 1 < area.p.length; i += 2) ring.push({ x: area.p[i], y: area.p[i + 1] })
      const xs = ring.map(p => p.x), ys = ring.map(p => p.y)
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
      const step = Math.max(6, Math.sqrt((maxX - minX) * (maxY - minY) / 40))
      for (let y = minY + step / 2; y < maxY && count < 140; y += step) for (let x = minX + step / 2 + ((y / step) % 2) * step / 2; x < maxX && count < 140; x += step) {
        if (insidePolygon({ x, y }, ring)) dash(x, y)
      }
    }
    if (!count) { groups.forEach(g => g.destroy()); return }
    for (const g of groups) { g.stroke({ width: 0.35, color: 0xeaf6ff, cap: 'round' }); g.eventMode = 'none'; surfaceLayer.addChild(g) }
    entry.glint = [groups[0], groups[1]]
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
    // Gelände (NOXIA-WORLD-0004): Hangschattierung mit Licht aus Nordwesten und
    // Höhenlinien alle 10 m, auf dem flachen Boden unter Straßen und Häusern.
    const terrain = (data as TileTerrainPart).terrain
    if (terrain) {
      const shade = terrainShade(terrain, data.size)
      for (const quad of shade.quads) {
        const p = path(quad.p)
        // Höhenfarbe: Täler satter, Höhen heller (05.11.2026)
        const tint = heightTint(quad.h)
        if (tint.alpha > 0.01) g.poly(p).fill({ color: tint.color, alpha: tint.alpha })
        if (Math.abs(quad.light) >= 0.02) g.poly(p).fill({ color: quad.light > 0 ? 0xfff6dc : 0x1d2a2e, alpha: Math.min(0.5, Math.abs(quad.light) * (quad.light > 0 ? 0.38 : 0.5)) })
      }
      for (const line of shade.contours) {
        const p = path(line.s)
        for (let i = 0; i + 3 < p.length; i += 4) g.moveTo(p[i], p[i + 1]).lineTo(p[i + 2], p[i + 3])
        g.stroke({ width: line.major ? 0.55 : 0.3, color: 0x6b5a3a, alpha: line.major ? 0.38 : 0.22 })
      }
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
    drawGlint(entry)
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
      const functional = isTravelPlace(place.k, place.t) || (!place.p && placeHasFunction(place.k, place.t))
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
    // Bäume und Sträucher: Objekte mit Tiefe, damit sie vor und hinter Häusern stehen.
    // Standorte aus OSM und geschätzte in Wald, Park, Garten, Friedhof (plantPlacement.ts).
    const centreGeo = toGeo({ x: ox + data.size / 2, y: oy + data.size / 2 })
    const region = plantRegion(centreGeo.lat, centreGeo.lon)
    for (const spot of plantSpots(data, { x: entry.tile.x * data.size, y: entry.tile.y * data.size }, centreGeo)) {
      const texture = plantTexture(spot.species, region)
      if (!texture) break
      const x = ox + spot.x, y = oy + spot.y
      const sprite = new PIXI.Sprite(texture)
      sprite.anchor.set(0.5, (TREE_PX.h - 4) / TREE_PX.h)
      const k = plantSize(spot)
      sprite.width = TREE_WORLD.w * k; sprite.height = TREE_WORLD.h * k
      const foot = iso(x, y)
      sprite.position.set(foot.x, foot.y)
      sprite.zIndex = x + y
      sprite.tint = worldTint
      sprite.eventMode = 'none'
      addObject(sprite)
      entry.trees.push(sprite)
      entry.plants.push({ x, y, spot, region, sprite, k })
    }
    drawGraves(entry)
  }

  /**
   * W-19 (05.11.2026): Grabsteine auf Friedhofsflächen. Reihen quer zur Blickrichtung,
   * je Reihe ein Objekt mit Tiefe; Grabbeete flach auf dem Boden. Ohne Namen (R-23).
   */
  function drawGraves(entry: Loaded) {
    const { data, ox, oy } = entry
    const cemeteries = data.areas.filter(area => area.k === 'cemetery')
    if (!cemeteries.length) return
    const blocked = [
      ...data.blocks.map(block => ({ x: block.x, y: block.y, r: Math.max(block.w, block.d) / 2 + 1.5 })),
      ...entry.plants.map(plant => ({ x: plant.spot.x, y: plant.spot.y, r: 1.6 })),
    ]
    const crosses = Math.abs(toGeo({ x: ox + data.size / 2, y: oy + data.size / 2 }).lat) >= 36
    const origin = { x: entry.tile.x * data.size, y: entry.tile.y * data.size }
    const beds = new PIXI.Graphics()
    const rows = new Map<number, PixiGraphics>()
    const a = { x: Math.SQRT1_2, y: -Math.SQRT1_2 }, n = { x: Math.SQRT1_2, y: Math.SQRT1_2 }
    const at = (x: number, y: number, along: number, front: number, h: number) => iso(x + a.x * along + n.x * front, y + a.y * along + n.y * front, h)
    const flat = (pts: Array<{ x: number; y: number }>) => pts.flatMap(q => [q.x, q.y])
    for (const area of cemeteries) {
      const ring: Array<{ x: number; y: number }> = []
      for (let i = 0; i + 1 < area.p.length; i += 2) ring.push({ x: area.p[i], y: area.p[i + 1] })
      for (const spot of graveSpots(ring, origin, blocked, crosses)) {
        const x = ox + spot.x, y = oy + spot.y
        const r = seeded('bed:' + (origin.x + spot.x).toFixed(1) + ',' + (origin.y + spot.y).toFixed(1))
        // Grabbeet vor dem Stein: meist bepflanzt, manches mit Kies
        beds.poly(flat([at(x, y, -0.4, 0.05, 0), at(x, y, 0.4, 0.05, 0), at(x, y, 0.4, 1.6, 0), at(x, y, -0.4, 1.6, 0)])).fill(r < 0.7 ? 0x6f8a52 : 0xbdb4a0)
        let g = rows.get(spot.row)
        if (!g) { g = new PIXI.Graphics(); g.zIndex = ox + oy + spot.row + 0.05; g.eventMode = 'none'; g.tint = worldTint; rows.set(spot.row, g) }
        if (spot.cross) {
          const wood = r > 0.5
          const color = wood ? 0x5b4632 : 0xa7a39a
          g.poly(flat([at(x, y, -0.07, 0, 0), at(x, y, 0.07, 0, 0), at(x, y, 0.07, 0, 1.05), at(x, y, -0.07, 0, 1.05)])).fill(color).stroke({ width: 0.06, color: 0x3c3a36, alpha: 0.7 })
          g.poly(flat([at(x, y, -0.27, 0, 0.7), at(x, y, 0.27, 0, 0.7), at(x, y, 0.27, 0, 0.83), at(x, y, -0.27, 0, 0.83)])).fill(color).stroke({ width: 0.06, color: 0x3c3a36, alpha: 0.7 })
        } else {
          // Stehender Stein mit gerundeter Oberkante, leicht verschieden in Breite und Farbe
          const w = 0.26 + r * 0.1, h = 0.62 + ((r * 7) % 1) * 0.18
          const color = [0x8f8f8a, 0x7d7a74, 0x9b958a, 0x6c6e70][Math.floor(r * 4) % 4]
          g.poly(flat([at(x, y, -w, 0, 0), at(x, y, w, 0, 0), at(x, y, w, 0, h - 0.1), at(x, y, w * 0.55, 0, h), at(x, y, 0, 0, h + 0.04), at(x, y, -w * 0.55, 0, h), at(x, y, -w, 0, h - 0.1)]))
            .fill(color).stroke({ width: 0.07, color: 0x4e4e4a, alpha: 0.8 })
        }
      }
    }
    if (!rows.size) { beds.destroy(); return }
    beds.eventMode = 'none'
    ground.addChild(beds)
    entry.beds = beds
    for (const g of rows.values()) { addObject(g); entry.trees.push(g) }
  }

  function showTile(tile: TileId, data: SimplifiedTile) {
    const key = tileKey(tile)
    if (loaded.has(key) || disposed) return
    const ox = (tile.x - anchorTile.x) * tileSizeM, oy = (tile.y - anchorTile.y) * tileSizeM
    loaded.set(key, { tile, data, ox, oy, ground: null, lines: null, surface: null, blocks: [], trees: [], labels: [], footprints: [], parcels: null, owned: null, done: false, chimneys: [], lights: [], plants: [], beds: null, glint: null })
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
        const litFrom = entry.lights.length
        for (let i = from; i < to; i++) {
          const block = entry.data.blocks[i]
          if (block.i && cleared.has(block.i)) continue   // abgerissen
          chunk.push(drawBlock(block, entry.ox, entry.oy, entry.footprints, { chimneys: entry.chimneys, extra: entry.lights }))
        }
        for (const block of chunk) addObject(block)
        for (const lit of entry.lights.slice(litFrom)) addObject(lit)
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
    entry.glint?.forEach(g => g.destroy())
    for (const lit of entry.lights) lit.destroy()
    entry.beds?.destroy()
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
    spec: WorldPerson; figure: Container; kiesel: KieselState; label: InstanceType<typeof PIXI.Text>
    /** Sprechblase über der Figur (Gespräch in Hörweite), sonst nicht gesetzt. */
    bubble?: InstanceType<typeof PIXI.Container>
    x: number; y: number; seed: number
    route: Array<{ x: number; y: number }> | null; routeLength: number
    /** Unterwegs zu einem Ort: Weg entlang der Straßen, Länge, Start, Dauer.
     *  `commute`: eigener Weg zum neuen Ort aus der Simulation; endet am Ziel von selbst. */
    sent: { path: Array<{ x: number; y: number }>; length: number; start: number; seconds: number; commute?: boolean; /** Weg ohne Straßen oder zu weit: unterwegs unsichtbar (Bus, Auto), statt quer durch Häuser zu rennen. */ hidden?: boolean; /** Fährt mit dem eigenen Auto: Auto statt Figur, Tempo eines Autos. */ drive?: boolean } | null
    /** Platz vor dem Anker (0, 1, 2 …) und ob die Person drinnen ist, weil vor dem Haus schon genug stehen. */
    slot: number; slots: number; crowdInside: boolean
    /** Zurückgelegter Weg auf der eigenen Straße (m) und Zeit des letzten Schritts */
    runM: number; lastAt: number
    /** Eigenes Auto, nur während einer Fahrt gezeichnet */
    car?: PixiGraphics
  }
  const walkers = new Map<string, Walker>()
  const PERSON_COLORS = [0x4f7fb3, 0xa4553f, 0x5f8f4a, 0x8a6aa8, 0x3f8f8a, 0xb08a3a]
  const hash = (text: string) => { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return h >>> 0 }
  // ── Kiesel-Figuren (W-17) ───────────────────────────────────────────
  // Jedes Aussehen, jede Richtung und jeder Schritt wird einmal als Bild gerechnet
  // (SVG → Textur) und zwischengespeichert. Bis das Bild da ist, steht die einfache Figur.
  const KIESEL_H = 11.5, KIESEL_W = KIESEL_H * 64 / 96
  const kieselCache = new Map<string, Texture | 'loading'>()
  function kieselTexture(look: KieselLook, dir: KieselDir, pose: KieselPose, frame: number): Texture | null {
    const key = JSON.stringify(look) + '|' + dir + '|' + pose + '|' + frame
    const hit = kieselCache.get(key)
    if (hit === 'loading') return null
    if (hit) return hit
    kieselCache.set(key, 'loading')
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 96" width="64" height="96">${kieselSVG(look, dir, pose, frame, pose === 'gehen')}</svg>`
    const img = new Image()
    img.onload = () => { if (!disposed) kieselCache.set(key, PIXI.Texture.from(img)) }
    img.onerror = () => kieselCache.delete(key)
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    return null
  }
  type KieselState = { look: KieselLook | null; sprite: InstanceType<typeof PIXI.Sprite>; fallback: PixiGraphics; dir: KieselDir; lastFoot: { x: number; y: number } | null; movedAt: number; pose?: KieselPose | null }
  /** Blickrichtung und Schritt aus der Bewegung auf dem Bildschirm, dann das passende Bild. */
  function stepKiesel(state: KieselState, foot: { x: number; y: number }, now: number) {
    if (!state.look) return
    const last = state.lastFoot
    const dx = last ? foot.x - last.x : 0, dy = last ? foot.y - last.y : 0
    if (Math.hypot(dx, dy) > 0.02) { state.dir = kieselDirFrom(dx * 20, dy * 20, state.dir); state.movedAt = now }
    state.lastFoot = { x: foot.x, y: foot.y }
    const moving = now - state.movedAt < 180
    // Stehend mit Arbeit: Arbeitspose (animiert in vier Bildern, langsamer als der Schritt)
    const pose: KieselPose = moving ? 'gehen' : state.pose ?? 'stehen'
    const frame = moving ? Math.floor(now / 140) % 4 : KIESEL_POSES[pose]?.animated ? Math.floor(now / 260) % 4 : 0
    const texture = kieselTexture(state.look, state.dir, pose, frame)
    if (texture) { state.sprite.texture = texture; state.sprite.visible = true; state.fallback.visible = false }
  }
  function kieselSprite() {
    const sprite = new PIXI.Sprite()
    sprite.anchor.set(0.5, 0.97)
    sprite.width = KIESEL_W; sprite.height = KIESEL_H
    sprite.visible = false
    return sprite
  }
  // Eigene Figur: Kiesel, sobald die Ansicht das Aussehen meldet
  let playerKiesel: KieselState | null = null
  function setPlayerLook(look: KieselLook) {
    if (!playerKiesel) {
      const sprite = kieselSprite()
      sprite.scale.set(sprite.scale.x / 1.35, sprite.scale.y / 1.35)
      playerSprite.addChild(sprite)
      playerKiesel = { look, sprite, fallback: playerFallback, dir: 'se', lastFoot: null, movedAt: 0 }
    } else playerKiesel.look = look
  }
  function makeFigure(color: number) {
    const g = new PIXI.Container()
    const shadow = new PIXI.Graphics()
    shadow.ellipse(0, 0, 3, 1.5).fill({ color: 0x000000, alpha: 0.2 })
    const fallback = new PIXI.Graphics()
    fallback.roundRect(-1.5, -6.1, 3, 5.1, 1.3).fill(color).stroke({ width: 0.45, color: 0x2e2a24 })
    fallback.circle(0, -7.2, 1.4).fill(0xe8c4a0).stroke({ width: 0.4, color: 0x2e2a24 })
    const sprite = kieselSprite()
    sprite.scale.set(sprite.scale.x / 1.3, sprite.scale.y / 1.3)
    g.addChild(shadow, fallback, sprite)
    g.eventMode = 'static'
    // Größer als die Figur, damit man sie auch beim Herauszoomen trifft.
    g.hitArea = new PIXI.Rectangle(-4.5, -11, 9, 13)
    g.scale.set(1.3)
    return { g, kiesel: { look: null, sprite, fallback, dir: 'se', lastFoot: null, movedAt: 0 } as KieselState }
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
  function standPoint(spec: WorldPerson, seed: number, slot = seed % 5, slots = 5) {
    if (!spec.anchor) return null
    const home = toWorld(spec.anchor)
    const out = (spec.anchorRadiusM ?? 6) + 3
    const spread = anchorSpread(slot, slots)
    return { x: home.x + out * 0.71 + spread * 0.71, y: home.y + out * 0.71 - spread * 0.71 }
  }
  /** Eigener Weg zum neuen Ort entlang der Straßen (sichtbares Pendeln, NOXIA-VISUAL-0001). */
  function startCommute(walker: Walker, to: { x: number; y: number }) {
    const from = { x: walker.x, y: walker.y }
    const direct = Math.hypot(to.x - from.x, to.y - from.y)
    if (direct <= COMMUTE_THRESHOLD_M) return
    const planned = planRoute(to, from)
    const path = [from, ...planned]
    if (Math.hypot(path[path.length - 1].x - to.x, path[path.length - 1].y - to.y) > 0.5) path.push(to)
    const length = pathLength(path)
    // Kein Straßenweg gefunden (nur der direkte Strich) oder zu weit zum Gehen: nicht quer durch
    // Häuser laufen, sondern unterwegs unsichtbar sein (Thomas, 31.10.2026: „über die Karte rennen,
    // ohne Rücksicht auf Straßen und Gebäude“).
    const offRoad = planned.length <= 1 && direct > 30
    // Wer ein Auto hat, fährt weite Wege sichtbar über die Straßen (Thomas, 06.11.2026: echter Verkehr, keine Kulisse).
    const drive = Boolean(walker.spec.vehicle) && !offRoad && length > VISIBLE_WALK_MAX_M / 2
    walker.sent = drive
      ? { path, length, start: performance.now(), seconds: commuteSeconds(length, NPC_DRIVE_M_PER_S, 3, 240), commute: true, hidden: false, drive: true }
      : { path, length, start: performance.now(), seconds: commuteSeconds(length), commute: true, hidden: offRoad || length > VISIBLE_WALK_MAX_M }
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
    for (const [id, walker] of walkers) if (!keep.has(id)) { walker.figure.destroy({ children: true }); walker.label.destroy(); walker.bubble?.destroy(); walker.car?.destroy(); walkers.delete(id) }
    for (const spec of list) {
      const known = walkers.get(spec.id)
      if (known) {
        const before = standPoint(known.spec, known.seed, known.slot, known.slots)
        known.spec = spec; known.label.text = spec.label; known.kiesel.look = spec.look ?? null; known.kiesel.pose = spec.pose ?? null
        const after = standPoint(spec, known.seed, known.slot, known.slots)
        // Neuer Ort aus der Simulation (z. B. Wohnung → Arbeit): hingehen statt springen.
        // Ein Weg aus einem Gespräch (Mitgehen, Hinschicken) hat Vorrang.
        if (after && (!known.sent || known.sent.commute) && (shouldCommute(before, after) || (!before && Math.hypot(after.x - known.x, after.y - known.y) > COMMUTE_THRESHOLD_M))) startCommute(known, after)
        // Kein Ort mehr (frei): neuer Spaziergang in der Nähe.
        if (!after && before) known.route = null
        continue
      }
      const seed = hash(spec.id)
      const made = makeFigure(spec.tint ?? PERSON_COLORS[seed % PERSON_COLORS.length])
      const figure = made.g
      made.kiesel.look = spec.look ?? null
      made.kiesel.pose = spec.pose ?? null
      ;(figure as unknown as { pick: WorldPick }).pick = { type: 'person', id: spec.id }
      const label = new PIXI.Text({ text: spec.label, style: { fontFamily: 'system-ui, sans-serif', fontSize: 26, fontWeight: '600', fill: 0x1f2a30, stroke: { color: 0xf8f6ef, width: 6, join: 'round' } } })
      label.anchor.set(0.5, 1)
      label.scale.set(0.12)
      labels.addChild(label)
      const start = spec.anchor ? toWorld(spec.anchor) : { x: player.x + (seed % 40) - 20, y: player.y + ((seed >> 8) % 40) - 20 }
      const walker: Walker = { spec, figure, kiesel: made.kiesel, label, x: start.x, y: start.y, seed, route: null, routeLength: 0, sent: null, runM: seed % 997, lastAt: 0, slot: 0, slots: 1, crowdInside: false }
      walkers.set(spec.id, walker)
      placeDepth(figure, start.x + start.y)
    }
    // Vor einem Haus stehen höchstens ANCHOR_VISIBLE_MAX nebeneinander; die anderen sind drinnen
    // (Personal, Gäste) – statt eines Knäuels mit übereinanderliegenden Namen.
    const byAnchor = new Map<string, Walker[]>()
    for (const walker of walkers.values()) {
      if (!walker.spec.anchor || walker.spec.inside) continue
      const key = walker.spec.anchor.lat.toFixed(5) + ',' + walker.spec.anchor.lon.toFixed(5)
      byAnchor.set(key, [...(byAnchor.get(key) ?? []), walker])
    }
    for (const group of byAnchor.values()) {
      group.sort((a, b) => a.seed - b.seed)
      const shown = Math.min(group.length, ANCHOR_VISIBLE_MAX)
      group.forEach((walker, index) => { walker.slot = index; walker.slots = shown; walker.crowdInside = index >= ANCHOR_VISIBLE_MAX })
    }
  }
  function moveWalkers(now: number) {
    for (const walker of walkers.values()) {
      let x = walker.x, y = walker.y
      if (walker.sent) {
        const t = Math.min(1, (now - walker.sent.start) / 1000 / walker.sent.seconds)
        const at = along(walker.sent.path, walker.sent.length * t)
        x = at.x; y = at.y
        if (walker.sent.drive) {
          // Auto statt Figur: Richtung aus dem Weg, eine halbe Spur rechts der Straßenmitte
          const ahead = along(walker.sent.path, Math.min(walker.sent.length, walker.sent.length * t + 2))
          const h = headingOf(walker.x, walker.y, ahead.x, ahead.y, x, y)
          if (!walker.car) { walker.car = new PIXI.Graphics(); walker.car.eventMode = 'none' }
          const cx = x + -h.uy * 1.8, cy = y + h.ux * 1.8
          const visible = Math.hypot(cx - player.x, cy - player.y) < 420
          walker.car.visible = visible
          if (visible) { drawVehicle(walker.car, cx, cy, h.ux, h.uy, PRIVATE_CAR, carColorFor(walker.seed), 0xd0ccc4, true); placeDepth(walker.car, cx + cy + 2) }
        }
        // Angekommen: ab jetzt steht die Figur wieder an ihrem Ort.
        if (t >= 1 && walker.sent.commute) { walker.sent = null; if (walker.car) { walker.car.destroy(); walker.car = undefined } }
      } else if (walker.spec.anchor) {
        // Vor dem Haus auf der Kameraseite (Süd-Ost), nicht darin – dort sieht man sie.
        const home = toWorld(walker.spec.anchor)
        const out = (walker.spec.anchorRadiusM ?? 6) + 3
        const spread = anchorSpread(walker.slot, walker.slots)
        // Bei der Arbeit steht man still (sonst zählt das Wiegen als Gehen)
        const sway = now / 1000 * 0.35 + walker.seed % 7, swing = walker.spec.pose ? 0 : 1.2
        x = home.x + out * 0.71 + spread * 0.71 + Math.cos(sway) * swing
        y = home.y + out * 0.71 - spread * 0.71 + Math.sin(sway * 0.8) * swing
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
      stepKiesel(walker.kiesel, foot, now)
      walker.label.position.set(foot.x, foot.y - 12)
      const near = Math.hypot(x - player.x, y - player.y) < 200 && !(walker.spec.inside && !walker.sent) && !(walker.crowdInside && !walker.sent) && !walker.sent?.hidden && !walker.sent?.drive
      walker.figure.visible = near
      walker.label.visible = near && zoom >= 2.2
      if (walker.bubble) { walker.bubble.position.set(foot.x, foot.y - 17); walker.bubble.visible = near && zoom >= 1.6 }
    }
  }

  // ── Mitspieler (W-16) ───────────────────────────────────────────────
  // Lage kommt über Realtime etwa jede Sekunde; die Figur gleitet dorthin, statt zu springen.
  type Peer = { id: string; name: string; figure: Container; kiesel: KieselState; label: InstanceType<typeof PIXI.Text>; x: number; y: number; tx: number; ty: number; bubble?: Container; emote?: string | null }
  const peers = new Map<string, Peer>()
  function emoteBubble(text: string) {
    const words = new PIXI.Text({ text, style: { fontFamily: 'system-ui, sans-serif', fontSize: 24, fontStyle: 'italic', fill: 0x14324a } })
    words.anchor.set(0.5, 1)
    words.position.set(0, -6)
    const w = words.width + 18, h = words.height + 10
    const box = new PIXI.Graphics()
    box.roundRect(-w / 2, -6 - h + 5, w, h, 12).fill({ color: 0xe8f1fb }).stroke({ color: 0x6b93bd, width: 2 })
    const bubble = new PIXI.Container()
    bubble.addChild(box, words)
    bubble.scale.set(0.12)
    labels.addChild(bubble)
    return bubble
  }
  function setPeers(list: Array<{ id: string; name: string; at: GeoPoint; look: KieselLook | null; emote?: string | null }>) {
    const keep = new Set(list.map(peer => peer.id))
    for (const [id, peer] of peers) if (!keep.has(id)) { peer.figure.destroy({ children: true }); peer.label.destroy(); peer.bubble?.destroy(); peers.delete(id) }
    for (const spec of list) {
      const target = toWorld(spec.at)
      let peer = peers.get(spec.id)
      if (!peer) {
        const made = makeFigure(0x3d7cc9)
        ;(made.g as unknown as { pick: WorldPick }).pick = { type: 'peer', id: spec.id, name: spec.name }
        const label = new PIXI.Text({ text: spec.name, style: { fontFamily: 'system-ui, sans-serif', fontSize: 26, fontWeight: '700', fill: 0x1d4f86, stroke: { color: 0xf8f6ef, width: 6, join: 'round' } } })
        label.anchor.set(0.5, 1)
        label.scale.set(0.12)
        labels.addChild(label)
        peer = { id: spec.id, name: spec.name, figure: made.g, kiesel: made.kiesel, label, x: target.x, y: target.y, tx: target.x, ty: target.y }
        peers.set(spec.id, peer)
        placeDepth(made.g, target.x + target.y)
      }
      // Weit gesprungen (Reise, Neuladen): gleich dort
      if (Math.hypot(target.x - peer.x, target.y - peer.y) > 80) { peer.x = target.x; peer.y = target.y }
      peer.tx = target.x; peer.ty = target.y
      peer.kiesel.look = spec.look ?? null
      if (peer.name !== spec.name) { peer.name = spec.name; peer.label.text = spec.name; (peer.figure as unknown as { pick: WorldPick }).pick = { type: 'peer', id: spec.id, name: spec.name } }
      const emote = spec.emote ?? null
      if (emote !== (peer.emote ?? null)) { peer.bubble?.destroy(); peer.bubble = emote ? emoteBubble(emote) : undefined; peer.emote = emote }
    }
  }
  function movePeers(now: number, dt: number) {
    for (const peer of peers.values()) {
      const dx = peer.tx - peer.x, dy = peer.ty - peer.y, d = Math.hypot(dx, dy)
      // Gehtempo, bei Rückstand schneller (bis 6 m/s), nie über das Ziel hinaus
      const step = Math.min(d, Math.max(1.4, d * 1.5) * dt)
      if (d > 0.01) { peer.x += dx / d * step; peer.y += dy / d * step }
      const foot = iso(peer.x, peer.y)
      peer.figure.position.set(foot.x, foot.y)
      placeDepth(peer.figure, peer.x + peer.y)
      stepKiesel(peer.kiesel, foot, now)
      peer.label.position.set(foot.x, foot.y - 12)
      const near = Math.hypot(peer.x - player.x, peer.y - player.y) < 400
      peer.figure.visible = near
      peer.label.visible = near && zoom >= 1.6
      if (peer.bubble) { peer.bubble.position.set(foot.x, foot.y - 16); peer.bubble.visible = near }
    }
    if (playerBubble) {
      const foot = iso(player.x, player.y)
      playerBubble.bubble.position.set(foot.x, foot.y - 16)
      if (now > playerBubble.until) { playerBubble.bubble.destroy(); playerBubble = null }
    }
  }
  let playerBubble: { bubble: Container; until: number } | null = null
  let peersLastAt = 0

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
        if (p.x < f.cMinX || p.x > f.cMaxX || p.y < f.cMinY || p.y > f.cMaxY) continue
        if (insidePolygon(p, f.core)) return true
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
  let autoWalk: { target: () => GeoPoint | null; withinM: number; onArrive?: () => void; path: Array<{ x: number; y: number }>; planFor: { x: number; y: number } | null; planAt: number; stuck: number; /** Mit dem eigenen Auto: Tempo eines Autos, Auto statt Figur, am Ziel bleibt es stehen. */ drive?: boolean } | null = null
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
    if (Math.hypot(to.x - player.x, to.y - player.y) <= autoWalk.withinM) { const done = autoWalk.onArrive; if (autoWalk.drive) parkOwnCar(); autoWalk = null; done?.(); return }
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
    const step = Math.min(distance, (autoWalk.drive ? DRIVE_M_PER_S : WALK_M_PER_S) * dt)
    const moved = movePlayer(player.x + dx / distance * step, player.y + dy / distance * step)
    if (autoWalk.drive && moved > 0.01) ownCarHeading = headingOf(player.x - dx, player.y - dy, player.x + dx, player.y + dy, player.x, player.y)
    // Hängt die Figur an einer Wand fest, den nächsten Wegpunkt nehmen.
    autoWalk.stuck = moved < step * 0.2 ? autoWalk.stuck + dt : 0
    if (autoWalk.stuck > 0.8 && autoWalk.path.length > 1) { autoWalk.path.shift(); autoWalk.stuck = 0 }
    // Ziel liegt hinter einer Wand (Schild mitten im Haus): so nah wie möglich gilt als angekommen.
    else if (autoWalk.stuck > 1.2) { const done = autoWalk.onArrive; if (autoWalk.drive) parkOwnCar(); autoWalk = null; done?.() }
  }

  // ── Eigenes Auto ────────────────────────────────────────────────────
  // Geparkt steht es am Straßenrand nächst der gespeicherten Stelle; während der
  // Fahrt sitzt die Figur darin (Auto statt Figur, Kamera folgt wie immer).
  const ownCar = new PIXI.Graphics()
  ownCar.visible = false
  let ownCarAt: { x: number; y: number } | null = null
  let ownCarHeading = { ux: 0.71, uy: 0.71 }
  /** Nächster Punkt auf einer Straße (ohne Pfade) im Umkreis, mit Richtung; sonst der Punkt selbst. */
  function roadsidePoint(at: { x: number; y: number }, maxM = 40) {
    let best: { x: number; y: number; ux: number; uy: number } | null = null, bestD = maxM
    for (const entry of loaded.values()) for (const road of entry.data.roads) {
      if (road.c === 'path') continue
      for (let i = 0; i + 3 < road.p.length; i += 2) {
        const ax = entry.ox + road.p[i], ay = entry.oy + road.p[i + 1], bx = entry.ox + road.p[i + 2], by = entry.oy + road.p[i + 3]
        const vx = bx - ax, vy = by - ay, len2 = vx * vx + vy * vy
        if (len2 < 0.01) continue
        const t = Math.max(0, Math.min(1, ((at.x - ax) * vx + (at.y - ay) * vy) / len2))
        const px = ax + vx * t, py = ay + vy * t, d = Math.hypot(px - at.x, py - at.y)
        if (d < bestD) { const len = Math.sqrt(len2); bestD = d; best = { x: px, y: py, ux: vx / len, uy: vy / len } }
      }
    }
    return best
  }
  function drawOwnCar() {
    const driving = autoWalk?.drive === true
    const at = driving ? { x: player.x, y: player.y } : ownCarAt
    if (!at) { ownCar.visible = false; return }
    let h = ownCarHeading, cx = at.x, cy = at.y
    if (!driving) {
      const side = roadsidePoint(at)
      if (side) { h = { ux: side.ux, uy: side.uy }; cx = side.x + -side.uy * 2.6; cy = side.y + side.ux * 2.6 }
    }
    const visible = Math.hypot(cx - player.x, cy - player.y) < 450
    ownCar.visible = visible
    if (visible) { drawVehicle(ownCar, cx, cy, h.ux, h.uy, PRIVATE_CAR, 0x2a4d7a, 0xd0ccc4, driving); placeDepth(ownCar, cx + cy + 2) }
  }
  function parkOwnCar() { ownCarAt = { x: player.x, y: player.y } }

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
    drawVehicle(g, cx, cy, ux, uy, { length: CAR_LENGTH, width: CAR_WIDTH, height: CAR_HEIGHT }, body, roof, front)
  }
  /** Kastenförmiges Fahrzeug in 2,5D: Zug, Auto, Lieferwagen – Maße in Metern, Fahrtrichtung (ux, uy). */
  function drawVehicle(g: PixiGraphics, cx: number, cy: number, ux: number, uy: number, dims: VehicleDims, body: number, roof: number, front: boolean) {
    g.clear()
    const CAR_HEIGHT = dims.height
    const nx = -uy, ny = ux, hl = dims.length / 2, hw = dims.width / 2
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

  // ── Busse ───────────────────────────────────────────────────────────
  // Je Linie ein Bus; Lage aus dem Fahrplan (lib/worldlab/busLine.ts), damit jeder
  // ihn an derselben Stelle sieht. Rechtsverkehr: eine halbe Spur rechts der Straßenmitte.
  let busLines: BusLine[] = []
  const buses: PixiGraphics[] = []
  const BUS_DIMS: VehicleDims = { length: 11.5, width: 2.5, height: 3.1 }
  const BUS_COLORS = [0xd9a21b, 0x2f6fb3, 0xc8102e, 0x3f8f5a, 0xe8e2d4]
  function setBuses(list: BusLine[]) {
    for (const bus of buses) bus.destroy()
    buses.length = 0
    busLines = list
    for (let i = 0; i < list.length; i++) { const g = new PIXI.Graphics(); g.visible = false; g.eventMode = 'none'; buses.push(g) }
  }
  function moveBuses() {
    const now = Date.now()
    for (let i = 0; i < busLines.length; i++) {
      const line = busLines[i], bus = buses[i]
      if (!line || !bus || line.points.length < 2) continue
      const state = busState(line, now)
      const { at, heading } = pointAlong(line.points, Math.max(0.5, Math.min(line.lengthM - 0.5, state.distanceM)))
      const p = toWorld(at)
      if (Math.hypot(p.x - player.x, p.y - player.y) > 450) { bus.visible = false; continue }
      // Stehend am Ende zeigt der Bus in die Richtung, in die er als Nächstes fährt
      const forward = state.direction === -1 || (state.direction === 0 && state.distanceM >= line.lengthM - 1) ? -1 : 1
      const ux = Math.cos(heading) * forward, uy = -Math.sin(heading) * forward
      const cx = p.x + -uy * 2.4, cy = p.y + ux * 2.4
      drawVehicle(bus, cx, cy, ux, uy, BUS_DIMS, BUS_COLORS[hash(line.id) % BUS_COLORS.length], 0xd0ccc4, state.direction !== 0)
      bus.visible = true
      placeDepth(bus, cx + cy + BUS_DIMS.length / 2)
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
  /** Friedhof an einem Weltpunkt (nur geladene Kacheln): Name und seine Flächen in den Nachbarkacheln. */
  function cemeteryAtWorld(p: { x: number; y: number }): { name: string; rings: Array<Array<{ x: number; y: number }>> } | null {
    const tx = anchorTile.x + Math.floor(p.x / tileSizeM), ty = anchorTile.y + Math.floor(p.y / tileSizeM)
    const ringsOf = (entry: Loaded | undefined, name: string | null) => (entry?.data.areas ?? [])
      .filter(area => area.k === 'cemetery' && (name === null || (area.n ?? 'Friedhof') === name))
      .map(area => { const ring: Array<{ x: number; y: number }> = []; for (let i = 0; i + 1 < area.p.length; i += 2) ring.push({ x: entry!.ox + area.p[i], y: entry!.oy + area.p[i + 1] }); return { ring, name: area.n ?? 'Friedhof' } })
    const hit = ringsOf(loaded.get(tileKey({ x: tx, y: ty })), null).find(item => insidePolygon(p, item.ring))
    if (!hit) return null
    const rings: Array<Array<{ x: number; y: number }>> = []
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) for (const item of ringsOf(loaded.get(tileKey({ x: tx + dx, y: ty + dy })), hit.name)) rings.push(item.ring)
    return { name: hit.name, rings }
  }
  /** Kapelle (Blockart Kirche) auf dem Friedhof oder bis 25 m an seinem Rand. */
  function chapelAtCemetery(rings: Array<Array<{ x: number; y: number }>>): { name: string; source?: string; at: GeoPoint } | null {
    let best: { name: string; source?: string; at: GeoPoint; d: number } | null = null
    for (const entry of loaded.values()) for (const block of entry.data.blocks) {
      if (block.k !== 'church') continue
      const c = { x: entry.ox + block.x, y: entry.oy + block.y }
      const d = rings.some(ring => insidePolygon(c, ring)) ? 0 : Math.min(...rings.map(ring => distanceToRing(c, ring)))
      if (d > 25 || (best && best.d <= d)) continue
      best = { name: block.nm ?? 'Friedhofskapelle', source: block.i, at: toGeo(c), d }
    }
    return best ? { name: best.name, source: best.source, at: best.at } : null
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
    const pick = node ? pickAt(event.offsetX, event.offsetY) : inputEnabled ? plantAt(event.offsetX, event.offsetY) : null
    if (pick) { hovering = true; options.onHover({ pick, x: event.clientX, y: event.clientY }) }
    else if (hovering) { hovering = false; options.onHover(null) }
  }
  /** Baum unter dem Mauszeiger: Krone als Rechteck über dem Fußpunkt, der vorderste gewinnt. */
  function plantAt(offsetX: number, offsetY: number): WorldPick | null {
    const centre = iso(camera.x, camera.y)
    const u = (offsetX - app.screen.width / 2) / zoom + centre.x, v = (offsetY - app.screen.height / 2) / zoom + centre.y
    const gx = (u + v / ISO_Y) / 2, gy = (v / ISO_Y - u) / 2
    let best: Loaded['plants'][number] | null = null
    for (const entry of loaded.values()) {
      if (gx < entry.ox - 40 || gx > entry.ox + entry.data.size + 40 || gy < entry.oy - 40 || gy > entry.oy + entry.data.size + 40) continue
      for (const plant of entry.plants) {
        const foot = iso(plant.x, plant.y)
        const halfW = TREE_WORLD.w * plant.k * 0.32, top = foot.y - TREE_WORLD.h * plant.k * 0.9
        if (u < foot.x - halfW || u > foot.x + halfW || v < top || v > foot.y) continue
        if (!best || plant.x + plant.y > best.x + best.y) best = plant
      }
    }
    return best ? { type: 'plant', at: toGeo({ x: best.x, y: best.y }), species: best.spot.species, source: best.spot.source, region: best.region, hint: best.spot.hint } : null
  }
  const pointerLeave = () => { light(null); if (hovering) { hovering = false; options.onHover?.(null) } }
  const pointerUp = (event: PointerEvent) => {
    if (!inputEnabled) { pressAt = null; return }
    if (!pressAt || Math.hypot(event.offsetX - pressAt.x, event.offsetY - pressAt.y) > 6 || !options.onPick) { pressAt = null; return }
    pressAt = null
    const pick = pickAt(event.offsetX, event.offsetY)
    if (pick) { options.onPick(pick); return }
    const plant = plantAt(event.offsetX, event.offsetY)
    if (plant) { options.onPick(plant); return }
    // Boden: Bildpunkt → Bodenpunkt (Höhe 0)
    const centre = iso(camera.x, camera.y)
    const u = (event.offsetX - app.screen.width / 2) / zoom + centre.x, v = (event.offsetY - app.screen.height / 2) / zoom + centre.y
    const groundX = (u + v / ISO_Y) / 2, groundY = (v / ISO_Y - u) / 2
    // W-13: Friedhofsfläche – öffnet „Friedhof betreten“ mit dem Namen aus OSM
    const cemetery = cemeteryAtWorld({ x: groundX, y: groundY })
    if (cemetery) {
      // Kapelle oder Trauerhalle auf dem Friedhof (oder bis 25 m davor) – eigener Raum (05.11.2026)
      const chapel = chapelAtCemetery(cemetery.rings)
      const tags: Record<string, string> = chapel ? { chapel_name: chapel.name, chapel_source: chapel.source ?? '', chapel_lat: String(chapel.at.lat), chapel_lon: String(chapel.at.lon) } : {}
      options.onPick({ type: 'landmark', landmark: { at: toGeo({ x: groundX, y: groundY }), name: cemetery.name, kind: 'cemetery', tags } })
      return
    }
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

  // ── Stimmung: Tageslicht, Wasser, Rauch, Pfeil (05.11.2026) ─────────
  let ambientAt = -1e9, smokeAt = 0
  let guide: { x: number; y: number; arrow: PixiGraphics } | null = null
  function ambientStep(now: number) {
    const geo = toGeo(player)
    if (now - ambientAt > 20000) {
      ambientAt = now
      sunNow = sunElevationDeg(geo.lat, geo.lon, Date.now())
      const tint = dayTint(sunNow)
      if (tint !== worldTint) {
        worldTint = tint
        ground.tint = tint
        lines.tint = tint
        for (const entry of loaded.values()) {
          for (const block of entry.blocks) if (!block.destroyed) (block as unknown as { tint: number }).tint = tint
          for (const tree of entry.trees) if (!tree.destroyed) (tree as unknown as { tint: number }).tint = tint
        }
      }
      for (const [lit, info] of windowLights) lit.visible = windowLit(sunNow, info.lon, Date.now(), info.key)
      // Neuer Tag: Laub der Bäume nachführen
      const day = plantDay(Date.now(), geo.lat)
      if (day !== plantDayNow) {
        plantDayNow = day
        for (const entry of loaded.values()) for (const plant of entry.plants) { const texture = plantTexture(plant.spot.species, plant.region); if (texture && !plant.sprite.destroyed) plant.sprite.texture = texture }
      }
    }
    // Wasser: zwei Gruppen blenden langsam im Wechsel
    const wave = 0.5 + 0.5 * Math.sin(now / 950)
    const glow = sunNow > -4 ? 1 : 0.45
    for (const entry of loaded.values()) if (entry.glint) { entry.glint[0].alpha = (0.12 + 0.4 * wave) * glow; entry.glint[1].alpha = (0.12 + 0.4 * (1 - wave)) * glow }
    // Rauch: nur in der Heizzeit, nur nahe der Kamera, wenige Wölkchen
    if (now - smokeAt > 70) {
      smokeAt = now
      smoke.clear()
      if (heatingSeason(geo.lat, Date.now()) && zoom >= 1.2) {
        let drawn = 0
        for (const entry of loaded.values()) for (const chimney of entry.chimneys) {
          if (drawn >= 24) break
          if (Math.abs(chimney.x - camera.x) > 180 || Math.abs(chimney.y - camera.y) > 180) continue
          drawn++
          for (let i = 0; i < 3; i++) {
            const t = ((now / 5200 + chimney.seed + i / 3) % 1)
            const at = iso(chimney.x + t * 2.6, chimney.y - t * 1.2, chimney.h + 0.3 + t * 5.5)
            smoke.circle(at.x, at.y, 0.45 + t * 1.5).fill({ color: 0xeeeeea, alpha: 0.32 * (1 - t) * Math.min(1, t * 6) })
          }
        }
      }
    }
    if (guide) {
      const bob = Math.sin(now / 260) * 1.6
      const top = iso(guide.x, guide.y, 20)
      guide.arrow.position.set(top.x, top.y + bob)
      guide.arrow.scale.set(Math.max(0.6, 2.4 / zoom))
    }
  }
  function setGuide(at: GeoPoint | null) {
    guideLayer.removeChildren().forEach(child => child.destroy())
    guide = null
    if (!at) return
    const p = toWorld(at)
    const arrow = new PIXI.Graphics()
    // Nach unten zeigender Pfeil, golden mit dunklem Rand
    arrow.poly([-2.2, -7, 2.2, -7, 2.2, -3.2, 4.2, -3.2, 0, 1.6, -4.2, -3.2, -2.2, -3.2]).fill(0xf2c94c).stroke({ width: 0.6, color: 0x3a2a0a })
    guideLayer.addChild(arrow)
    guide = { x: p.x, y: p.y, arrow }
  }

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
      if (autoWalk?.drive) parkOwnCar()
      autoWalk = null
      const wx = sx + sy, wy = sy - sx
      const length = Math.hypot(wx, wy)
      const speed = WALK_M_PER_S * (keys.has('shift') ? RUN_FACTOR : 1)
      movePlayer(player.x + wx / length * speed * dt, player.y + wy / length * speed * dt)
    }
    stepAutoWalk(dt)
    checkAnchor(dt)
    moveWalkers(logicStart)
    movePeers(logicStart, peersLastAt ? Math.min(0.25, (logicStart - peersLastAt) / 1000) : 0)
    peersLastAt = logicStart
    moveTrains()
    moveBuses()
    drawOwnCar()
    playerSprite.visible = autoWalk?.drive !== true
    // Die Kamera gleitet hinterher statt zu springen.
    const follow = 1 - Math.exp(-dt * 9)
    camera.x += (player.x - camera.x) * follow
    camera.y += (player.y - camera.y) * follow

    const foot = iso(player.x, player.y)
    playerSprite.position.set(foot.x, foot.y)
    if (playerKiesel) stepKiesel(playerKiesel, foot, logicStart)
    placePlayerDepth()
    updateSeeThrough(logicStart)
    playerName.position.set(foot.x, foot.y - 13)
    updateRoute(logicStart)
    ambientStep(logicStart)
    // Ein größer gezogenes Fenster kann den Zoom nach innen schieben.
    zoom = Math.max(zoom, minZoom())
    labels.visible = zoom >= LABEL_MIN_ZOOM
    for (const mark of marks.children) mark.scale.set(2.2 / zoom)
    for (const mark of eventLayer.children) mark.scale.set(2.2 / zoom)
    for (const mark of jobLayer.children) mark.scale.set(2.3 / zoom)
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
    speak(id, text) {
      const walker = walkers.get(id)
      if (!walker) return
      walker.bubble?.destroy(); walker.bubble = undefined
      if (!text) return
      const words = new PIXI.Text({ text, style: { fontFamily: 'system-ui, sans-serif', fontSize: 24, fill: 0x16241c, wordWrap: true, wordWrapWidth: 420, lineHeight: 30 } })
      words.anchor.set(0.5, 1)
      words.position.set(0, -10)
      const w = words.width + 22, h = words.height + 14
      const box = new PIXI.Graphics()
      box.roundRect(-w / 2, -10 - h + 7, w, h, 12).fill({ color: 0xf4f8f5 }).stroke({ color: 0x9db3a6, width: 2 })
      box.poly([-7, -10 + 7, 7, -10 + 7, 0, -10 + 17]).fill({ color: 0xf4f8f5 })
      const bubble = new PIXI.Container()
      bubble.addChild(box, words)
      bubble.scale.set(0.12)
      bubble.eventMode = 'none'
      labels.addChild(bubble)
      walker.bubble = bubble
    },
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
      const back = standPoint(walker.spec, walker.seed, walker.slot, walker.slots)
      if (back) startCommute(walker, back)
    },
    walkTo(target, withinM, onArrive) { autoWalk = { target, withinM, onArrive, path: [], planFor: null, planAt: 0, stuck: 0 } },
    driveTo(target, withinM, onArrive) {
      // Erst zum Auto, wenn es nicht hier steht; dann fahren. Ohne geparktes Auto startet die Fahrt hier.
      ownCarAt = null
      autoWalk = { target, withinM, onArrive, path: [], planFor: null, planAt: 0, stuck: 0, drive: true }
    },
    setOwnVehicle(at) {
      if (autoWalk?.drive) return
      ownCarAt = at ? toWorld(at) : null
    },
    roadRouteLengthM(to) {
      const target = toWorld(to)
      const planned = planRoute(target)
      if (planned.length <= 1 && Math.hypot(target.x - player.x, target.y - player.y) > 30) return null
      return Math.round(pathLength([{ x: player.x, y: player.y }, ...planned]))
    },
    setPlayerName(name) { playerName.text = name.slice(0, 40) },
    setSites(list) { sites = list; drawSites() },
    setBeacons(list) { beaconList = list; drawBeacons() },
    setRailLines(list) { setTrains(list) },
    setBusLines(list) { setBuses(list) },
    busAt(lineId) { const line = busLines.find(item => item.id === lineId); return line ? busState(line, Date.now()) : null },
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
    stopWalking() { if (autoWalk?.drive) parkOwnCar(); autoWalk = null },
    setInputEnabled(enabled) { inputEnabled = enabled; if (!enabled) { keys.clear(); if (autoWalk?.drive) parkOwnCar(); autoWalk = null } },
    distanceTo(at) { const p = toWorld(at); return Math.hypot(p.x - player.x, p.y - player.y) },
    distanceToPlace(at) {
      const p = toWorld(at)
      const direct = Math.hypot(p.x - player.x, p.y - player.y)
      // Ein Wahrzeichen liegt oft mitten im Haus; man kommt nur bis an die Wand (Häuser sind Hindernisse).
      const tx = anchorTile.x + Math.floor(p.x / tileSizeM), ty = anchorTile.y + Math.floor(p.y / tileSizeM)
      let best = direct
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const entry = loaded.get(tileKey({ x: tx + dx, y: ty + dy }))
        if (!entry) continue
        for (const f of entry.footprints) {
          if (p.x < f.minX || p.x > f.maxX || p.y < f.minY || p.y > f.maxY || !insidePolygon(p, f.ring)) continue
          best = Math.min(best, distanceToRing(player, f.ring))
        }
      }
      return best
    },
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
    tileReadyAt(at) { const p = toWorld(at); return tileDoneAt(p.x, p.y) },
    setView(next) { view = { ...next }; applyView() },
    setPlayerLook,
    setPeers,
    peerAt(id) { const peer = peers.get(id); return peer ? toGeo({ x: peer.x, y: peer.y }) : null },
    playerEmote(text) {
      playerBubble?.bubble.destroy()
      playerBubble = { bubble: emoteBubble(text), until: performance.now() + 4000 }
    },
    setGuideArrow: setGuide,
    setJobMark(mark) {
      for (const old of jobLayer.removeChildren()) old.destroy({ children: true })
      if (!mark) return
      const p = toWorld(mark.at)
      const at = iso(p.x, p.y, 16)
      const sign = new PIXI.Container()
      const text = new PIXI.Text({ text: '💼 ' + mark.text, style: { fontFamily: 'system-ui, sans-serif', fontSize: 40, fontWeight: '800', fill: 0x10302c } })
      text.anchor.set(0.5, 0.5); text.scale.set(0.13)
      const w = text.width + 3, h = text.height + 1.6
      const plate = new PIXI.Graphics()
      plate.roundRect(-w / 2, -h / 2, w, h, 1.4).fill({ color: 0xf2c94c, alpha: 0.97 }).stroke({ width: 0.5, color: 0x3a2a0a })
      plate.poly([-1.2, h / 2, 1.2, h / 2, 0, h / 2 + 1.6]).fill(0xf2c94c).stroke({ width: 0.4, color: 0x3a2a0a })
      sign.addChild(plate, text)
      sign.position.set(at.x, at.y)
      sign.scale.set(2.3 / zoom)
      jobLayer.addChild(sign)
    },
    setEventMarks(list) {
      for (const old of eventLayer.removeChildren()) old.destroy({ children: true })
      for (const item of list) {
        const p = toWorld({ lat: item.lat, lon: item.lon })
        const at = iso(p.x, p.y, 16)
        const mark = new PIXI.Container()
        const text = new PIXI.Text({ text: item.text, style: { fontFamily: 'system-ui, sans-serif', fontSize: 40, fontWeight: '800', fill: 0xfff4d6 } })
        text.anchor.set(0.5, 0.5); text.scale.set(0.13)
        const w = text.width + 3, h = text.height + 1.6
        const plate = new PIXI.Graphics()
        plate.roundRect(-w / 2, -h / 2, w, h, 1.4).fill({ color: item.running ? 0x8a2f52 : 0x4a2f6a, alpha: 0.95 }).stroke({ width: 0.5, color: 0xf0c96a })
        mark.addChild(plate, text)
        mark.position.set(at.x, at.y)
        mark.scale.set(2.2 / zoom)
        eventLayer.addChild(mark)
      }
    },
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
