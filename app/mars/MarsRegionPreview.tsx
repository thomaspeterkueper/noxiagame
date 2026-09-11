'use client'

import { useMemo, useRef, useState } from 'react'

const TILE_ROOT = 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/default/default028mm'

type MarsSite = { id: string; name: string; lat: number; lon: number; kind: 'region' | 'landing' | 'landmark' }

const SITES: MarsSite[] = [
  { id: 'tharsis', name: 'Tharsis Hub', lat: 0, lon: -112.5, kind: 'region' },
  { id: 'olympus-mons', name: 'Olympus Mons', lat: 18.65, lon: -133.8, kind: 'landmark' },
  { id: 'valles-marineris', name: 'Valles Marineris', lat: -14, lon: -60, kind: 'landmark' },
  { id: 'gale', name: 'Gale / Curiosity', lat: -5.4, lon: 137.8, kind: 'landing' },
  { id: 'jezero', name: 'Jezero / Perseverance', lat: 18.38, lon: 77.58, kind: 'landing' },
  { id: 'elysium', name: 'Elysium Planitia / InSight', lat: 4.5, lon: 135.9, kind: 'landing' },
]

function mapX(lon: number) { return ((lon + 180) / 360) * 100 }
function mapY(lat: number) { return ((90 - lat) / 180) * 100 }

export default function MarsRegionPreview() {
  const [zoom, setZoom] = useState(0)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [selected, setSelected] = useState<MarsSite>(SITES[0])
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const tileMatrix = useMemo(() => {
    const rows = 2 ** zoom, cols = 2 ** (zoom + 1)
    return Array.from({ length: rows * cols }, (_, index) => ({ row: Math.floor(index / cols), col: index % cols, rows, cols }))
  }, [zoom])
  const scale = 2 ** zoom
  const clampOffset = (value: { x: number; y: number }) => {
    const maxX = Math.max(0, (scale - 1) * 50), maxY = Math.max(0, (scale - 1) * 50)
    return { x: Math.max(-maxX, Math.min(maxX, value.x)), y: Math.max(-maxY, Math.min(maxY, value.y)) }
  }
  const setZoomLevel = (next: number) => { setZoom(Math.max(0, Math.min(3, next))); setOffset({ x: 0, y: 0 }) }

  return <section style={{ background: '#120d0a', color: '#f5ede7', padding: 24 }}>
    <div style={{ maxWidth: 1440, margin: '0 auto' }}>
      <header style={{ display: 'flex', gap: 20, justifyContent: 'space-between', alignItems: 'end', flexWrap: 'wrap', marginBottom: 16 }}>
        <div><div style={{ fontSize: 12, letterSpacing: '.16em', opacity: .62 }}>NOχ¹ᐃ · MARS ORBITAL MAP</div><h1 style={{ margin: '6px 0 4px', fontSize: 'clamp(28px,4vw,48px)', fontWeight: 600 }}>Mars</h1><div style={{ opacity: .72 }}>MGS MOLA · globale Color-Hillshade · planetozentrisch · positive Ostlängen</div></div>
        <div style={{ display: 'flex', gap: 8 }}><button onClick={() => setZoomLevel(zoom - 1)} disabled={zoom === 0} style={buttonStyle}>−</button><div style={{ ...buttonStyle, minWidth: 72, textAlign: 'center' }}>×{scale}</div><button onClick={() => setZoomLevel(zoom + 1)} disabled={zoom === 3} style={buttonStyle}>+</button></div>
      </header>
      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 16 }}>
        <div onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y } }} onPointerMove={e => { if (!drag.current || zoom === 0) return; const rect = e.currentTarget.getBoundingClientRect(); setOffset(clampOffset({ x: drag.current.ox + ((e.clientX - drag.current.x) / rect.width) * 100, y: drag.current.oy + ((e.clientY - drag.current.y) / rect.height) * 100 })) }} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }} style={{ position: 'relative', aspectRatio: '2 / 1', overflow: 'hidden', borderRadius: 16, border: '1px solid rgba(255,255,255,.14)', background: '#3b2118', cursor: zoom ? 'grab' : 'default', touchAction: 'none' }}>
          <div style={{ position: 'absolute', inset: 0, width: `${scale * 100}%`, height: `${scale * 100}%`, left: `${offset.x - (scale - 1) * 50}%`, top: `${offset.y - (scale - 1) * 50}%` }}>
            {tileMatrix.map(tile => <img key={`${tile.row}:${tile.col}`} src={`${TILE_ROOT}/${zoom}/${tile.row}/${tile.col}.jpg`} alt="" draggable={false} style={{ position: 'absolute', left: `${tile.col / tile.cols * 100}%`, top: `${tile.row / tile.rows * 100}%`, width: `${100 / tile.cols}%`, height: `${100 / tile.rows}%`, objectFit: 'fill', userSelect: 'none' }} />)}
            <svg viewBox="0 0 1000 500" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>{[-60,-30,0,30,60].map(lat => <line key={`lat-${lat}`} x1="0" x2="1000" y1={mapY(lat)*5} y2={mapY(lat)*5} stroke="rgba(255,255,255,.18)" strokeWidth=".7" />)}{[-120,-60,0,60,120].map(lon => <line key={`lon-${lon}`} y1="0" y2="500" x1={mapX(lon)*10} x2={mapX(lon)*10} stroke="rgba(255,255,255,.18)" strokeWidth=".7" />)}</svg>
            {SITES.map(site => <button key={site.id} onPointerDown={e => e.stopPropagation()} onClick={() => setSelected(site)} title={site.name} style={{ position: 'absolute', left: `${mapX(site.lon)}%`, top: `${mapY(site.lat)}%`, transform: 'translate(-50%,-50%)', width: selected.id === site.id ? 14 : 10, height: selected.id === site.id ? 14 : 10, padding: 0, borderRadius: '50%', border: '2px solid white', background: site.kind === 'region' ? '#ffd166' : site.kind === 'landing' ? '#9dd9ff' : '#f08a68', cursor: 'pointer' }} />)}
          </div>
          <div style={{ position: 'absolute', left: 14, bottom: 12, padding: '6px 9px', borderRadius: 8, background: 'rgba(12,8,6,.7)', fontSize: 12 }}>NASA Trek · MGS MOLA · 463 m/pixel source product</div>
        </div>
        <aside style={{ display: 'grid', alignContent: 'start', gap: 12 }}><div style={panelStyle}><div style={eyebrowStyle}>SELECTED</div><div style={{ fontSize: 22, marginTop: 5 }}>{selected.name}</div><div style={{ opacity: .7, marginTop: 8 }}>{selected.lat.toFixed(2)}° · {selected.lon.toFixed(2)}°</div></div><div style={panelStyle}><div style={eyebrowStyle}>SPATIAL CORE</div><div style={{ marginTop: 7, lineHeight: 1.55, opacity: .82 }}>IAU Mars ellipsoid · lokale ENU-Meterkoordinaten · 1-km-Chunks · 10-m-Zellen.</div></div></aside>
      </section>
    </div>
  </section>
}
const buttonStyle: React.CSSProperties = { appearance: 'none', border: '1px solid rgba(255,255,255,.18)', background: 'rgba(255,255,255,.07)', color: 'inherit', borderRadius: 9, padding: '8px 12px', font: 'inherit' }
const panelStyle: React.CSSProperties = { border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', borderRadius: 14, padding: 16 }
const eyebrowStyle: React.CSSProperties = { fontSize: 11, letterSpacing: '.14em', opacity: .55 }
