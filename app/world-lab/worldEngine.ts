// app/world-lab/worldEngine.ts
// Prototyp „eine Welt“ mit PixiJS – die Zeichenmaschine ohne React.
//
// WorldLab.tsx stellt nur Bühne und Anzeige; Kacheln, NOXIA-Gebäude und Bilder
// kommen über die Optionen herein. So lässt sich dieselbe Maschine auch ohne
// Anmeldung und Datenbank mit Testkacheln messen.

import type { Application, Container, Graphics as PixiGraphics } from 'pixi.js'
import { geoToMerc, mercPerGroundMetre, mercToGeo, tileAt, tileKey, tileOrigin, TILE_SIZE_MERC, type GeoPoint, type TileId } from '@/lib/worldlab/mercator'
import { AREA_COLORS, BLOCK_STYLES, GROUND_COLOR, OUTLINE, RIVER_STYLE, ROAD_STYLES } from '@/lib/worldlab/blocks'
import { FrameStats, type FrameSummary } from '@/lib/worldlab/frameStats'
import type { SimplifiedTile, TileBlock } from '@/lib/worldlab/simplify'
import { growView, minZoomForTiles, tilesForView, type ViewRect } from '@/lib/worldlab/viewTiles'

type Pixi = typeof import('pixi.js')

export type NoxiaBuilding = { id: string; typeId: string; name: string; lat: number; lon: number; w: number; d: number }
export type Hud = { frame: FrameSummary; rebuildsPerS: number; tiles: number; loading: number; blocks: number; lat: number; lon: number; near: string; zoom: number }

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
  loadTile: (tile: TileId) => Promise<SimplifiedTile>
  loadNoxia?: () => Promise<NoxiaBuilding[]>
  noxiaVisual?: (typeId: string) => { mapAsset?: string; mapScale?: number } | null | undefined
  onHud: (hud: Hud) => void
  onError: (message: string) => void
}

export interface WorldEngine {
  jump: (at: GeoPoint) => void
  destroy: () => void
}

// Schrägansicht 2:1 – ein Meter nach Osten geht nach rechts unten, ein Meter nach Süden nach links unten.
const ISO_Y = 0.5
const HEIGHT = 0.82
const iso = (x: number, y: number, h = 0) => ({ x: x - y, y: (x + y) * ISO_Y - h * HEIGHT })

// Geladen wird, was der Bildschirm zeigt – beim Herauszoomen mehr Kacheln.
// Damit das begrenzt bleibt, endet das Herauszoomen bei rund 60 Kacheln Bodenfläche.
const MAX_VIEW_TILES = 60
const PRELOAD_MARGIN = 40         // Bildeinheiten: knapp außerhalb schon laden
const HEIGHT_MARGIN = 40          // Bildeinheiten: hohe Gebäude, deren Fuß unter dem Bildrand steht
const KEEP_MARGIN_TILES = 0.6     // erst so weit außerhalb fällt eine Kachel weg
const MAX_ZOOM = 7
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
  const objects = new PIXI.Container({ isRenderGroup: true })
  objects.sortableChildren = true
  world.addChild(ground, objects)
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

  // ── Kacheln ─────────────────────────────────────────────────────────
  // Eine gezeigte Kachel wird nicht in einem Bild aufgebaut, sondern Stück für
  // Stück (BUILD_BUDGET): erst der Boden, dann die Blöcke in Portionen.
  type Loaded = { tile: TileId; data: SimplifiedTile; ox: number; oy: number; ground: PixiGraphics | null; blocks: Container[]; done: boolean }
  const loaded = new Map<string, Loaded>()
  const fetched = new Map<string, SimplifiedTile>()
  const inFlight = new Set<string>()
  let building: string[] = []
  let keepKeys = new Set<string>()

  function drawBlock(block: TileBlock, ox: number, oy: number) {
    const style = BLOCK_STYLES[block.k]
    const g = new PIXI.Graphics()
    const cos = Math.cos(block.a), sin = Math.sin(block.a)
    const corner = (lx: number, ly: number) => ({ x: ox + block.x + lx * cos - ly * sin, y: oy + block.y + lx * sin + ly * cos })
    const hw = block.w / 2, hd = block.d / 2
    const c = [corner(-hw, -hd), corner(hw, -hd), corner(hw, hd), corner(-hw, hd)]
    const eave = block.l * style.storeyM
    // Wände: nur die beiden, die zur Kamera zeigen.
    for (let i = 0; i < 4; i++) {
      const a = c[i], b = c[(i + 1) % 4]
      const nx = b.y - a.y, ny = -(b.x - a.x)
      if (nx + ny <= 0) continue
      const a0 = iso(a.x, a.y), b0 = iso(b.x, b.y), a1 = iso(a.x, a.y, eave), b1 = iso(b.x, b.y, eave)
      g.poly([a0.x, a0.y, b0.x, b0.y, b1.x, b1.y, a1.x, a1.y]).fill(nx - ny > 0 ? style.wallLight : style.wallDark).stroke({ width: 0.35, color: OUTLINE, alpha: 0.7 })
    }
    // Dach: Walmdach über der langen Achse; bei flachen Bauten fast eben.
    const ridgeHalf = Math.max(0, hw - hd)
    const r = [corner(-ridgeHalf, 0), corner(ridgeHalf, 0)]
    const top = eave + style.roofM
    const faces: Array<{ pts: Array<{ x: number; y: number; h: number }>; n: { x: number; y: number } }> = [
      { pts: [{ ...c[0], h: eave }, { ...c[1], h: eave }, { ...r[1], h: top }, { ...r[0], h: top }], n: { x: sin, y: -cos } },
      { pts: [{ ...c[2], h: eave }, { ...c[3], h: eave }, { ...r[0], h: top }, { ...r[1], h: top }], n: { x: -sin, y: cos } },
      { pts: [{ ...c[1], h: eave }, { ...c[2], h: eave }, { ...r[1], h: top }], n: { x: cos, y: sin } },
      { pts: [{ ...c[3], h: eave }, { ...c[0], h: eave }, { ...r[0], h: top }], n: { x: -cos, y: -sin } },
    ]
    faces.sort((a, b) => (a.n.x + a.n.y) - (b.n.x + b.n.y))
    for (const face of faces) {
      const pts = face.pts.flatMap(p => { const s = iso(p.x, p.y, p.h); return [s.x, s.y] })
      g.poly(pts).fill(shade(style.roof, 0.86 + 0.14 * Math.max(-1, Math.min(1, face.n.x - face.n.y)))).stroke({ width: 0.3, color: OUTLINE, alpha: 0.55 })
    }
    // Tiefe: der vorderste Fußpunkt entscheidet, was vor wem steht.
    g.zIndex = Math.max(...c.map(p => p.x + p.y))
    return g
  }

  function drawGround(entry: Loaded) {
    const { data, ox, oy } = entry
    const g = new PIXI.Graphics()
    const path = (flat: number[]) => { const out: number[] = []; for (let i = 0; i < flat.length; i += 2) { const s = iso(ox + flat[i], oy + flat[i + 1]); out.push(s.x, s.y) } return out }
    for (const area of data.areas) g.poly(path(area.p)).fill(AREA_COLORS[area.k])
    for (const river of data.rivers) { const p = path(river); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.stroke({ width: RIVER_STYLE.widthM * 0.75, color: RIVER_STYLE.color, cap: 'round', join: 'round' }) }
    for (const road of data.roads) {
      const style = ROAD_STYLES[road.c], p = path(road.p)
      g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1])
      g.stroke({ width: style.widthM * 0.75, color: style.color, cap: 'round', join: 'round' })
    }
    ground.addChild(g)
    entry.ground = g
  }

  function showTile(tile: TileId, data: SimplifiedTile) {
    const key = tileKey(tile)
    if (loaded.has(key) || disposed) return
    const ox = (tile.x - anchorTile.x) * tileSizeM, oy = (tile.y - anchorTile.y) * tileSizeM
    loaded.set(key, { tile, data, ox, oy, ground: null, blocks: [], done: false })
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
        budget -= 20 + (entry.data.roads.length + entry.data.rivers.length + entry.data.areas.length) / 2
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
    try {
      const data = await options.loadTile(tile)
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
  const noxia: Array<NoxiaBuilding & { x: number; y: number }> = []
  void (async () => {
    try {
      const buildings = options.loadNoxia ? await options.loadNoxia() : []
      for (const building of buildings) {
        if (disposed) return
        const at = toWorld({ lat: building.lat, lon: building.lon })
        noxia.push({ ...building, ...at })
        const visual = options.noxiaVisual?.(building.typeId)
        const foot = iso(at.x, at.y)
        if (visual?.mapAsset) {
          try {
            const texture = await PIXI.Assets.load({ src: visual.mapAsset, data: { resolution: 2 } })
            if (disposed) return
            const sprite = new PIXI.Sprite(texture)
            const side = (building.w + building.d) * 1.18 * ((visual.mapScale ?? 1.7) / 1.7)
            sprite.anchor.set(0.5, 0.86)
            sprite.width = side; sprite.height = side
            sprite.position.set(foot.x, foot.y + (building.w + building.d) / 2 * ISO_Y)
            sprite.zIndex = at.x + at.y + (building.w + building.d) / 2
            addObject(sprite)
            continue
          } catch { /* ohne Bild: Block */ }
        }
        const block = drawBlock({ x: at.x, y: at.y, w: building.w, d: building.d, a: 0, k: 'hall', l: 2 }, 0, 0)
        block.tint = 0x9fc4e8
        addObject(block)
      }
    } catch { /* ohne Anmeldung keine NOXIA-Gebäude */ }
  })()

  // ── Eingabe ─────────────────────────────────────────────────────────
  const keys = new Set<string>()
  const down = (event: KeyboardEvent) => {
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
      const wx = sx + sy, wy = sy - sx
      const length = Math.hypot(wx, wy)
      const speed = WALK_M_PER_S * (keys.has('shift') ? RUN_FACTOR : 1)
      player.x += wx / length * speed * dt
      player.y += wy / length * speed * dt
    }
    // Die Kamera gleitet hinterher statt zu springen.
    const follow = 1 - Math.exp(-dt * 9)
    camera.x += (player.x - camera.x) * follow
    camera.y += (player.y - camera.y) * follow

    const foot = iso(player.x, player.y)
    playerSprite.position.set(foot.x, foot.y)
    placePlayerDepth()
    // Ein größer gezogenes Fenster kann den Zoom nach innen schieben.
    zoom = Math.max(zoom, minZoom())
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
      options.onHud({ frame: stats.summary(), rebuildsPerS, tiles: loaded.size, loading: inFlight.size + building.length, blocks, lat: geo.lat, lon: geo.lon, near, zoom })
    }
    logicMs = performance.now() - logicStart
  })

  return {
    jump(at) {
      const p = toWorld(at)
      player.x = p.x; player.y = p.y; camera.x = p.x; camera.y = p.y
      lastViewKey = ''
    },
    destroy() {
      disposed = true
      for (const run of cleanup) run()
      try { app.destroy(true, { children: true }) } catch { /* schon weg */ }
    },
  }
}
