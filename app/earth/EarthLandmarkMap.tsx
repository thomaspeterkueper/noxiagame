'use client'

import { useEffect, useMemo, useState } from 'react'
import { EARTH_LANDMARKS, type EarthLandmark } from '@/lib/world/spatial/earthLandmarks'
import EarthLandmarkRegionFocus from './EarthLandmarkRegionFocus'

type ViewKey = 'world' | 'europe' | 'germany' | 'mediterranean'
type FilterKey = 'all' | 'science' | 'cross-universe'

type GeoPoint = { lat: number; lon: number }

type ViewBox = {
  west: number
  east: number
  south: number
  north: number
  label: string
}

const VIEW_W = 1200
const VIEW_H = 620
const PAD = 54

/**
 * Presentation/view coordinates for the landmark overview and regional Earth focus.
 * Canonical landmark identity remains address-based in earthLandmarks.ts; these values
 * do not become persisted object or travel coordinates.
 */
const LANDMARK_GEO: Readonly<Record<string, GeoPoint>> = {
  'earth-de-sundern-ssf-hq': { lat: 51.328, lon: 8.004 },
  'earth-de-darmstadt-esoc': { lat: 49.8728, lon: 8.6227 },
  'earth-de-darmstadt-eumetsat': { lat: 49.8627, lon: 8.6276 },
  'earth-de-cologne-eac': { lat: 50.852, lon: 7.126 },
  'earth-de-oberpfaffenhofen-dlr': { lat: 48.083, lon: 11.283 },
  'earth-in-dwarka': { lat: 22.244, lon: 68.968 },
  'earth-gr-phaistos': { lat: 35.051, lon: 24.814 },
  'earth-eg-alexandria': { lat: 31.2001, lon: 29.9187 },
}

const VIEWS: Record<ViewKey, ViewBox> = {
  world: { west: -180, east: 180, south: -60, north: 80, label: 'Welt' },
  europe: { west: -15, east: 45, south: 30, north: 62, label: 'Europa' },
  germany: { west: 5, east: 15.8, south: 47, north: 55.3, label: 'Deutschland' },
  mediterranean: { west: -10, east: 45, south: 20, north: 46, label: 'Mittelmeerraum' },
}

function inView(point: GeoPoint, view: ViewBox) {
  return point.lon >= view.west && point.lon <= view.east && point.lat >= view.south && point.lat <= view.north
}

function markerKind(landmark: EarthLandmark) {
  if (landmark.tags.includes('cross-universe')) return 'cross'
  if (landmark.tags.includes('spaceflight')) return 'space'
  return 'science'
}

export default function EarthLandmarkMap() {
  const [viewKey, setViewKey] = useState<ViewKey>('world')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const view = VIEWS[viewKey]

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('landmark')
    if (id && EARTH_LANDMARKS.some(landmark => landmark.id === id) && LANDMARK_GEO[id]) setSelectedId(id)
  }, [])

  const markers = useMemo(() => EARTH_LANDMARKS.flatMap(landmark => {
    const point = LANDMARK_GEO[landmark.id]
    if (!point || !inView(point, view)) return []
    if (filter === 'cross-universe' && !landmark.tags.includes('cross-universe')) return []
    if (filter === 'science' && landmark.tags.includes('cross-universe')) return []
    return [{ landmark, point }]
  }), [view, filter])

  const selected = useMemo(() => {
    if (!selectedId) return null
    const landmark = EARTH_LANDMARKS.find(item => item.id === selectedId)
    const point = LANDMARK_GEO[selectedId]
    return landmark && point ? { landmark, point } : null
  }, [selectedId])

  const project = (point: GeoPoint) => ({
    x: PAD + ((point.lon - view.west) / (view.east - view.west)) * (VIEW_W - PAD * 2),
    y: VIEW_H - PAD - ((point.lat - view.south) / (view.north - view.south)) * (VIEW_H - PAD * 2),
  })

  const openRegionalFocus = (id: string) => {
    setSelectedId(id)
    const url = new URL(window.location.href)
    url.searchParams.set('landmark', id)
    window.history.replaceState(null, '', `${url.pathname}?${url.searchParams.toString()}${url.hash}`)
    window.requestAnimationFrame(() => document.getElementById('earth-landmark-region-focus')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  const closeRegionalFocus = () => {
    setSelectedId(null)
    const url = new URL(window.location.href)
    url.searchParams.delete('landmark')
    window.history.replaceState(null, '', `${url.pathname}${url.search ? `?${url.searchParams.toString()}` : ''}${url.hash}`)
  }

  return <section className="landmark-map-layer">
    <header className="intro">
      <div>
        <small>EARTH · LANDMARK GEO LAYER</small>
        <h2>Geographische Weltanker</h2>
        <p>Die kanonischen Earth-Landmarks als geographische Ebene. Marker öffnen jetzt einen realen regionalen Earth-Ausschnitt über dieselbe Geodaten-Authority wie die Produktionskarte; sie starten noch keine simulierte terrestrische Reise.</p>
      </div>
      <div className="metric"><b>{markers.length}</b><span>sichtbar</span></div>
    </header>

    <div className="controls" aria-label="Landmark-Kartensteuerung">
      <div className="control-group"><span>Ansicht</span>{(Object.keys(VIEWS) as ViewKey[]).map(key => <button key={key} className={viewKey === key ? 'active' : ''} onClick={() => setViewKey(key)}>{VIEWS[key].label}</button>)}</div>
      <div className="control-group"><span>Layer</span><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Alle</button><button className={filter === 'science' ? 'active' : ''} onClick={() => setFilter('science')}>Wissenschaft</button><button className={filter === 'cross-universe' ? 'active' : ''} onClick={() => setFilter('cross-universe')}>Cross-Universe</button></div>
    </div>

    <div className="map-shell">
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label={`Landmark-Karte · ${view.label}`}>
        <defs>
          <pattern id="geo-grid" width="80" height="62" patternUnits="userSpaceOnUse"><path d="M 80 0 L 0 0 0 62" fill="none" stroke="#31535e" strokeWidth="1" opacity="0.18" /></pattern>
          <radialGradient id="earth-sea" cx="50%" cy="40%" r="75%"><stop offset="0%" stopColor="#173947"/><stop offset="100%" stopColor="#071b24"/></radialGradient>
        </defs>
        <rect width={VIEW_W} height={VIEW_H} rx="18" fill="url(#earth-sea)" />
        <rect width={VIEW_W} height={VIEW_H} rx="18" fill="url(#geo-grid)" />
        <path d="M75 206 C145 145 245 147 320 202 C382 247 456 240 524 189 C586 143 662 151 716 207 C777 270 855 286 934 245 C1000 211 1066 213 1126 251 L1126 423 C1058 451 979 456 907 426 C833 395 760 405 695 448 C632 488 555 489 491 450 C421 408 345 403 273 435 C203 466 132 452 75 409 Z" fill="#173e39" opacity="0.72" />
        <path d="M114 294 C180 254 236 270 276 326 C309 374 368 382 420 350 C478 315 520 322 565 363 C610 403 670 407 724 374 C780 339 840 341 898 382 C948 416 1008 420 1085 385" fill="none" stroke="#4f776b" strokeWidth="2" opacity="0.35" />

        {markers.map(({ landmark, point }) => {
          const p = project(point)
          const kind = markerKind(landmark)
          const isSelected = selectedId === landmark.id
          return <g key={landmark.id} className={`marker ${isSelected ? 'selected' : ''}`} tabIndex={0} role="button" aria-label={`${landmark.name} regional öffnen`} onClick={() => openRegionalFocus(landmark.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') openRegionalFocus(landmark.id) }}>
            <circle cx={p.x} cy={p.y} r={isSelected ? 19 : 14} className={`halo ${kind}`} />
            <circle cx={p.x} cy={p.y} r="6" className={`dot ${kind}`} />
            <line x1={p.x} y1={p.y + 7} x2={p.x} y2={p.y + 21} stroke="#d8e9e5" strokeWidth="1" opacity=".7" />
            <text x={p.x + 12} y={p.y - 10} className="marker-name">{landmark.name}</text>
            <text x={p.x + 12} y={p.y + 3} className="marker-place">{landmark.locality}</text>
          </g>
        })}
      </svg>
      {!markers.length && <div className="empty">In dieser Kombination aus Ansicht und Layer sind noch keine Landmark-Einträge vorhanden.</div>}
    </div>

    <div className="legend"><span><i className="space" /> Raumfahrt / Wissenschaft</span><span><i className="science" /> Wissenschaft</span><span><i className="cross" /> Cross-Universe</span><span className="note">Marker = Earth-Regionalfokus; keine simulierte Reise. Kanonische Ortsidentität bleibt adressbasiert.</span></div>

    {selected && <div id="earth-landmark-region-focus"><EarthLandmarkRegionFocus landmark={selected.landmark} point={selected.point} onClose={closeRegionalFocus} /></div>}

    <style jsx>{`
      .landmark-map-layer{max-width:1500px;margin:18px auto;padding:16px;box-sizing:border-box;background:#0f2732;color:#e9efec;border:1px solid #3d5962;border-radius:13px;font-family:system-ui,sans-serif}.intro{display:flex;justify-content:space-between;gap:18px;align-items:start}.intro small{font-size:9px;letter-spacing:.16em;color:#d0ad59;font-weight:900}.intro h2{font-family:Georgia,serif;font-size:26px;font-weight:400;margin:3px 0 5px}.intro p{max-width:800px;margin:0;color:#9fb1b5;font-size:10px;line-height:1.55}.metric{text-align:right}.metric b{display:block;color:#f0ca69;font-size:28px}.metric span{font-size:8px;text-transform:uppercase;color:#91a4a9}.controls{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:14px 0 10px}.control-group{display:flex;align-items:center;gap:5px;flex-wrap:wrap}.control-group>span{font-size:8px;text-transform:uppercase;letter-spacing:.1em;color:#839ba1;margin-right:3px}.controls button{appearance:none;border:1px solid #3a5b65;background:#102f3b;color:#b9c8ca;border-radius:999px;padding:5px 9px;font-size:8px;cursor:pointer}.controls button.active{background:#d0aa51;border-color:#e0c276;color:#15272d;font-weight:850}.map-shell{position:relative}.map-shell svg{width:100%;height:auto;display:block;border:1px solid #385560;border-radius:16px}.marker{cursor:pointer;outline:none}.marker:focus .halo,.marker:hover .halo,.marker.selected .halo{opacity:.9;transform:scale(1.22);transform-origin:center}.halo{opacity:.35;transition:.15s}.halo.space{fill:#e6c05f}.halo.science{fill:#70b7ae}.halo.cross{fill:#c38ad7}.dot.space{fill:#f1ce72;stroke:#fff0b7;stroke-width:2}.dot.science{fill:#83c7bf;stroke:#d9f4ef;stroke-width:2}.dot.cross{fill:#d9a7e7;stroke:#f1d9f7;stroke-width:2}.marker-name{fill:#eef5f2;font-size:12px;font-weight:800;paint-order:stroke;stroke:#0b2029;stroke-width:3px}.marker-place{fill:#93aaaf;font-size:9px;paint-order:stroke;stroke:#0b2029;stroke-width:2px}.legend{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:10px;color:#91a4a8;font-size:8px}.legend span{display:flex;align-items:center;gap:5px}.legend i{width:8px;height:8px;border-radius:50%;display:inline-block}.legend i.space{background:#e6c05f}.legend i.science{background:#70b7ae}.legend i.cross{background:#c38ad7}.legend .note{margin-left:auto;color:#6f858a}.empty{position:absolute;inset:0;display:grid;place-items:center;color:#a8b9bd;font-size:10px;pointer-events:none}@media(max-width:700px){.intro{flex-direction:column}.metric{text-align:left}.legend .note{margin-left:0;width:100%}.marker-name{font-size:14px}.marker-place{font-size:11px}}
    `}</style>
  </section>
}
