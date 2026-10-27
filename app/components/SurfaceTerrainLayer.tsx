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

function SurfaceTerrainLayerInner({ body, decor, extentM }: { body: string; decor: SurfaceDecor; extentM: number }) {
  const palette = TERRAIN_PALETTES[body] ?? TERRAIN_PALETTES.phobos
  const corners = [iso({ xM: -extentM, yM: -extentM }), iso({ xM: extentM, yM: -extentM }), iso({ xM: extentM, yM: extentM }), iso({ xM: -extentM, yM: extentM })]
  const grain = seededRandom(7)
  const dots = Array.from({ length: 34 }, () => ({ x: grain() * 64, y: grain() * 64, r: 0.4 + grain() * 0.9, light: grain() > 0.45 }))
  const patternId = 'regolith-' + body
  return <g pointerEvents="none">
    <defs>
      <pattern id={patternId} width="64" height="64" patternUnits="userSpaceOnUse">
        <rect width="64" height="64" fill={palette.ground}/>
        {dots.map((dot, i) => <circle key={i} cx={dot.x} cy={dot.y} r={dot.r} fill={dot.light ? palette.grainLight : palette.grainDark} opacity=".7"/>)}
      </pattern>
    </defs>
    <polygon points={corners.map(p => `${p.x},${p.y}`).join(' ')} fill={`url(#${patternId})`}/>
    {/* Rillen: dunkle Furche mit heller Kante auf der Sonnenseite */}
    {decor.grooves.map((groove, i) => {
      const a = iso(groove.from), b = iso(groove.to)
      return <g key={'g' + i}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={palette.groove} strokeWidth="5" strokeLinecap="round" opacity=".55"/>
        <line x1={a.x} y1={a.y + 2.6} x2={b.x} y2={b.y + 2.6} stroke={palette.rim} strokeWidth="1.2" strokeLinecap="round" opacity=".45"/>
      </g>
    })}
    {/* Krater: heller Wall, dunkle Schüssel, Schatten auf der sonnenabgewandten Innenseite */}
    {decor.craters.map((crater, i) => <g key={'c' + i}>
      <polygon points={circle(crater.xM, crater.yM, crater.rM * 1.22)} fill={palette.rim} opacity=".5"/>
      <polygon points={circle(crater.xM, crater.yM, crater.rM)} fill={palette.floor}/>
      <polygon points={circle(crater.xM - crater.rM * 0.16, crater.yM - crater.rM * 0.16, crater.rM * 0.82)} fill="#000" opacity=".22"/>
    </g>)}
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
