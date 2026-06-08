'use client'

// ─────────────────────────────────────────────
//  ShipFlyby.tsx
//  Einbindung: in TransitPanel.tsx
//
//  <ShipFlyby
//    from="moon"
//    to="mars"
//    shipType="freighter_mk1"
//    totalSeconds={30}
//    secondsLeft={18}
//  />
// ─────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import { ShipSVG, ShipSpriteStyles } from '@/lib/ships/ShipSVG'

type LocationSlug = 'moon' | 'mars' | 'phobos'
type ShipType = 'freighter_mk1' | 'fast_courier' | 'heavy_hauler'

interface ShipFlybyProps {
  from: LocationSlug
  to: LocationSlug
  shipType?: ShipType
  totalSeconds: number
  secondsLeft: number
  cargoUsed?: number
  cargoMax?: number
}

const DEST_LABELS: Record<LocationSlug, string> = {
  moon: '⬡ Mond',
  mars: '● Mars',
  phobos: '□ Phobos',
}

const PLANET_STYLE: Record<LocationSlug, { bg: string }> = {
  moon:   { bg: 'radial-gradient(circle at 38% 38%, #c8c0b4 0%, #7a7268 45%, transparent 70%)' },
  mars:   { bg: 'radial-gradient(circle at 38% 38%, #d0784a 0%, #8a3a18 45%, transparent 70%)' },
  phobos: { bg: 'radial-gradient(circle at 38% 38%, #7a7068 0%, #3a3028 45%, transparent 70%)' },
}

const SHIP_SIDE_IMG: Record<ShipType, string> = {
  freighter_mk1: '/images/ships/freighter_side.png',
  fast_courier:  '/images/ships/courier_side.png',
  heavy_hauler:  '/images/ships/hauler_side.png',
}

const SHIP_LABELS: Record<ShipType, string> = {
  freighter_mk1: 'Frachter Mk.I',
  fast_courier:  'Schnellfrachter',
  heavy_hauler:  'Schwerfrachter',
}

export default function ShipFlyby({
  from,
  to,
  shipType = 'freighter_mk1',
  totalSeconds,
  secondsLeft,
  cargoUsed = 0,
  cargoMax = 100,
}: ShipFlybyProps) {
  const progress = totalSeconds > 0
    ? Math.max(0, Math.min(1, 1 - secondsLeft / totalSeconds))
    : 1

  // Engine glow pulse via JS for smooth animation
  const [glowScale, setGlowScale] = useState(1)
  useEffect(() => {
    const interval = setInterval(() => {
      setGlowScale(s => s === 1 ? 1.25 : 1)
    }, 350)
    return () => clearInterval(interval)
  }, [])

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const timeStr = mins > 0
    ? `${mins}m ${secs.toString().padStart(2,'0')}s`
    : `${secs}s`

  return (
    <div style={{
      position: 'relative',
      height: 180,
      overflow: 'hidden',
      background: 'radial-gradient(ellipse at 65% 50%, #0d1a2e 0%, #060a10 100%)',
      borderRadius: 2,
      fontFamily: "'Courier Prime', monospace",
    }}>

      {/* Stars */}
      <Stars />

      {/* Planet glow – destination */}
      <div style={{
        position: 'absolute',
        top: -50, right: -50,
        width: 160, height: 160,
        borderRadius: '50%',
        background: PLANET_STYLE[to].bg,
        opacity: 0.4,
        filter: 'blur(10px)',
        pointerEvents: 'none',
      }} />

      {/* Scanlines */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 4px)',
        pointerEvents: 'none',
        zIndex: 10,
      }} />

      {/* Ship – position driven by progress */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: `calc(${progress * 100}% - 120px)`,
        transform: 'translateY(-50%)',
        width: 260,
        height: 130,
        transition: 'left 1s linear',
        zIndex: 5,
      }}>
        {/* Exhaust trail */}
        <div style={{
          position: 'absolute',
          right: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 70,
          height: 6,
          background: 'linear-gradient(to left, transparent, rgba(255,160,40,0.12), rgba(120,180,255,0.06))',
          borderRadius: 3,
          filter: 'blur(4px)',
          animation: 'none',
          opacity: 0.8,
        }} />

        {/* Ship image */}
        <ShipSpriteStyles />
        <div style={{
          filter: 'drop-shadow(0 0 14px rgba(42,78,122,0.6))',
          display: 'block',
        }}>
          <ShipSVG frame={shipType} flying size={130} />
        </div>

        {/* Engine glow */}
        <div style={{
          position: 'absolute',
          right: -6,
          top: '52%',
          transform: `translateY(-50%) scale(${glowScale})`,
          width: 24, height: 24,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,200,70,1) 0%, rgba(255,100,10,0.6) 45%, transparent 70%)',
          filter: 'blur(3px)',
          transition: 'transform 0.35s ease-in-out',
        }} />
        <div style={{
          position: 'absolute',
          right: -2,
          top: 'calc(52% + 14px)',
          transform: `translateY(-50%) scale(${glowScale === 1 ? 1.2 : 0.9})`,
          width: 16, height: 16,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,200,70,0.8) 0%, rgba(255,100,10,0.4) 45%, transparent 70%)',
          filter: 'blur(2px)',
          transition: 'transform 0.35s ease-in-out',
        }} />
      </div>

      {/* Progress bar */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: 2,
        background: 'rgba(42,78,122,0.3)',
        zIndex: 8,
      }}>
        <div style={{
          height: '100%',
          width: `${progress * 100}%`,
          background: 'linear-gradient(to right, #2a4e7a, #c9a961)',
          transition: 'width 1s linear',
        }} />
      </div>

      {/* HUD overlays */}
      <div style={{ position: 'absolute', top: 10, left: 12, zIndex: 9 }}>
        <div style={{ fontSize: 9, letterSpacing: '0.1em', color: 'rgba(201,169,97,0.65)', textTransform: 'uppercase' }}>
          noχ¹ᐃ · Transitlog
        </div>
        <div style={{ fontSize: 9, color: 'rgba(200,212,224,0.45)', marginTop: 2 }}>
          {DEST_LABELS[from]} → {DEST_LABELS[to]}
        </div>
      </div>

      <div style={{ position: 'absolute', top: 10, right: 12, zIndex: 9, textAlign: 'right' }}>
        <div style={{ fontSize: 9, letterSpacing: '0.1em', color: 'rgba(201,169,97,0.65)', textTransform: 'uppercase' }}>
          {SHIP_LABELS[shipType]}
        </div>
        <div style={{ fontSize: 9, color: 'rgba(200,212,224,0.45)', marginTop: 2 }}>
          {cargoUsed}t / {cargoMax}t geladen
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 9 }}>
        <span style={{ fontSize: 9, color: '#4aaa6a', letterSpacing: '0.08em' }}>
          ● Transit aktiv
        </span>
      </div>

      <div style={{ position: 'absolute', bottom: 12, right: 12, zIndex: 9 }}>
        <span style={{ fontSize: 9, color: 'rgba(201,169,97,0.8)', letterSpacing: '0.08em' }}>
          ETA: {timeStr}
        </span>
      </div>
    </div>
  )
}

// ── Starfield helper ──
function Stars() {
  const stars = [
    [10,20],[25,70],[40,15],[55,80],[70,30],[80,60],[90,10],
    [15,50],[35,40],[65,55],[48,88],[83,45],[5,85],[92,75],[20,35],
    [60,25],[72,68],[33,90],[18,8],[87,35],
  ]
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {stars.map(([x,y], i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${x}%`, top: `${y}%`,
          width: i % 5 === 0 ? 1.5 : 1,
          height: i % 5 === 0 ? 1.5 : 1,
          borderRadius: '50%',
          background: `rgba(255,255,255,${0.3 + (i % 4) * 0.15})`,
        }} />
      ))}
    </div>
  )
}
