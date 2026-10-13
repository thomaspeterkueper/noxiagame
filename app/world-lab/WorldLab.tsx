'use client'

// app/world-lab/WorldLab.tsx
// Prototyp „eine Welt“ mit PixiJS. Abgetrennt vom Spiel: liest nur, schreibt nichts.
//
// Was hier anders ist als in der begehbaren Szene:
//   - Es gibt keine Szene, die ersetzt wird. Die Welt besteht aus Kacheln, die
//     um die Spielfigur herum dazukommen und hinter ihr wieder wegfallen.
//   - Gezeichnet wird über die Grafikkarte; Bewegung läuft je Bild, nicht je Tastendruck.
//   - Reale Orte sind stark vereinfacht: Blöcke aus einem Baukasten (lib/worldlab/blocks.ts).

import { useEffect, useRef, useState } from 'react'
import type { Application, Container, Graphics as PixiGraphics } from 'pixi.js'
import { getSessionInfo } from '@/lib/supabase/auth'
import { getBuildingVisual } from '@/lib/game/buildings/visuals'
import { geoToMerc, mercPerGroundMetre, mercToGeo, tileAt, tileKey, tileOrigin, TILE_SIZE_MERC, type GeoPoint, type TileId } from '@/lib/worldlab/mercator'
import { AREA_COLORS, BLOCK_STYLES, GROUND_COLOR, OUTLINE, RIVER_STYLE, ROAD_STYLES } from '@/lib/worldlab/blocks'
import type { SimplifiedTile, TileBlock } from '@/lib/worldlab/simplify'

type NoxiaBuilding = { id: string; typeId: string; name: string; lat: number; lon: number; w: number; d: number }
type Hud = { fps: number; tiles: number; loading: number; blocks: number; lat: number; lon: number; near: string }

const PLACES: Array<{ label: string; at: GeoPoint }> = [
  { label: 'Sundern Mitte', at: { lat: 51.3262, lon: 8.0 } },
  { label: 'Café', at: { lat: 51.32554, lon: 8.00454 } },
  { label: 'Selmecke', at: { lat: 51.33745, lon: 7.97975 } },
]

// Schrägansicht 2:1 – ein Meter nach Osten geht nach rechts unten, ein Meter nach Süden nach links unten.
const ISO_Y = 0.5
const HEIGHT = 0.82
const iso = (x: number, y: number, h = 0) => ({ x: x - y, y: (x + y) * ISO_Y - h * HEIGHT })

const LOAD_RADIUS = 2     // 5 × 5 Kacheln sind immer da
const KEEP_RADIUS = 3     // erst dahinter fällt eine Kachel weg
const WALK_M_PER_S = 16
const RUN_FACTOR = 2.6

function shade(color: number, factor: number) {
  const r = Math.min(255, Math.round(((color >> 16) & 255) * factor))
  const g = Math.min(255, Math.round(((color >> 8) & 255) * factor))
  const b = Math.min(255, Math.round((color & 255) * factor))
  return (r << 16) | (g << 8) | b
}

export default function WorldLab() {
  const host = useRef<HTMLDivElement | null>(null)
  const jump = useRef<(at: GeoPoint) => void>(() => {})
  const [hud, setHud] = useState<Hud | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let disposed = false
    let app: Application | null = null
    const cleanup: Array<() => void> = []

    ;(async () => {
      const PIXI = await import('pixi.js')
      if (disposed || !host.current) return
      app = new PIXI.Application()
      await app.init({ resizeTo: host.current, background: GROUND_COLOR, antialias: true, autoDensity: true, resolution: Math.min(2, window.devicePixelRatio || 1) })
      if (disposed) { app.destroy(true); return }
      host.current.appendChild(app.canvas)

      // ── Welt ────────────────────────────────────────────────────────────
      // Die Welt wird relativ zu einem festen Punkt gezeichnet, damit die
      // Grafikkarte mit kleinen Zahlen rechnet. Die wahre Position bleibt Mercator.
      const params = new URLSearchParams(window.location.search)
      const startGeo: GeoPoint = Number.isFinite(Number(params.get('lat'))) && params.get('lat')
        ? { lat: Number(params.get('lat')), lon: Number(params.get('lon')) }
        : PLACES[0].at
      const anchorTile = tileAt(geoToMerc(startGeo))
      const anchor = tileOrigin(anchorTile)
      const k = mercPerGroundMetre(startGeo.lat)
      const toWorld = (geo: GeoPoint) => { const m = geoToMerc(geo); return { x: (m.x - anchor.x) / k, y: (anchor.y - m.y) / k } }
      const toGeo = (p: { x: number; y: number }) => mercToGeo({ x: anchor.x + p.x * k, y: anchor.y - p.y * k })
      const tileSizeM = TILE_SIZE_MERC / k

      const world = new PIXI.Container()
      const ground = new PIXI.Container()
      const objects = new PIXI.Container()
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
      objects.addChild(playerSprite)

      // ── Kacheln ─────────────────────────────────────────────────────────
      type Loaded = { ground: PixiGraphics; blocks: Container[]; count: number }
      const loaded = new Map<string, Loaded>()
      const fetched = new Map<string, SimplifiedTile>()
      const inFlight = new Set<string>()

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

      function showTile(tile: TileId, data: SimplifiedTile) {
        const key = tileKey(tile)
        if (loaded.has(key) || disposed) return
        const ox = (tile.x - anchorTile.x) * tileSizeM, oy = (tile.y - anchorTile.y) * tileSizeM
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
        const blocks = data.blocks.map(block => drawBlock(block, ox, oy))
        if (blocks.length) objects.addChild(...blocks)
        loaded.set(key, { ground: g, blocks, count: blocks.length })
      }

      async function loadTile(tile: TileId) {
        const key = tileKey(tile)
        if (loaded.has(key) || inFlight.has(key)) return
        const known = fetched.get(key)
        if (known) { showTile(tile, known); return }
        inFlight.add(key)
        try {
          const response = await fetch(`/api/world-lab/tile?x=${tile.x}&y=${tile.y}`)
          if (!response.ok) throw new Error(String(response.status))
          const data = await response.json() as SimplifiedTile
          fetched.set(key, data)
          // Nur zeigen, wenn die Kachel noch gebraucht wird.
          const here = tileAt(geoToMerc(toGeo(player)))
          if (Math.max(Math.abs(tile.x - here.x), Math.abs(tile.y - here.y)) <= KEEP_RADIUS) showTile(tile, data)
        } catch (reason) {
          if (!disposed) setError('Kachel ' + key + ' konnte nicht geladen werden (' + String((reason as Error)?.message ?? reason) + ').')
        } finally { inFlight.delete(key) }
      }

      let lastTileKey = ''
      function updateTiles() {
        const here = tileAt(geoToMerc(toGeo(player)))
        const key = tileKey(here)
        if (key === lastTileKey) return
        lastTileKey = key
        // Von innen nach außen laden: was nah ist, zuerst.
        const wanted: TileId[] = []
        for (let dy = -LOAD_RADIUS; dy <= LOAD_RADIUS; dy++) for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx++) wanted.push({ x: here.x + dx, y: here.y + dy })
        wanted.sort((a, b) => Math.hypot(a.x - here.x, a.y - here.y) - Math.hypot(b.x - here.x, b.y - here.y))
        for (const tile of wanted) void loadTile(tile)
        for (const [loadedKey, entry] of loaded) {
          const [x, y] = loadedKey.split('/').map(Number)
          if (Math.max(Math.abs(x - here.x), Math.abs(y - here.y)) <= KEEP_RADIUS) continue
          entry.ground.destroy()
          for (const block of entry.blocks) block.destroy()
          loaded.delete(loadedKey)
        }
      }

      // ── NOXIA-Gebäude ───────────────────────────────────────────────────
      const noxia: Array<NoxiaBuilding & { x: number; y: number }> = []
      void (async () => {
        try {
          const { token } = await getSessionInfo()
          if (!token) return
          const response = await fetch('/api/world-lab/buildings', { headers: { Authorization: 'Bearer ' + token } })
          const json = response.ok ? await response.json() : null
          for (const building of (json?.buildings ?? []) as NoxiaBuilding[]) {
            if (disposed) return
            const at = toWorld({ lat: building.lat, lon: building.lon })
            noxia.push({ ...building, ...at })
            const visual = getBuildingVisual(building.typeId, 'earth')
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
                objects.addChild(sprite)
                continue
              } catch { /* ohne Bild: Block */ }
            }
            const block = drawBlock({ x: at.x, y: at.y, w: building.w, d: building.d, a: 0, k: 'hall', l: 2 }, 0, 0)
            block.tint = 0x9fc4e8
            objects.addChild(block)
          }
        } catch { /* ohne Anmeldung keine NOXIA-Gebäude */ }
      })()

      // ── Eingabe ─────────────────────────────────────────────────────────
      const keys = new Set<string>()
      const down = (event: KeyboardEvent) => {
        const target = event.target as HTMLElement | null
        if (target?.closest('input,textarea,select')) return
        const key = event.key.toLowerCase()
        if (['w', 'a', 's', 'd', 'shift'].includes(key)) { keys.add(key); if (key !== 'shift') event.preventDefault() }
      }
      const up = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase())
      const blur = () => keys.clear()
      const wheel = (event: WheelEvent) => { event.preventDefault(); zoom = Math.max(0.5, Math.min(7, zoom * (event.deltaY > 0 ? 0.9 : 1.1))) }
      window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur)
      app.canvas.addEventListener('wheel', wheel, { passive: false })
      cleanup.push(() => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur) })

      jump.current = (at: GeoPoint) => {
        const p = toWorld(at)
        player.x = p.x; player.y = p.y; camera.x = p.x; camera.y = p.y
        lastTileKey = ''
      }

      // ── Bild für Bild ───────────────────────────────────────────────────
      let hudAt = 0
      app.ticker.add(ticker => {
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
        playerSprite.zIndex = player.x + player.y
        const centre = iso(camera.x, camera.y)
        world.scale.set(zoom)
        world.position.set(app!.screen.width / 2 - centre.x * zoom, app!.screen.height / 2 - centre.y * zoom)
        updateTiles()

        hudAt += dt
        if (hudAt > 0.25) {
          hudAt = 0
          const geo = toGeo(player)
          let near = '', best = 60
          for (const building of noxia) { const d = Math.hypot(building.x - player.x, building.y - player.y); if (d < best) { best = d; near = building.name + ' · ' + Math.round(d) + ' m' } }
          let blocks = 0
          for (const entry of loaded.values()) blocks += entry.count
          setHud({ fps: Math.round(app!.ticker.FPS), tiles: loaded.size, loading: inFlight.size, blocks, lat: geo.lat, lon: geo.lon, near })
        }
      })
    })().catch(reason => { if (!disposed) setError('Die Ansicht konnte nicht gestartet werden: ' + String(reason?.message ?? reason)) })

    return () => {
      disposed = true
      for (const run of cleanup) run()
      if (app) { try { app.destroy(true, { children: true }) } catch { /* schon weg */ } }
    }
  }, [])

  return <div className="world-lab">
    <div ref={host} className="stage" />
    <div className="panel">
      <small>PROTOTYP · EINE WELT</small>
      <b>Kacheln statt Szenen</b>
      <span>WASD laufen · Shift schneller · Mausrad zoomt</span>
      <div className="places">{PLACES.map(place => <button key={place.label} onClick={() => jump.current(place.at)}>{place.label}</button>)}</div>
      {hud && <dl>
        <dt>Bilder je Sekunde</dt><dd>{hud.fps}</dd>
        <dt>Kacheln</dt><dd>{hud.tiles}{hud.loading ? ' (+' + hud.loading + ' unterwegs)' : ''}</dd>
        <dt>Gebäudeblöcke</dt><dd>{hud.blocks}</dd>
        <dt>Position</dt><dd>{hud.lat.toFixed(5)}, {hud.lon.toFixed(5)}</dd>
        {hud.near && <><dt>In der Nähe</dt><dd>{hud.near}</dd></>}
      </dl>}
      {error && <p className="error">{error}</p>}
      <a href="/dashboard">← zurück ins Spiel</a>
    </div>
    <style jsx>{`
      .world-lab{position:fixed;inset:0;background:#a9bd8c;font-family:system-ui;color:#eef2ed}
      .stage{position:absolute;inset:0}
      .panel{position:absolute;left:14px;top:14px;width:250px;padding:12px 14px;background:#0d1c22e6;border:1px solid #40595a;border-radius:8px;display:grid;gap:4px}
      .panel small{font:800 8px monospace;letter-spacing:.12em;color:#d9bb6a}
      .panel b{font-size:14px}
      .panel span{font-size:10px;color:#9fb5b0}
      .places{display:flex;flex-wrap:wrap;gap:5px;margin:6px 0}
      .places button{border:1px solid #5d7b79;background:#17383a;color:#fff;border-radius:5px;padding:4px 8px;font-size:11px;cursor:pointer}
      dl{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;margin:4px 0;font-size:11px}
      dt{color:#9fb5b0}dd{margin:0;text-align:right;font-variant-numeric:tabular-nums}
      .error{margin:4px 0;font-size:11px;color:#f0b9a0}
      .panel a{font-size:11px;color:#d9bb6a;text-decoration:none;margin-top:4px}
    `}</style>
  </div>
}
