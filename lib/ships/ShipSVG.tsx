// lib/ships/ShipSVG.tsx
// Animierte Schiff-Sprites — ersetzt die <img>-Tags in ShipHeader / ShipyardCard /
// TransitPanel / ShipFlyby. Zwei Ansichten:
//   view="side"    (Standard) – Banner, Transit, Flyby
//   view="topdown"           – Werft-Karte (ShipyardCard)
// Rahmen + Module datengesteuert: Cargo = Kiste, Tank = Zylinder,
// Habitat = Ring (benachbarte Ringe gegenläufig → Passagier-/Kolonieschiff),
// Equipment = Pod. Transparent, dunkler Hintergrund-tauglich.
//
//   import { ShipSVG, ShipSpriteStyles } from '@/lib/ships/ShipSVG'
//   <ShipSpriteStyles />  // einmal mounten
//   <ShipSVG frame={shipType} flying={inTransit} />            // Seite
//   <ShipSVG frame={shipType} view="topdown" size={80} />      // Draufsicht

import React from 'react'

type FrameId = 'mk1' | 'fast' | 'heavy'
type ShipAlias = 'freighter_mk1' | 'fast_courier' | 'heavy_hauler'
type Status = 'active' | 'damaged' | 'disabled'
type ModuleType = 'cargo' | 'tank' | 'habitat' | 'equipment'

const ALIAS: Record<ShipAlias, FrameId> = {
  freighter_mk1: 'mk1', fast_courier: 'fast', heavy_hauler: 'heavy',
}
const FRAME: Record<FrameId, { slots: number; bigEngine: boolean }> = {
  mk1:   { slots: 5,  bigEngine: false },
  fast:  { slots: 3,  bigEngine: true },
  heavy: { slots: 10, bigEngine: false },
}

const HULL = '#33414e', HULL2 = '#1d2a38', STEEL = '#5a6b7a'
const GOLD = '#c9a961', PRIM = '#2a4e7a', FLAME = '#ffd27a', WATER = '#4a90d0'

export interface ShipModuleView { type: ModuleType; status?: Status }
export interface ShipSVGProps {
  frame?: FrameId | ShipAlias
  modules?: ShipModuleView[]   // default: Rahmen voll Cargo (= klassischer Frachter)
  flying?: boolean             // Triebwerksflamme an
  size?: number                // Höhe px, default 90 (side) / wird bei topdown genutzt
  view?: 'side' | 'topdown'
}

const SLOT_W = 26, GAP = 4, X0 = 52, CY = 60

// ── Seitenansicht ────────────────────────────────────────────────────────────
function Engine({ big }: { big: boolean }) {
  const w = big ? 22 : 16
  const nozzles = big ? [44, 76] : [52, 68]
  return (
    <>
      <rect x={6} y={CY - w} width={34} height={w * 2} rx={5} fill={HULL2} stroke={STEEL} strokeWidth={1.5} />
      {nozzles.map((y) => (
        <g key={y}>
          <rect x={2} y={y - 5} width={8} height={10} rx={2} fill="#0a0c10" stroke={STEEL} strokeWidth={1} />
          <polygon className="s-flame" points={`2,${y - 4} -14,${y} 2,${y + 4}`} fill={FLAME} />
        </g>
      ))}
    </>
  )
}

function ModuleGlyph({ m, x, i }: { m: ShipModuleView; x: number; i: number; key?: number }) {
  const broken = m.status && m.status !== 'active'
  const dim = broken ? 0.4 : 1
  let glyph: React.ReactNode
  if (m.type === 'cargo') {
    glyph = (
      <>
        <rect x={x} y={40} width={SLOT_W} height={40} rx={2} fill={HULL} stroke={STEEL} strokeWidth={1.2} />
        <rect x={x + 2} y={42} width={SLOT_W - 4} height={11} rx={1} fill={i % 2 ? GOLD : PRIM} opacity={0.75} />
        <line x1={x} y1={60} x2={x + SLOT_W} y2={60} stroke="#0a0c10" strokeWidth={1} />
      </>
    )
  } else if (m.type === 'tank') {
    glyph = (
      <>
        <rect x={x + 2} y={42} width={SLOT_W - 4} height={36} rx={(SLOT_W - 4) / 2} fill={HULL2} stroke={STEEL} strokeWidth={1.3} />
        <rect x={x + 4} y={58} width={SLOT_W - 8} height={18} rx={3} fill={WATER} opacity={0.5} />
      </>
    )
  } else if (m.type === 'equipment') {
    glyph = (
      <>
        <rect x={x + 4} y={48} width={SLOT_W - 8} height={24} rx={3} fill={HULL} stroke={STEEL} strokeWidth={1.2} />
        <circle className="s-blink" cx={x + SLOT_W / 2} cy={60} r={2.4} fill={GOLD} />
      </>
    )
  } else {
    const cx = x + SLOT_W / 2, r = 18
    const dir = i % 2 === 0 ? 's-ring-cw' : 's-ring-ccw'
    const pods = Array.from({ length: 8 }, (_, k) => {
      const a = (k / 8) * Math.PI * 2
      const px = cx + Math.cos(a) * r, py = CY + Math.sin(a) * r
      const off = k % 4 === 3
      return (
        <rect key={k} x={px - 2.4} y={py - 2.4} width={4.8} height={4.8} rx={1}
              transform={`rotate(${(a * 180) / Math.PI + 90} ${px} ${py})`}
              className={off ? '' : `s-pulse s-d${k % 3}`} fill={GOLD} opacity={off ? 0.13 : undefined} />
      )
    })
    glyph = (
      <>
        <g className={dir} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
          <circle cx={cx} cy={CY} r={r} fill="none" stroke={HULL} strokeWidth={5} />
          {pods}
        </g>
        <circle cx={cx} cy={CY} r={4} fill={HULL2} stroke={GOLD} strokeWidth={1} />
      </>
    )
  }
  return (
    <g opacity={dim} className={broken ? 's-paused' : undefined}>
      {glyph}
      {broken && <polygon points={`${x + SLOT_W - 4},42 ${x + SLOT_W},48 ${x + SLOT_W - 8},48`} fill="#d8402e" />}
    </g>
  )
}

function renderSide(def: typeof FRAME[FrameId], loadout: ShipModuleView[], flying: boolean, size: number) {
  const n = def.slots
  const spineEnd = X0 + n * (SLOT_W + GAP)
  const cockX = spineEnd + 4
  const W = cockX + 50
  const struts = Math.floor((spineEnd - 40) / 22)
  return (
    <svg width={(W / 120) * size} height={size} viewBox={`0 0 ${W} 120`} style={{ display: 'block', overflow: 'visible' }}>
      <g className={flying ? '' : 's-noflame'}><Engine big={def.bigEngine} /></g>
      <line x1={40} y1={CY - 8} x2={spineEnd} y2={CY - 8} stroke={STEEL} strokeWidth={2} />
      <line x1={40} y1={CY + 8} x2={spineEnd} y2={CY + 8} stroke={STEEL} strokeWidth={2} />
      {Array.from({ length: struts }, (_, i) => (
        <line key={i} x1={40 + 11 + i * 22} y1={CY - 8} x2={40 + 22 + i * 22} y2={CY + 8} stroke={STEEL} strokeWidth={1} opacity={0.5} />
      ))}
      {Array.from({ length: n }, (_, i) => {
        const x = X0 + i * (SLOT_W + GAP)
        const m = loadout[i]
        return m
          ? <ModuleGlyph key={i} m={m} x={x} i={i} />
          : <rect key={i} x={x} y={40} width={SLOT_W} height={40} rx={2} fill="none" stroke={STEEL} strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
      })}
      <polygon points={`${cockX},46 ${cockX + 30},52 ${cockX + 38},60 ${cockX + 30},68 ${cockX},74`} fill={HULL} stroke={STEEL} strokeWidth={1.5} />
      <circle cx={cockX + 22} cy={60} r={5} fill={PRIM} stroke={GOLD} strokeWidth={1} />
      <circle className="s-blink" cx={cockX + 33} cy={60} r={1.6} fill={GOLD} />
    </svg>
  )
}

// ── Draufsicht (Nase oben, Triebwerke unten) ─────────────────────────────────
function renderTopDown(def: typeof FRAME[FrameId], loadout: ShipModuleView[], flying: boolean, size: number) {
  const n = def.slots
  const hw = def.bigEngine ? 9 : (n >= 8 ? 14 : 11)   // halbe Rumpfbreite
  const cx = 60
  const y0 = 40, y1 = 116, slotH = (y1 - y0) / n
  const noz = def.bigEngine ? [cx - 9, cx + 9] : [cx - 6, cx + 6]

  const moduleTop = (m: ShipModuleView, i: number) => {
    const cy = y0 + (i + 0.5) * slotH
    const broken = m.status && m.status !== 'active'
    let g: React.ReactNode
    if (m.type === 'habitat') {
      const r = hw + 9
      const dir = i % 2 === 0 ? 's-ring-cw' : 's-ring-ccw'
      const pods = Array.from({ length: 8 }, (_, k) => {
        const a = (k / 8) * Math.PI * 2
        const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r
        const off = k % 4 === 3
        return <rect key={k} x={px - 2} y={py - 2} width={4} height={4} rx={1}
                     className={off ? '' : `s-pulse s-d${k % 3}`} fill={GOLD} opacity={off ? 0.13 : undefined} />
      })
      g = (
        <>
          <g className={dir} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={HULL} strokeWidth={4} />
            {pods}
          </g>
        </>
      )
    } else if (m.type === 'tank') {
      g = <rect x={cx - hw - 5} y={cy - slotH / 2 + 1.5} width={2 * hw + 10} height={slotH - 3} rx={(slotH - 3) / 2} fill={HULL2} stroke={STEEL} strokeWidth={1} />
    } else if (m.type === 'equipment') {
      g = <>
        <rect x={cx - hw} y={cy - slotH / 2 + 2} width={2 * hw} height={slotH - 4} rx={2} fill={HULL} stroke={STEEL} strokeWidth={1} />
        <circle className="s-blink" cx={cx} cy={cy} r={2} fill={GOLD} />
      </>
    } else { // cargo
      g = <>
        <rect x={cx - hw - 6} y={cy - slotH / 2 + 1.5} width={2 * hw + 12} height={slotH - 3} rx={2} fill={HULL} stroke={STEEL} strokeWidth={1.1} />
        <rect x={cx - hw - 4} y={cy - slotH / 2 + 3} width={2 * hw + 8} height={Math.max(3, slotH / 3)} rx={1} fill={i % 2 ? GOLD : PRIM} opacity={0.7} />
      </>
    }
    return <g key={i} opacity={broken ? 0.4 : 1} className={broken ? 's-paused' : undefined}>{g}</g>
  }

  const W = 120, H = 140
  return (
    <svg width={(W / H) * size} height={size} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
      {/* Rumpf */}
      <rect x={cx - hw} y={28} width={2 * hw} height={92} rx={hw} fill={HULL} stroke={STEEL} strokeWidth={1.5} />
      {/* Nase */}
      <polygon points={`${cx},6 ${cx - hw - 4},32 ${cx + hw + 4},32`} fill={HULL} stroke={STEEL} strokeWidth={1.5} />
      <circle cx={cx} cy={22} r={4} fill={PRIM} stroke={GOLD} strokeWidth={1} />
      {/* Module */}
      {Array.from({ length: n }, (_, i) => loadout[i]
        ? moduleTop(loadout[i], i)
        : <rect key={i} x={cx - hw} y={y0 + i * slotH + 1.5} width={2 * hw} height={slotH - 3} rx={2}
                fill="none" stroke={STEEL} strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />)}
      {/* Triebwerke unten */}
      <rect x={cx - hw - 4} y={118} width={2 * hw + 8} height={10} rx={3} fill={HULL2} stroke={STEEL} strokeWidth={1.2} />
      <g className={flying ? '' : 's-noflame'}>
        {noz.map((ex) => (
          <g key={ex}>
            <rect x={ex - 4} y={126} width={8} height={6} rx={2} fill="#0a0c10" stroke={STEEL} strokeWidth={1} />
            <polygon className="s-flame-d" points={`${ex - 4},132 ${ex},${H} ${ex + 4},132`} fill={FLAME} />
          </g>
        ))}
      </g>
    </svg>
  )
}

export function ShipSVG({ frame = 'mk1', modules, flying = false, size = 90, view = 'side' }: ShipSVGProps) {
  const frameId: FrameId = (ALIAS as Record<string, FrameId>)[frame] ?? (frame as FrameId)
  const def = FRAME[frameId] ?? FRAME.mk1
  const loadout: ShipModuleView[] = modules ?? Array.from({ length: def.slots }, () => ({ type: 'cargo' as ModuleType }))
  return view === 'topdown'
    ? renderTopDown(def, loadout, flying, size)
    : renderSide(def, loadout, flying, size)
}

// Einmal mounten.
export function ShipSpriteStyles() {
  return (
    <style>{`
      .s-flame{transform-box:fill-box;transform-origin:right center;animation:s-flame .22s ease-in-out infinite alternate}
      @keyframes s-flame{from{transform:scaleX(.6);opacity:.5}to{transform:scaleX(1.2);opacity:1}}
      .s-flame-d{transform-box:fill-box;transform-origin:top center;animation:s-flame-d .22s ease-in-out infinite alternate}
      @keyframes s-flame-d{from{transform:scaleY(.55);opacity:.5}to{transform:scaleY(1.2);opacity:1}}
      .s-noflame .s-flame,.s-noflame .s-flame-d{display:none}
      .s-ring-cw{transform-box:fill-box;transform-origin:center;animation:s-spin 16s linear infinite}
      .s-ring-ccw{transform-box:fill-box;transform-origin:center;animation:s-spin 12s linear infinite reverse}
      @keyframes s-spin{to{transform:rotate(360deg)}}
      .s-pulse{animation:s-pulse 3.4s ease-in-out infinite}
      .s-d0{animation-delay:0s}.s-d1{animation-delay:.7s}.s-d2{animation-delay:1.4s}
      @keyframes s-pulse{0%,100%{opacity:.3}50%{opacity:1}}
      .s-blink{animation:s-blink 2s ease-in-out infinite}
      @keyframes s-blink{0%,70%,100%{opacity:.25}80%{opacity:1}}
      .s-paused *{animation-play-state:paused!important}
    `}</style>
  )
}
