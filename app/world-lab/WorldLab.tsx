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
import { getSessionInfo } from '@/lib/supabase/auth'
import { getBuildingVisual } from '@/lib/game/buildings/visuals'
import { blockArt } from '@/lib/worldlab/blocks'
import { detailCell } from '@/lib/worldlab/detailCells'
import type { GeoPoint } from '@/lib/worldlab/mercator'
import type { SimplifiedTile } from '@/lib/worldlab/simplify'
import { startWorldEngine, type Hud, type NoxiaBuilding, type WorldEngine } from './worldEngine'

const PLACES: Array<{ label: string; at: GeoPoint }> = [
  { label: 'Sundern Mitte', at: { lat: 51.3262, lon: 8.0 } },
  { label: 'Café', at: { lat: 51.32554, lon: 8.00454 } },
  { label: 'Selmecke', at: { lat: 51.33745, lon: 7.97975 } },
]

/**
 * `embedded`: im Spiel unter der oberen Leiste statt als eigene Seite; `onLeave`
 * führt dann zurück zur bisherigen Erdszene statt zum Dashboard.
 */
export default function WorldLab({ embedded = false, onLeave }: { embedded?: boolean; onLeave?: () => void } = {}) {
  const host = useRef<HTMLDivElement | null>(null)
  const engine = useRef<WorldEngine | null>(null)
  const [hud, setHud] = useState<Hud | null>(null)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState<{ busy: boolean; text: string }>({ busy: false, text: '' })
  const busy = useRef(false)
  const tried = useRef(new Set<string>())
  const fresh = useRef('')

  /**
   * Holt für die Gegend um die Figur fehlende Kartendaten aus OpenStreetMap
   * (veraltete Regionen neu, Ortsdetail für die Zelle) und lädt die Kacheln neu.
   */
  async function refreshHere(reason: string) {
    const engine_ = engine.current
    if (!engine_ || busy.current) return
    const at = engine_.position()
    const cell = detailCell(at)
    tried.current.add(cell.lat + '/' + cell.lon)
    busy.current = true
    setRefresh({ busy: true, text: reason + ' – Kartendaten werden geholt …' })
    try {
      const { token } = await getSessionInfo()
      if (!token) throw new Error('nicht angemeldet')
      const response = await fetch('/api/world-lab/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(at) })
      const json = await response.json()
      if (!response.ok) throw new Error(json?.error ?? String(response.status))
      const parts: string[] = []
      for (const region of json.regions ?? []) parts.push(region.ok ? 'Region erneuert' : 'Region nicht erneuert (' + (region.error ?? 'Fehler') + ')')
      if (json.detail?.ok) parts.push(json.detail.cached ? 'Ortsdetail war schon da' : json.detail.total + ' Objekte Ortsdetail geholt')
      else parts.push('Ortsdetail nicht geholt (' + (json.detail?.error ?? 'Fehler') + ')')
      fresh.current = String(Date.now())
      engine.current?.reloadTiles()
      setRefresh({ busy: false, text: parts.join(' · ') })
    } catch (reason) {
      setRefresh({ busy: false, text: 'Nachladen fehlgeschlagen: ' + String((reason as Error)?.message ?? reason) })
    } finally { busy.current = false }
  }

  // Selbsttätig: einmal beim Start (veraltete Regionen), danach in bebauten
  // Kacheln ohne Gebäude – je Zelle höchstens einmal je Besuch der Seite.
  const started = useRef(false)
  useEffect(() => {
    if (!hud || !engine.current) return
    if (!started.current) { started.current = true; void refreshHere('Start'); return }
    if (!hud.here.loaded || hud.here.blocks > 0 || !hud.here.built) return
    const cell = detailCell(engine.current.position())
    if (!tried.current.has(cell.lat + '/' + cell.lon)) void refreshHere('Hier fehlen Gebäude')
  }, [hud])

  useEffect(() => {
    let disposed = false
    ;(async () => {
      const PIXI = await import('pixi.js')
      if (disposed || !host.current) return
      const params = new URLSearchParams(window.location.search)
      const start: GeoPoint = Number.isFinite(Number(params.get('lat'))) && params.get('lat')
        ? { lat: Number(params.get('lat')), lon: Number(params.get('lon')) }
        : PLACES[0].at
      const started = await startWorldEngine(PIXI, {
        host: host.current,
        start,
        // Messschalter: ?aa=0 schaltet die Kantenglättung ab, ?res=1 begrenzt die Pixeldichte.
        settings: { antialias: params.get('aa') !== '0', maxResolution: Number(params.get('res')) || 2 },
        // Standard: eigene Zeichnungen, wo vorhanden, sonst die Vorlagen.
        // ?art=vorlage zeigt nur Vorlagen, ?art=farbe einfarbige Quader (zum Vergleichen der Bildrate).
        art: blockArt(params.get('art') === 'vorlage' ? 'template' : params.get('art') === 'farbe' ? 'none' : 'drawn'),
        loadTile: async tile => {
          const response = await fetch(`/api/world-lab/tile?x=${tile.x}&y=${tile.y}` + (fresh.current ? '&fresh=' + fresh.current : ''))
          if (!response.ok) throw new Error(String(response.status))
          return await response.json() as SimplifiedTile
        },
        loadNoxia: async () => {
          const { token } = await getSessionInfo()
          if (!token) return []
          const response = await fetch('/api/world-lab/buildings', { headers: { Authorization: 'Bearer ' + token } })
          const json = response.ok ? await response.json() : null
          return (json?.buildings ?? []) as NoxiaBuilding[]
        },
        noxiaVisual: typeId => getBuildingVisual(typeId, 'earth'),
        onHud: next => { if (!disposed) setHud(next) },
        onError: message => { if (!disposed) setError(message) },
      })
      if (disposed) { started.destroy(); return }
      engine.current = started
    })().catch(reason => { if (!disposed) setError('Die Ansicht konnte nicht gestartet werden: ' + String(reason?.message ?? reason)) })

    return () => {
      disposed = true
      engine.current?.destroy()
      engine.current = null
    }
  }, [])

  return <div className={embedded ? 'world-lab embedded' : 'world-lab'}>
    <div ref={host} className="stage" />
    <div className="panel">
      <small>PROTOTYP · EINE WELT</small>
      <b>{embedded ? 'Weltkarte' : 'Kacheln statt Szenen'}</b>
      <span>WASD laufen · Shift schneller · Mausrad zoomt</span>
      <div className="places">{PLACES.map(place => <button key={place.label} onClick={() => engine.current?.jump(place.at)}>{place.label}</button>)}</div>
      {hud && <dl>
        <dt>Bilder je Sekunde</dt><dd>{Math.round(hud.frame.fps)}</dd>
        <dt>Langsamstes Bild</dt><dd>{hud.frame.worstMs.toFixed(0)} ms</dd>
        <dt>Ruckler (letzte 120)</dt><dd>{hud.frame.stutters}</dd>
        <dt>Logik</dt><dd>{hud.frame.logicMs.toFixed(1)} ms (max {hud.frame.logicMaxMs.toFixed(0)})</dd>
        <dt>Neuaufbau je s</dt><dd>{Math.round(hud.rebuildsPerS)}</dd>
        <dt>Zeichnen</dt><dd>{hud.frame.renderMs.toFixed(1)} ms (max {hud.frame.renderMaxMs.toFixed(0)})</dd>
        <dt>Kacheln</dt><dd>{hud.tiles}{hud.loading ? ' (+' + hud.loading + ' unterwegs)' : ''}</dd>
        <dt>Gebäudeblöcke</dt><dd>{hud.blocks}</dd>
        <dt>Position</dt><dd>{hud.lat.toFixed(5)}, {hud.lon.toFixed(5)}</dd>
        {hud.near && <><dt>In der Nähe</dt><dd>{hud.near}</dd></>}
      </dl>}
      <button className="refresh" disabled={refresh.busy} onClick={() => void refreshHere('Von Hand')}>{refresh.busy ? 'Lädt …' : 'Kartendaten hier nachladen'}</button>
      {refresh.text && <p className="note">{refresh.text}</p>}
      {error && <p className="error">{error}</p>}
      {onLeave ? <button className="leave" onClick={onLeave}>← Bisherige Erdszene</button> : <a href="/dashboard">← zurück ins Spiel</a>}
    </div>
    <style jsx>{`
      .world-lab{position:fixed;inset:0;background:#a9bd8c;font-family:system-ui;color:#eef2ed}
      .world-lab.embedded{inset:var(--noxia-topbar-h,44px) 0 0;z-index:1120}
      .panel .leave{border:0;background:none;padding:0;text-align:left;font-size:11px;color:#d9bb6a;cursor:pointer;margin-top:4px}
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
      .refresh{border:1px solid #5d7b79;background:#17383a;color:#fff;border-radius:5px;padding:5px 8px;font-size:11px;cursor:pointer;margin-top:4px}
      .refresh:disabled{opacity:.6;cursor:default}
      .note{margin:2px 0;font-size:10px;color:#9fb5b0}
      .panel a{font-size:11px;color:#d9bb6a;text-decoration:none;margin-top:4px}
    `}</style>
  </div>
}
