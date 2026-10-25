// app/world-lab/worldEngine.ts
// Prototyp „eine Welt“ mit PixiJS – die Zeichenmaschine ohne React.
//
// WorldLab.tsx stellt nur Bühne und Anzeige; Kacheln, NOXIA-Gebäude und Bilder
// kommen über die Optionen herein. So lässt sich dieselbe Maschine auch ohne
// Anmeldung und Datenbank mit Testkacheln messen.

import type { Application, Container, Graphics as PixiGraphics, Texture } from 'pixi.js'
import { geoToMerc, mercPerGroundMetre, mercToGeo, tileAt, tileKey, tileOrigin, TILE_SIZE_MERC, type GeoPoint, type TileId } from '@/lib/worldlab/mercator'
import { AREA_COLORS, AREA_OUTLINES, AREA_PATTERNS, BLOCK_STYLES, TRACK_STYLE, NOXIA_DEFAULT_LOOK, NOXIA_LOOKS, type BlockArt, GROUND_COLOR, OUTLINE, RIVER_STYLE, ROAD_STYLES } from '@/lib/worldlab/blocks'
import { iso, ISO_Y, leftToRight, roofMatrix, wallMatrix, type Affine } from '@/lib/worldlab/facade'
import { paintPattern, patternMatrix, PATTERN_PX } from '@/lib/worldlab/areaPatterns'
import { streetLabels } from '@/lib/worldlab/streetLabels'
import { paintTree, treeVariant, TREE_PX, TREE_VARIANTS, TREE_WORLD } from '@/lib/worldlab/treeSprites'
import { FrameStats, type FrameSummary } from '@/lib/worldlab/frameStats'
import type { BlockKind, SimplifiedTile, TileBlock } from '@/lib/worldlab/simplify'
import { growView, minZoomForTiles, tilesForView, type ViewRect } from '@/lib/worldlab/viewTiles'

type Pixi = typeof import('pixi.js')

export type NoxiaBuilding = { id: string; typeId: string; name: string; lat: number; lon: number; w: number; d: number; rotation?: number }
export type Hud = { frame: FrameSummary; rebuildsPerS: number; here: { loaded: boolean; blocks: number; built: boolean }; tiles: number; loading: number; blocks: number; lat: number; lon: number; near: string; zoom: number }

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
  onError: (message: string) => void
}

/** Was unter dem Zeiger lag, als geklickt wurde. */
export type WorldPick =
  | { type: 'person'; id: string }
  | { type: 'building'; at: GeoPoint; address?: string; name?: string; kind: BlockKind; noxiaId?: string }
  | { type: 'noxia'; noxiaId: string; at: GeoPoint }
  | { type: 'ground'; at: GeoPoint }

/** Eine Person auf der Karte. `anchor`: Haus, vor dem sie sich aufhält; sonst geht sie die Straßen entlang. */
export interface WorldPerson { id: string; label: string; anchor?: GeoPoint | null; /** Halbe Größe des Hauses, vor dem sie steht (m). */ anchorRadiusM?: number; tint?: number }

export interface WorldEngine {
  jump: (at: GeoPoint) => void
  /** Personen setzen (ersetzt die bisherige Liste). */
  setPeople: (people: WorldPerson[]) => void
  /** Wo eine Person gerade steht. */
  personAt: (id: string) => GeoPoint | null
  /** Person geht in `seconds` Sekunden zu `to` und bleibt dort, bis `release` sie freigibt. */
  sendPerson: (id: string, to: GeoPoint, seconds: number) => void
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
  world.addChild(ground, lines, objects, labels)
  app.stage.addChild(world)

  const player = { ...toWorld(startGeo) }
  const camera = { ...player }
  let zoom = 2.6

  const playerSprite = new PIXI.Graphics()
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
  playerSprite.zIndex = player.x + player.y
  addObject(playerSprite)

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
  type Loaded = { tile: TileId; data: SimplifiedTile; ox: number; oy: number; ground: PixiGraphics | null; lines: PixiGraphics | null; blocks: Container[]; trees: Container[]; labels: Container[]; done: boolean }
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

  function drawBlock(block: TileBlock, ox: number, oy: number) {
    const style = BLOCK_STYLES[block.k]
    const g = new PIXI.Graphics()
    let cos = Math.cos(block.a), sin = Math.sin(block.a)
    const hw = block.w / 2, hd = block.d / 2
    const cx = ox + block.x, cy = oy + block.y
    // Steht hier ein NOXIA-Gebäude, übernimmt es den echten Grundriss: gleiche
    // Lage, Größe und Drehung wie die Nachbarn, aber sein eigenes Dach.
    const owner = noxiaOn(cx, cy, hw, hd, cos, sin)
    const look = owner ? { ...NOXIA_DEFAULT_LOOK, ...NOXIA_LOOKS[owner.typeId] } : null
    const eave = (look?.levels ?? block.l) * style.storeyM
    let c: Array<{ x: number; y: number }>
    if (block.f && block.f.length >= 8) {
      const ring: Array<{ x: number; y: number }> = []
      for (let i = 0; i < block.f.length; i += 2) ring.push({ x: ox + block.f[i], y: oy + block.f[i + 1] })
      if (ring.length > 3 && ring[0].x === ring[ring.length - 1].x && ring[0].y === ring[ring.length - 1].y) ring.pop()
      c = drawPrism(g, block.k, ring, eave, { x: -sin, y: cos }, look?.roof)
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
    // Für Klicks: was dieses Gebäude ist.
    g.eventMode = 'static'
    ;(g as unknown as { pick: WorldPick }).pick = { type: 'building', at: toGeo({ x: cx, y: cy }), address: block.h, name: block.nm, kind: block.k, noxiaId: owner?.id }
    return g
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
    for (const river of data.rivers) { const p = path(river); l.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) l.lineTo(p[i], p[i + 1]); l.stroke({ width: RIVER_STYLE.widthM * 0.75, color: RIVER_STYLE.color, cap: 'round', join: 'round' }) }
    for (const road of data.roads) {
      const style = ROAD_STYLES[road.c], p = path(road.p)
      l.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) l.lineTo(p[i], p[i + 1])
      l.stroke({ width: style.widthM * 0.75, color: style.color, cap: 'round', join: 'round' })
    }
    for (const track of data.tracks ?? []) {
      const p = path(track)
      const lane = (width: number, color: number) => { l.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) l.lineTo(p[i], p[i + 1]); l.stroke({ width: width * 0.75, color, cap: 'round', join: 'round' }) }
      lane(TRACK_STYLE.widthM + 0.6, TRACK_STYLE.laneColor)
      lane(TRACK_STYLE.widthM, TRACK_STYLE.color)
      lane(0.25, TRACK_STYLE.laneColor)
    }
    for (const mark of data.marks ?? []) {
      const p = path(mark)
      l.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) l.lineTo(p[i], p[i + 1])
      l.stroke({ width: 0.12 * 0.75 * 4, color: 0xf2f5ec, cap: 'butt', join: 'miter' })
    }
    ground.addChild(g)
    lines.addChild(l)
    entry.ground = g
    entry.lines = l
    // Straßennamen: in Laufrichtung, Text groß gesetzt und verkleinert, damit er scharf bleibt.
    for (const label of streetLabels(data.roads, (x, y) => iso(ox + x, oy + y))) {
      const text = new PIXI.Text({ text: label.name, style: { fontFamily: 'system-ui, sans-serif', fontSize: 30, fontWeight: '600', fill: 0x3d4a52, stroke: { color: 0xf4f1e8, width: 7, join: 'round' } } })
      text.anchor.set(0.5)
      text.scale.set(0.14)
      const at = iso(ox + label.x, oy + label.y)
      text.position.set(at.x, at.y)
      text.rotation = label.angle
      labels.addChild(text)
      entry.labels.push(text)
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
    loaded.set(key, { tile, data, ox, oy, ground: null, lines: null, blocks: [], trees: [], labels: [], done: false })
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
        for (let i = from; i < to; i++) chunk.push(drawBlock(entry.data.blocks[i], entry.ox, entry.oy))
        for (const block of chunk) addObject(block)
        entry.blocks.push(...chunk)
        budget -= to - from
      }
      if (entry.blocks.length >= entry.data.blocks.length) { entry.done = true; building.shift() }
    }
  }

  function dropTile(key: string, entry: Loaded) {
    entry.ground?.destroy()
    entry.lines?.destroy()
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
  void (async () => {
    for (const building of noxia) {
      if (disposed) return
      const visual = options.noxiaVisual?.(building.typeId)
      const foot = iso(building.x, building.y)
      let stand: Container | null = null
      if (visual?.mapAsset) {
        try {
          const texture = await PIXI.Assets.load({ src: visual.mapAsset, data: { resolution: 2 } })
          if (disposed) return
          const sprite = new PIXI.Sprite(texture)
          const side = (building.w + building.d) * 1.18 * ((visual.mapScale ?? 1.7) / 1.7)
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
      stand.visible = !building.claimed
      addObject(stand)
    }
  })()

  // ── Personen ────────────────────────────────────────────────────────
  // Jede Person ist eine kleine Figur mit Beschriftung. Wer ein Zuhause oder
  // eine Arbeit in der Nähe hat, steht davor; die anderen gehen eine Straße
  // der geladenen Kacheln auf und ab. Gespräche können sie irgendwohin schicken.
  type Walker = {
    spec: WorldPerson; figure: PixiGraphics; label: InstanceType<typeof PIXI.Text>
    x: number; y: number; seed: number
    route: Array<{ x: number; y: number }> | null; routeLength: number
    sent: { from: { x: number; y: number }; to: { x: number; y: number }; start: number; seconds: number } | null
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
    return g
  }
  /** Eine Straße für eine Person: aus den geladenen Kacheln, fest nach ihrer Kennung gewählt. */
  function pickRoute(seed: number) {
    const near: Array<Array<{ x: number; y: number }>> = []
    for (const entry of loaded.values()) {
      if (Math.hypot(entry.ox + tileSizeM / 2 - player.x, entry.oy + tileSizeM / 2 - player.y) > tileSizeM * 1.6) continue
      for (const road of entry.data.roads) {
        if (road.c === 'main' || road.p.length < 4) continue
        const pts: Array<{ x: number; y: number }> = []
        for (let i = 0; i < road.p.length; i += 2) pts.push({ x: entry.ox + road.p[i], y: entry.oy + road.p[i + 1] })
        near.push(pts)
      }
    }
    if (!near.length) return null
    return near[seed % near.length]
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
      if (known) { known.spec = spec; known.label.text = spec.label; continue }
      const seed = hash(spec.id)
      const figure = makeFigure(spec.tint ?? PERSON_COLORS[seed % PERSON_COLORS.length])
      ;(figure as unknown as { pick: WorldPick }).pick = { type: 'person', id: spec.id }
      const label = new PIXI.Text({ text: spec.label, style: { fontFamily: 'system-ui, sans-serif', fontSize: 26, fontWeight: '600', fill: 0x1f2a30, stroke: { color: 0xf8f6ef, width: 6, join: 'round' } } })
      label.anchor.set(0.5, 1)
      label.scale.set(0.12)
      labels.addChild(label)
      const start = spec.anchor ? toWorld(spec.anchor) : { x: player.x + (seed % 40) - 20, y: player.y + ((seed >> 8) % 40) - 20 }
      const walker: Walker = { spec, figure, label, x: start.x, y: start.y, seed, route: null, routeLength: 0, sent: null }
      walkers.set(spec.id, walker)
      placeDepth(figure, start.x + start.y)
    }
  }
  function moveWalkers(now: number) {
    for (const walker of walkers.values()) {
      let x = walker.x, y = walker.y
      if (walker.sent) {
        const t = Math.min(1, (now - walker.sent.start) / 1000 / walker.sent.seconds)
        x = walker.sent.from.x + (walker.sent.to.x - walker.sent.from.x) * t
        y = walker.sent.from.y + (walker.sent.to.y - walker.sent.from.y) * t
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
        if (!walker.route || Math.hypot(walker.x - player.x, walker.y - player.y) > 260) {
          const route = pickRoute(walker.seed)
          if (route) {
            walker.route = route
            walker.routeLength = route.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - route[i].x, p.y - route[i].y), 0)
          }
        }
        if (walker.route && walker.routeLength > 1) {
          const speed = 1.1 + (walker.seed % 5) * 0.12
          const run = (now / 1000 * speed + walker.seed % 997) % (walker.routeLength * 2)
          const at = along(walker.route, run <= walker.routeLength ? run : walker.routeLength * 2 - run)
          // Auf dem Gehweg: etwas neben der Straßenmitte
          x = at.x + ((walker.seed % 2) ? 2.2 : -2.2); y = at.y + ((walker.seed % 2) ? -2.2 : 2.2)
        }
      }
      walker.x = x; walker.y = y
      const foot = iso(x, y)
      walker.figure.position.set(foot.x, foot.y)
      placeDepth(walker.figure, x + y)
      walker.label.position.set(foot.x, foot.y - 9.5)
      const near = Math.hypot(x - player.x, y - player.y) < 200
      walker.figure.visible = near
      walker.label.visible = near && zoom >= 2.2
    }
  }

  // ── Selbst gehen ────────────────────────────────────────────────────
  let autoWalk: { target: () => GeoPoint | null; withinM: number; onArrive?: () => void } | null = null
  function stepAutoWalk(dt: number) {
    if (!autoWalk) return
    const target = autoWalk.target()
    if (!target) { autoWalk = null; return }
    const to = toWorld(target)
    const dx = to.x - player.x, dy = to.y - player.y, distance = Math.hypot(dx, dy)
    if (distance <= autoWalk.withinM) { const done = autoWalk.onArrive; autoWalk = null; done?.(); return }
    const step = Math.min(distance - autoWalk.withinM * 0.8, WALK_M_PER_S * dt)
    player.x += dx / distance * step
    player.y += dy / distance * step
  }

  // ── Klicks ──────────────────────────────────────────────────────────
  // Ein Klick ist ein Zeigerdruck ohne nennenswertes Ziehen. Getroffen wird das
  // oberste Objekt unter dem Zeiger (Person, Gebäude), sonst der Boden.
  let pressAt: { x: number; y: number } | null = null
  const pointerDown = (event: PointerEvent) => { pressAt = { x: event.offsetX, y: event.offsetY } }
  const pointerUp = (event: PointerEvent) => {
    if (!inputEnabled) { pressAt = null; return }
    if (!pressAt || Math.hypot(event.offsetX - pressAt.x, event.offsetY - pressAt.y) > 6 || !options.onPick) { pressAt = null; return }
    pressAt = null
    const hit = app.renderer.events.rootBoundary.hitTest(event.offsetX, event.offsetY)
    let node: Container | null = hit
    while (node && !(node as unknown as { pick?: WorldPick }).pick) node = node.parent
    const pick = (node as unknown as { pick?: WorldPick } | null)?.pick
    if (pick) { options.onPick(pick); return }
    // Boden: Bildpunkt → Bodenpunkt (Höhe 0)
    const centre = iso(camera.x, camera.y)
    const u = (event.offsetX - app.screen.width / 2) / zoom + centre.x, v = (event.offsetY - app.screen.height / 2) / zoom + centre.y
    const groundX = (u + v / ISO_Y) / 2, groundY = (v / ISO_Y - u) / 2
    options.onPick({ type: 'ground', at: toGeo({ x: groundX, y: groundY }) })
  }
  app.canvas.addEventListener('pointerdown', pointerDown)
  app.canvas.addEventListener('pointerup', pointerUp)

  // ── Eingabe ─────────────────────────────────────────────────────────
  const keys = new Set<string>()
  let inputEnabled = true
  const down = (event: KeyboardEvent) => {
    if (!inputEnabled) return
    const target = event.target as HTMLElement | null
    if (target?.closest?.('input,textarea,select')) return
    const key = event.key.toLowerCase()
    if (['w', 'a', 's', 'd', 'shift'].includes(key)) { keys.add(key); if (key !== 'shift') event.preventDefault() }
  }
  const up = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase())
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
      player.x += wx / length * speed * dt
      player.y += wy / length * speed * dt
    }
    stepAutoWalk(dt)
    moveWalkers(logicStart)
    // Die Kamera gleitet hinterher statt zu springen.
    const follow = 1 - Math.exp(-dt * 9)
    camera.x += (player.x - camera.x) * follow
    camera.y += (player.y - camera.y) * follow

    const foot = iso(player.x, player.y)
    playerSprite.position.set(foot.x, foot.y)
    placePlayerDepth()
    // Ein größer gezogenes Fenster kann den Zoom nach innen schieben.
    zoom = Math.max(zoom, minZoom())
    labels.visible = zoom >= LABEL_MIN_ZOOM
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
      options.onHud({ frame: stats.summary(), rebuildsPerS, here, tiles: loaded.size, loading: inFlight.size + building.length, blocks, lat: geo.lat, lon: geo.lon, near, zoom })
    }
    logicMs = performance.now() - logicStart
  })

  return {
    jump(at) {
      const p = toWorld(at)
      player.x = p.x; player.y = p.y; camera.x = p.x; camera.y = p.y
      lastViewKey = ''
    },
    position: () => toGeo(player),
    setPeople,
    personAt(id) { const walker = walkers.get(id); return walker ? toGeo(walker) : null },
    sendPerson(id, to, seconds) {
      const walker = walkers.get(id)
      if (walker) walker.sent = { from: { x: walker.x, y: walker.y }, to: toWorld(to), start: performance.now(), seconds: Math.max(1, seconds) }
    },
    releasePerson(id) { const walker = walkers.get(id); if (walker) walker.sent = null },
    walkTo(target, withinM, onArrive) { autoWalk = { target, withinM, onArrive } },
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
    reloadTiles() {
      for (const [key, entry] of loaded) dropTile(key, entry)
      fetched.clear()
      inFlight.clear()
      generation++
      building = []
      lastViewKey = ''
    },
    destroy() {
      disposed = true
      app.canvas.removeEventListener('pointerdown', pointerDown)
      app.canvas.removeEventListener('pointerup', pointerUp)
      for (const run of cleanup) run()
      try { app.destroy(true, { children: true }) } catch { /* schon weg */ }
    },
  }
}
