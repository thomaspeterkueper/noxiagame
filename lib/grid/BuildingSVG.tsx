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
// Semantische Ressourcen-Farben (lesen auf hellem Terrain)
const WATER = '#2f86c9', OXY = '#3fb0c9', HEAT = '#e8702a', GREEN = '#4f9e54', ICEC = '#7fb8de'

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

const spinC = { transformBox: 'fill-box' as const, transformOrigin: 'center' as const }

// ── Sprites (top-down, 0..48, transparenter Hintergrund) ─────────────────────
const SPRITES: Record<string, SpriteFn> = {

  // ── Extraktion ──
  solar: (c) => (
    <>
      <rect x={7} y={7} width={34} height={34} rx={2} fill={c.bodyDark} stroke={INK} strokeWidth={1} />
      <g className="b-spin-r" style={spinC}>
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
      <polygon points="15,8 33,8 40,15 40,33 33,40 15,40 8,33 8,15" fill={c.bodyDark} stroke={INK} strokeWidth={1} />
      <circle className="b-pulse" cx={24} cy={24} r={8} fill={c.accent} />
      <g className="b-spin b-fast" style={spinC} stroke={INK} strokeWidth={1.6} strokeLinecap="round">
        <line x1={24} y1={18} x2={24} y2={30} />
        <line x1={18} y1={24} x2={30} y2={24} />
      </g>
    </>
  ),
  ice: (c) => (
    <>
      <rect x={8} y={8} width={32} height={32} rx={3} fill={c.bodyDark} stroke={INK} strokeWidth={1} />
      <g className="b-pulse">
        <polygon points="24,15 28,22 24,26 20,22" fill={ICEC} />
        <polygon points="17,25 21,29 18,34 14,30" fill={ICEC} opacity={0.7} />
        <polygon points="30,25 34,28 32,34 27,30" fill={ICEC} opacity={0.7} />
      </g>
      <g className="b-spin b-fast" style={spinC} stroke={STEEL} strokeWidth={2} strokeLinecap="round">
        <line x1={24} y1={20} x2={24} y2={28} />
      </g>
      <circle cx={24} cy={24} r={1.5} fill="#eaf6ff" />
    </>
  ),
  geothermal: (c) => (
    <>
      <rect x={8} y={8} width={32} height={32} rx={3} fill={c.bodyDark} stroke={INK} strokeWidth={1} />
      <circle cx={24} cy={24} r={13} fill="none" stroke={c.body} strokeWidth={1} />
      <circle cx={24} cy={24} r={9} fill="none" stroke={c.body} strokeWidth={1} opacity={0.7} />
      <circle className="b-pulse" cx={24} cy={24} r={7} fill={HEAT} />
      <circle className="b-pulse" cx={24} cy={24} r={3.5} fill={c.accent} />
      <g className="b-spin" style={spinC} stroke={INK} strokeWidth={1.4}>
        <line x1={24} y1={18} x2={24} y2={30} /><line x1={18} y1={24} x2={30} y2={24} />
      </g>
    </>
  ),

  // ── Verarbeitung ──
  isru: (c) => (
    <>
      <rect x={7} y={9} width={34} height={30} rx={3} fill={c.bodyDark} stroke={INK} strokeWidth={1} />
      <rect x={14} y={18} width={20} height={11} rx={5.5} fill="#0e151d" stroke={STEEL} strokeWidth={1} />
      <g className="b-spin" style={spinC} stroke={c.accent} strokeWidth={1.2} opacity={0.8}>
        <line x1={24} y1={19} x2={24} y2={28} /><line x1={19} y1={20} x2={29} y2={27} /><line x1={29} y1={20} x2={19} y2={27} />
      </g>
      <circle className="b-pulse" cx={20} cy={33} r={2} fill={c.accent} />
      <circle className="b-pulse b-d2" cx={27} cy={33} r={1.8} fill={WATER} />
    </>
  ),
  smelter: (c) => (
    <>
      <rect x={8} y={8} width={32} height={32} rx={3} fill={c.bodyDark} stroke={INK} strokeWidth={1} />
      <circle cx={24} cy={24} r={11} fill="#0e0a06" stroke={STEEL} strokeWidth={1} />
      <circle className="b-pulse" cx={24} cy={24} r={8} fill={HEAT} />
      <circle className="b-pulse" cx={24} cy={24} r={4.5} fill="#ffd27a" />
      <g className="b-spin" style={spinC} stroke="#3a2a14" strokeWidth={2} strokeLinecap="round">
        <line x1={24} y1={16} x2={24} y2={32} />
      </g>
    </>
  ),
  electrolysis: (c) => (
    <>
      <rect x={9} y={12} width={30} height={26} rx={3} fill={c.bodyDark} stroke={INK} strokeWidth={1} />
      <rect x={17} y={16} width={3} height={18} rx={1} fill={STEEL} />
      <rect x={28} y={16} width={3} height={18} rx={1} fill={STEEL} />
      <line className="b-pulse" x1={20} y1={18} x2={28} y2={18} stroke="#9fd8ff" strokeWidth={1.4} />
      <circle className="b-rise" cx={20} cy={32} r={2} fill={WATER} />
      <circle className="b-rise b-d1" cx={24} cy={33} r={1.6} fill={OXY} />
      <circle className="b-rise b-d2" cx={28} cy={32} r={2} fill={WATER} />
    </>
  ),
  water_plant: (c) => (
    <>
      <rect x={8} y={8} width={32} height={32} rx={3} fill={c.bodyDark} stroke={INK} strokeWidth={1} />
      <circle cx={24} cy={24} r={13} fill="#16344f" stroke={STEEL} strokeWidth={1} />
      <circle className="b-pulse" cx={24} cy={24} r={9} fill={WATER} opacity={0.5} />
      <g className="b-spin" style={spinC}>
        <line x1={12} y1={24} x2={36} y2={24} stroke={STEEL} strokeWidth={1.6} />
        <circle cx={24} cy={24} r={2} fill={STEEL} />
      </g>
    </>
  ),

  // ── Leben & Bevölkerung ──
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
  hydroponics: (c) => (
    <>
      <rect x={8} y={8} width={32} height={32} rx={3} fill="#15301c" stroke={INK} strokeWidth={1} />
      <g fill="none" stroke="#1f4a2b" strokeWidth={4}>
        <line x1={12} y1={15} x2={36} y2={15} /><line x1={12} y1={23} x2={36} y2={23} /><line x1={12} y1={31} x2={36} y2={31} />
      </g>
      <g fill={GREEN}>
        <circle cx={15} cy={15} r={1.6} /><circle cx={24} cy={15} r={1.6} /><circle cx={33} cy={15} r={1.6} />
        <circle cx={19} cy={23} r={1.6} /><circle cx={29} cy={23} r={1.6} />
        <circle cx={15} cy={31} r={1.6} /><circle cx={33} cy={31} r={1.6} />
      </g>
      <rect className="b-pulse" x={8} y={8} width={32} height={32} rx={3} fill="#ff5fb0" opacity={0.12} />
    </>
  ),
  oxygen_recycler: (c) => (
    <>
      <circle cx={24} cy={24} r={16} fill={c.bodyDark} stroke={INK} strokeWidth={1} />
      <circle cx={24} cy={24} r={12} fill="none" stroke={STEEL} strokeWidth={1} />
      <g className="b-spin b-fast" style={spinC} stroke={OXY} strokeWidth={2.4} strokeLinecap="round" opacity={0.85}>
        <line x1={24} y1={14} x2={24} y2={21} /><line x1={34} y1={24} x2={27} y2={24} />
        <line x1={24} y1={34} x2={24} y2={27} /><line x1={14} y1={24} x2={21} y2={24} />
      </g>
      <circle className="b-pulse" cx={24} cy={24} r={5} fill={OXY} opacity={0.6} />
    </>
  ),

  // ── Lager ──
  tank: (c) => (
    <>
      <circle cx={18} cy={20} r={9} fill={c.bodyDark} stroke={STEEL} strokeWidth={1.2} />
      <rect x={13.5} y={20} width={9} height={7} fill={WATER} opacity={0.55} />
      <circle cx={31} cy={20} r={9} fill={c.bodyDark} stroke={STEEL} strokeWidth={1.2} />
      <rect x={26.5} y={22} width={9} height={5} fill={OXY} opacity={0.5} />
      <circle cx={24} cy={33} r={9} fill={c.bodyDark} stroke={STEEL} strokeWidth={1.2} />
      <rect x={19.5} y={32} width={9} height={6} fill={WATER} opacity={0.55} />
      <circle className="b-pulse" cx={18} cy={13} r={1.4} fill={c.accent} />
    </>
  ),
  warehouse: (c) => (
    <>
      <rect x={8} y={9} width={32} height={30} rx={2} fill={c.bodyDark} stroke={INK} strokeWidth={1} />
      <g fill={c.body} stroke={STEEL} strokeWidth={0.8}>
        <rect x={12} y={13} width={11} height={8} /><rect x={25} y={13} width={11} height={8} />
        <rect x={12} y={23} width={11} height={8} /><rect x={25} y={23} width={11} height={8} />
      </g>
      <rect x={18} y={33} width={12} height={6} rx={1} fill="#0e151d" />
      <circle className="b-pulse" cx={24} cy={11} r={1.4} fill={c.accent} />
    </>
  ),

  // ── Fabrikation ──
  parts_factory: (c) => (
    <>
      <rect x={8} y={8} width={32} height={32} rx={3} fill={c.bodyDark} stroke={INK} strokeWidth={1} />
      <rect x={12} y={31} width={24} height={4} rx={1} fill={c.body} />
      <g className="b-spin" style={spinC}>
        <rect x={22} y={15} width={4} height={13} rx={1.5} fill={STEEL} />
        <rect x={22} y={13} width={10} height={3} rx={1.5} fill={c.accent} />
      </g>
      <rect className="b-pulse" x={13} y={32} width={4} height={4} rx={1} fill={c.accent} />
      <rect className="b-pulse b-d2" x={31} y={32} width={4} height={4} rx={1} fill={GREEN} />
    </>
  ),

  // ── Logistik & Erkundung ──
  landing_pad: (c) => (
    <>
      <polygon points="16,9 32,9 39,16 39,32 32,39 16,39 9,32 9,16" fill={c.bodyDark} stroke={STEEL} strokeWidth={1} />
      <circle cx={24} cy={24} r={13} fill="none" stroke={c.body} strokeWidth={1} strokeDasharray="2 3" />
      <g stroke={c.accent} strokeWidth={1.6} fill="none" strokeLinecap="round" opacity={0.7}>
        <polyline points="19,24 24,29 29,24" /><polyline points="19,19 24,24 29,19" />
      </g>
      <circle className="b-pulse" cx={24} cy={10} r={1.6} fill={c.accent} />
      <circle className="b-pulse b-d1" cx={38} cy={24} r={1.6} fill={c.accent} />
      <circle className="b-pulse b-d2" cx={24} cy={38} r={1.6} fill={c.accent} />
      <circle className="b-pulse b-d3" cx={10} cy={24} r={1.6} fill={c.accent} />
    </>
  ),
  relay_tower: (c) => (
    <>
      <circle cx={24} cy={24} r={15} fill={c.bodyDark} stroke={INK} strokeWidth={1} />
      <circle cx={24} cy={24} r={11} fill="none" stroke={c.body} strokeWidth={1} opacity={0.6} />
      <circle cx={24} cy={24} r={6} fill="none" stroke={c.body} strokeWidth={1} opacity={0.6} />
      <g className="b-spin b-fast" style={spinC}>
        <circle cx={24} cy={24} r={15} fill="none" />{/* bbox-Anker → Drehung um (24,24) */}
        <path d="M24,24 L24,9 A15,15 0 0,1 37,17 Z" fill={OXY} opacity={0.3} />
        <line x1={24} y1={24} x2={24} y2={9} stroke={OXY} strokeWidth={1.4} />
      </g>
      <circle cx={24} cy={24} r={2.5} fill={OXY} />
    </>
  ),
  trade_depot: (c) => (
    <>
      <rect x={10} y={20} width={28} height={19} rx={2} fill={c.bodyDark} stroke={INK} strokeWidth={1} />
      <polygon points="8,20 24,10 40,20" fill={c.body} stroke={INK} strokeWidth={1} />
      <g stroke={c.accent} strokeWidth={1.6} fill="none" strokeLinecap="round">
        <polyline points="17,28 23,28" /><polyline points="21,25 24,28 21,31" />
        <polyline points="31,33 25,33" /><polyline points="27,30 24,33 27,36" />
      </g>
      <circle className="b-pulse" cx={24} cy={24} r={2} fill={c.accent} />
    </>
  ),
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
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: 'block', overflow: 'visible' }}>
      {owned && (
        <rect x={1} y={1} width={46} height={46} rx={3} fill="none" stroke={c.accent} strokeWidth={2} opacity={0.9} />
      )}
      <g className={broken ? 'b-paused' : undefined} opacity={dim}>
        {sprite
          ? sprite(c, occupancy)
          : <rect x={10} y={10} width={28} height={28} rx={2} fill={c.body} stroke={INK} strokeWidth={1} />}
      </g>
      {broken && (
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
      .b-rise{animation:b-rise 2.2s ease-in infinite}
      @keyframes b-rise{0%{transform:translateY(0);opacity:0}20%{opacity:1}100%{transform:translateY(-14px);opacity:0}}
      .b-paused *{animation-play-state:paused!important}
    `}</style>
  )
}
