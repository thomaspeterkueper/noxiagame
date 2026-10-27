'use client'

// app/components/SurfaceTerrainLayer.tsx
// Gelände unter einer lokalen Szene (Phobos, Deimos, Mond): Regolith mit
// Körnung, Rillen, Kratern und Felsbrocken (Thomas, 27.10.2026). Liegt in der
// Kameragruppe, bewegt sich also mit der Welt. Die Lage der Objekte kommt aus
// lib/game/spatial/surfaceDecor.ts (fest je Ort).

import { memo } from 'react'
import type { SurfaceDecor } from '@/lib/game/spatial/surfaceDecor'
import { seededRandom } from '@/lib/game/spatial/surfaceDecor'
import { projectSurfacePoint as iso } from './WalkableSurfaceRenderer'

export interface TerrainPalette { ground: string; grainLight: string; grainDark: string; floor: string; rim: string; rock: string; rockLight: string; groove: string }

/** Farben je Himmelskörper. Phobos ist sehr dunkel (Albedo um 0,07), leicht rötlich grau. */
export const TERRAIN_PALETTES: Record<string, TerrainPalette> = {
  phobos: { ground: '#3a332e', grainLight: '#544a42', grainDark: '#26211d', floor: '#2a2420', rim: '#5d524a', rock: '#4a413a', rockLight: '#6e6157', groove: '#221d1a' },
  deimos: { ground: '#4a423b', grainLight: '#62584f', grainDark: '#322c27', floor: '#352f2a', rim: '#6c6158', rock: '#564d45', rockLight: '#7a6e64', groove: '#2c2622' },
  moon: { ground: '#6d6e69', grainLight: '#85867f', grainDark: '#55564f', floor: '#4f504a', rim: '#93948d', rock: '#5f605a', rockLight: '#9d9e97', groove: '#4a4b45' },
}

function circle(xM: number, yM: number, rM: number, steps = 22) {
  return Array.from({ length: steps }, (_, i) => {
    const t = i / steps * Math.PI * 2
    const p = iso({ xM: xM + Math.cos(t) * rM, yM: yM + Math.sin(t) * rM })
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
  }).join(' ')
}

/** Ab diesem Zoom erscheinen kleine Steine (mehr Einzelheiten, je näher man herangeht). */
export const PEBBLE_ZOOM = 2

function SurfaceTerrainLayerInner({ body, decor, extentM, detailed = false }: { body: string; decor: SurfaceDecor; extentM: number; detailed?: boolean }) {
  const palette = TERRAIN_PALETTES[body] ?? TERRAIN_PALETTES.phobos
  const corners = [iso({ xM: -extentM, yM: -extentM }), iso({ xM: extentM, yM: -extentM }), iso({ xM: extentM, yM: extentM }), iso({ xM: -extentM, yM: extentM })]
  // Drei Körnungen mit teilerfremden Kachelgrößen: Das Muster wiederholt sich erst nach
  // Tausenden Bildpunkten (vorher sah man beim Heranzoomen eine „Tapete“, 27.10.2026).
  const layers = [{ size: 61, count: 26, seed: 7, rMax: 0.9 }, { size: 97, count: 18, seed: 11, rMax: 1.4 }, { size: 157, count: 9, seed: 13, rMax: 2.6 }]
    .map(layer => { const grain = seededRandom(layer.seed); return { ...layer, dots: Array.from({ length: layer.count }, () => ({ x: grain() * layer.size, y: grain() * layer.size, r: 0.3 + grain() * layer.rMax, light: grain() > 0.45 })) } })
  const ground = corners.map(p => `${p.x},${p.y}`).join(' ')
  // Kleine Steine nur nah heran (Level of Detail)
  const pebbleRandom = seededRandom(17)
  const pebbles = detailed ? Array.from({ length: 900 }, () => ({ xM: (pebbleRandom() * 2 - 1) * extentM, yM: (pebbleRandom() * 2 - 1) * extentM, r: 0.25 + pebbleRandom() * 0.55 })) : []
  return <g pointerEvents="none">
    <defs>
      {layers.map(layer => <pattern key={layer.size} id={`regolith-${body}-${layer.size}`} width={layer.size} height={layer.size} patternUnits="userSpaceOnUse">
        {layer.dots.map((dot, i) => <circle key={i} cx={dot.x} cy={dot.y} r={dot.r} fill={dot.light ? palette.grainLight : palette.grainDark} opacity={layer.size > 100 ? '.35' : '.65'}/>)}
      </pattern>)}
      <radialGradient id={`scorch-${body}`}><stop offset="0" stopColor="#0d0b0a" stopOpacity=".55"/><stop offset=".65" stopColor="#14110f" stopOpacity=".3"/><stop offset="1" stopColor="#14110f" stopOpacity="0"/></radialGradient>
    </defs>
    <polygon points={ground} fill={palette.ground}/>
    {layers.map(layer => <polygon key={layer.size} points={ground} fill={`url(#regolith-${body}-${layer.size})`}/>)}
    {/* Brandfleck unter Landeplätzen: Triebwerke haben den Staub weggeblasen */}
    {decor.scorches.map((scorch, i) => { const c = iso(scorch); const e = iso({ xM: scorch.xM + scorch.rM, yM: scorch.yM - scorch.rM }); const rx = Math.abs(e.x - c.x), ry = rx * 0.5; return <ellipse key={'s' + i} cx={c.x} cy={c.y} rx={rx} ry={ry} fill={`url(#scorch-${body})`}/> })}
    {/* Rillen: dunkle Furche mit heller Kante auf der Sonnenseite */}
    {decor.grooves.map((groove, i) => {
      const a = iso(groove.from), b = iso(groove.to)
      return <g key={'g' + i}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={palette.groove} strokeWidth="5" strokeLinecap="round" opacity=".55"/>
        <line x1={a.x} y1={a.y + 2.6} x2={b.x} y2={b.y + 2.6} stroke={palette.rim} strokeWidth="1.2" strokeLinecap="round" opacity=".45"/>
      </g>
    })}
    {/* Krater: heller Wall, dunkle Schüssel, Schatten auf der sonnenabgewandten Innenseite */}
    {decor.craters.map((crater, i) => { const r = crater.rM, o = r * 0.09; return <g key={'c' + i}>
      {/* Wall: Schattenseite oben links, Lichtseite unten rechts */}
      <polygon points={circle(crater.xM - o, crater.yM - o, r * 1.24)} fill={palette.grainDark} opacity=".55"/>
      <polygon points={circle(crater.xM + o, crater.yM + o, r * 1.24)} fill={palette.rim} opacity=".6"/>
      <polygon points={circle(crater.xM, crater.yM, r)} fill={palette.floor}/>
      {/* Innenwand: beleuchtet auf der sonnenabgewandten Seite des Walls, Schatten innen oben links */}
      <polygon points={circle(crater.xM - o * 1.4, crater.yM - o * 1.4, r * 0.9)} fill={palette.rim} opacity=".28"/>
      <polygon points={circle(crater.xM + o * 0.6, crater.yM + o * 0.6, r * 0.78)} fill={palette.floor}/>
      <polygon points={circle(crater.xM + o * 1.6, crater.yM + o * 1.6, r * 0.82)} fill="#000" opacity=".2"/>
    </g> })}
    {/* Fahrspuren von Rovern: zwei Reifen mit Profil */}
    {decor.trails.map((trail, i) => { const d = trail.points.map((p, k) => { const s = iso(p); return `${k ? 'L' : 'M'}${s.x.toFixed(1)} ${s.y.toFixed(1)}` }).join(' '); return <g key={'t' + i} opacity=".55">
      <path d={d} fill="none" stroke={palette.grainDark} strokeWidth="1.3" strokeDasharray="1.4 .8" transform="translate(0 -1.3)"/>
      <path d={d} fill="none" stroke={palette.grainDark} strokeWidth="1.3" strokeDasharray="1.4 .8" transform="translate(0 1.3)"/>
    </g> })}
    {pebbles.map((pebble, i) => { const p = iso(pebble); return <g key={'p' + i}><ellipse cx={p.x + pebble.r * 0.6} cy={p.y + pebble.r * 0.2} rx={pebble.r * 1.3} ry={pebble.r * 0.5} fill="#000" opacity=".3"/><ellipse cx={p.x} cy={p.y - pebble.r * 0.3} rx={pebble.r} ry={pebble.r * 0.7} fill={palette.rock}/><ellipse cx={p.x + pebble.r * 0.2} cy={p.y - pebble.r * 0.55} rx={pebble.r * 0.45} ry={pebble.r * 0.25} fill={palette.rockLight} opacity=".7"/></g> })}
    {/* Felsbrocken: unregelmäßiger Körper mit Schatten und Lichtkante */}
    {decor.boulders.map((boulder, i) => {
      const random = seededRandom(boulder.seed)
      const p = iso(boulder)
      const s = boulder.rM * 1.7
      const pts = Array.from({ length: 7 }, (_, k) => {
        const t = k / 7 * Math.PI * 2, r = s * (0.7 + random() * 0.45)
        return `${(p.x + Math.cos(t) * r).toFixed(1)},${(p.y - s * 0.55 + Math.sin(t) * r * 0.62).toFixed(1)}`
      }).join(' ')
      return <g key={'b' + i}>
        <ellipse cx={p.x + s * 0.5} cy={p.y + s * 0.1} rx={s * 1.25} ry={s * 0.45} fill="#000" opacity=".35"/>
        <polygon points={pts} fill={palette.rock} stroke="#1a1614" strokeWidth=".5"/>
        <ellipse cx={p.x + s * 0.25} cy={p.y - s * 0.8} rx={s * 0.45} ry={s * 0.22} fill={palette.rockLight} opacity=".7"/>
      </g>
    })}
  </g>
}

export const SurfaceTerrainLayer = memo(SurfaceTerrainLayerInner)
