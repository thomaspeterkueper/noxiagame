// lib/grid/BuildingSVG.tsx
// Animierte Gebäude-Sprites fürs ColonyGrid. SVG-Code, kein Bildmaterial.
// 48×48-viewBox + transparenter Hintergrund wie TileSVG → liegt auf dem hellen
// Terrain. Bewegung per CSS (kein Frame-Drift). An die Spieldaten gekoppelt:
// occupancy (Habitat-Fenster), condition/status (defekt → gedimmt + Warnung).
//
// Einbau in ColonyGrid:
//   import { BuildingSVG, BuildingSpriteStyles } from '@/lib/grid/BuildingSVG'
//   // einmal im Grid-Container: <BuildingSpriteStyles />
//   // statt <TileSVG type={`building_${id}`}/> für Gebäudekacheln:
//   <BuildingSVG entityId={e.entity_id} planet={slug}
//                condition={e.condition} status={e.status}
//                occupancy={colonyLoad} owned={isOwn} />

import React from 'react'

type Planet = 'moon' | 'mars' | 'phobos'
type Status = 'active' | 'damaged' | 'disabled'

const PAL: Record<Planet, { body: string; bodyDark: string; accent: string }> = {
  moon:   { body: '#4a7ba3', bodyDark: '#3a6a8a', accent: '#f5d742' },
  mars:   { body: '#5a8ab3', bodyDark: '#4a7aa3', accent: '#f5d742' },
  phobos: { body: '#5a8ab3', bodyDark: '#4a7aa3', accent: '#f5d742' },
}
const STEEL = '#7c8590'
const INK   = '#1f2b36'

export interface BuildingSVGProps {
  entityId: string
  planet?: Planet
  status?: Status
  condition?: number   // 0..100 — < 100 dimmt, < 40 wirkt defekt
  occupancy?: number   // 0..1 — nur Habitat (Anzahl leuchtender Fenster)
  owned?: boolean
  size?: number        // px, default 44 (TILE_SIZE)
}

type SpriteFn = (c: typeof PAL[Planet], occ: number) => React.ReactNode

// ── Sprites (top-down, 0..48, transparenter Hintergrund) ─────────────────────
const SPRITES: Record<string, SpriteFn> = {
  solar: (c) => (
    <>
      <rect x={7} y={7} width={34} height={34} rx={2} fill={c.bodyDark} stroke={INK} strokeWidth={1} />
      <g className="b-spin-r" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
        <rect x={14} y={14} width={20} height={20} rx={1} fill={c.body} stroke={STEEL} strokeWidth={1} />
        <line x1={24} y1={14} x2={24} y2={34} stroke={c.accent} strokeWidth={1} opacity={0.7} />
        <line x1={14} y1={24} x2={34} y2={24} stroke={c.accent} strokeWidth={1} opacity={0.7} />
        <rect className="b-glint" x={14} y={14} width={20} height={20} fill="#fff" opacity={0} />
      </g>
      <circle cx={24} cy={24} r={1.6} fill={c.accent} />
    </>
  ),
  mine: (c) => (
    <>
      <polygon points="15,8 33,8 40,15 40,33 33,40 15,40 8,33 8,15"
               fill={c.bodyDark} stroke={INK} strokeWidth={1} />
      <circle className="b-pulse" cx={24} cy={24} r={8} fill={c.accent} />
      <g className="b-spin b-fast" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
         stroke={INK} strokeWidth={1.6} strokeLinecap="round">
        <line x1={24} y1={18} x2={24} y2={30} />
        <line x1={18} y1={24} x2={30} y2={24} />
      </g>
    </>
  ),
  habitat: (c, occ) => {
    const lit = Math.round(Math.max(0, Math.min(1, occ)) * 8)
    const win = Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2
      const x = 24 + Math.cos(a) * 16, y = 24 + Math.sin(a) * 16
      const on = i < lit
      return (
        <rect key={i} x={x - 2.4} y={y - 2.4} width={4.8} height={4.8} rx={1}
              transform={`rotate(${(a * 180) / Math.PI + 90} ${x} ${y})`}
              className={on ? `b-pulse b-d${i % 4}` : ''}
              fill={c.accent} opacity={on ? undefined : 0.12} />
      )
    })
    return (
      <>
        <circle cx={24} cy={24} r={16} fill="none" stroke={c.bodyDark} strokeWidth={7} />
        {win}
        <circle cx={24} cy={24} r={6} fill={c.body} stroke={c.accent} strokeWidth={1} />
        <circle cx={24} cy={24} r={1.6} fill={c.accent} />
      </>
    )
  },
  // Weitere aus dem Katalog (ice, smelter, hydro, …) folgen demselben Muster:
  // einfach hier registrieren. Fallback unten fängt Unbekanntes ab.
}

export function BuildingSVG({
  entityId, planet = 'moon', status = 'active', condition = 100,
  occupancy = 0, owned = false, size = 44,
}: BuildingSVGProps) {
  const c = PAL[planet]
  const sprite = SPRITES[entityId]
  const broken = status !== 'active' || condition < 40
  const dim = broken ? 0.45 : condition < 100 ? 0.6 + (condition / 100) * 0.4 : 1

  return (
    <svg width={size} height={size} viewBox="0 0 48 48"
         style={{ display: 'block', overflow: 'visible' }}>
      {owned && (
        <rect x={1} y={1} width={46} height={46} rx={3} fill="none"
              stroke={c.accent} strokeWidth={2} opacity={0.9} />
      )}
      <g className={broken ? 'b-paused' : undefined} opacity={dim}>
        {sprite
          ? sprite(c, occupancy)
          : (  // Fallback: schlichter Block
            <rect x={10} y={10} width={28} height={28} rx={2}
                  fill={c.body} stroke={INK} strokeWidth={1} />
          )}
      </g>
      {broken && (  // Warnmarker
        <g>
          <polygon points="38,8 44,18 32,18" fill="#d8402e" stroke="#fff" strokeWidth={0.8} />
          <rect x={37.2} y={11.5} width={1.6} height={3.6} fill="#fff" />
          <rect x={37.2} y={15.6} width={1.6} height={1.4} fill="#fff" />
        </g>
      )}
    </svg>
  )
}

// Einmal im Grid mounten (globale Keyframes für alle Sprites).
export function BuildingSpriteStyles() {
  return (
    <style>{`
      .b-spin{transform-box:fill-box;transform-origin:center;animation:b-spin 9s linear infinite}
      .b-spin-r{transform-box:fill-box;transform-origin:center;animation:b-spin 9s linear infinite reverse}
      .b-fast{animation-duration:3s}
      @keyframes b-spin{to{transform:rotate(360deg)}}
      .b-pulse{animation:b-pulse 2.4s ease-in-out infinite}
      .b-d0{animation-delay:0s}.b-d1{animation-delay:.6s}.b-d2{animation-delay:1.2s}.b-d3{animation-delay:1.8s}
      @keyframes b-pulse{0%,100%{opacity:.35}50%{opacity:1}}
      .b-glint{animation:b-glint 5s ease-in-out infinite}
      @keyframes b-glint{0%,72%,100%{opacity:0}80%{opacity:.7}}
      .b-paused *{animation-play-state:paused!important}
    `}</style>
  )
}
