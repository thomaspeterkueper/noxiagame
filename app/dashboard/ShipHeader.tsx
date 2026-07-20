'use client'

// ShipHeader.tsx
// Aktualisiert: 04.07.2026 — Header ergänzt; Standort-Banner
// Version:      1.0.0
// ─────────────────────────────────────────────
//  ShipHeader.tsx
//  Ersetzt den aktuellen Standort-Header im Dashboard.
//  Einbindung: in DashboardClient.tsx, ganz oben
//  statt des schwarzen Location-Banners.
//
//  <ShipHeader
//    location="mars"
//    locationName="Mars / Tharsis Hub"
//    locationDesc="Größte außerirdische Siedlung. Wächst schnell."
//    shipType="freighter_mk1"
//    credits={2470}
//    inTransit={false}
//  />
// ─────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { ShipSVG, ShipSpriteStyles } from '@/lib/ships/ShipSVG'

type ShipType = 'freighter_mk1' | 'fast_courier' | 'heavy_hauler'

interface ShipHeaderProps {
  location: string
  locationName: string
  locationDesc: string
  shipType?: ShipType
  credits: number
  inTransit?: boolean
}

type LocCfg = { color: string; glow: string; planet: string; dot: string }

const LOCATION_CONFIG: Record<string, LocCfg> = {
  moon: {
    color: '#b8b0a2',
    glow: 'rgba(184,176,162,0.15)',
    planet: 'radial-gradient(circle at 35% 35%, #d0c8bc 0%, #8a8278 50%, #4a4240 100%)',
    dot: '#b8b0a2',
  },
  mars: {
    color: '#d0784a',
    glow: 'rgba(208,120,74,0.2)',
    planet: 'radial-gradient(circle at 35% 35%, #e08858 0%, #a04828 50%, #601810 100%)',
    dot: '#e05030',
  },
  phobos: {
    color: '#8a8278',
    glow: 'rgba(138,130,120,0.15)',
    planet: 'radial-gradient(circle at 35% 35%, #8a8278 0%, #5a5248 50%, #2a2820 100%)',
    dot: '#9a9288',
  },
  earth: {
    color: '#3a7abf',
    glow: 'rgba(58,122,191,0.2)',
    planet: 'radial-gradient(circle at 35% 35%, #5a9adf 0%, #2a5a9f 50%, #0a1a4f 100%)',
    dot: '#3a7abf',
  },
  prometheus: {
    color: '#c9a961',
    glow: 'rgba(201,169,97,0.2)',
    planet: 'radial-gradient(circle at 35% 35%, #e0c070 0%, #a07830 50%, #503800 100%)',
    dot: '#c9a961',
  },
}
const DEFAULT_LOC_CFG: LocCfg = {
  color: '#8a8278', glow: 'rgba(138,130,120,0.15)',
  planet: 'radial-gradient(circle at 35% 35%, #8a8278 0%, #5a5248 50%, #2a2820 100%)',
  dot: '#9a9288',
}
function locCfg(slug: string): LocCfg { return LOCATION_CONFIG[slug] ?? DEFAULT_LOC_CFG }

const LOCATION_LABELS: Record<string, string> = {
  moon: '⬡ Mond', mars: '● Mars', phobos: '□ Phobos',
  earth: '🌍 Erde', prometheus: '🛸 Prometheus',
}

const SHIP_LABELS: Record<ShipType, string> = {
  freighter_mk1: 'Frachter Mk.I',
  fast_courier:  'Schnellfrachter',
  heavy_hauler:  'Schwerfrachter',
}

export default function ShipHeader({
  location,
  locationName,
  locationDesc,
  shipType = 'freighter_mk1',
  credits,
  inTransit = false,
}: ShipHeaderProps) {
  const cfg = locCfg(location)
  const [glowScale, setGlowScale] = useState(1)
  const [shipX, setShipX] = useState(-200)

  // Subtle engine glow pulse
  useEffect(() => {
    const i = setInterval(() => setGlowScale(s => s === 1 ? 1.2 : 1), 600)
    return () => clearInterval(i)
  }, [])

  // Ship slowly drifts right when docked (idle hover)
  useEffect(() => {
    if (inTransit) return
    // Just a slow bob – handled via CSS
  }, [inTransit])

  return (
    <div style={{
      position: 'relative',
      height: 160,
      overflow: 'hidden',
      background: '#060a10',
      borderBottom: `1px solid ${cfg.glow.replace('0.', '0.3').replace(')', ')')}`,
      fontFamily: "'Courier Prime', monospace",
    }}>

      {/* Stars bg */}
      <div style={{ position: 'absolute', inset: 0 }}>
        {STAR_POSITIONS.map(([x,y,s,o], i) => (
          <div key={i} style={{
            position: 'absolute', left: `${x}%`, top: `${y}%`,
            width: s, height: s, borderRadius: '50%',
            background: `rgba(255,255,255,${o})`,
          }} />
        ))}
      </div>

      {/* Planet sphere */}
      <div style={{
        position: 'absolute',
        top: -30, left: -30,
        width: 200, height: 200,
        borderRadius: '50%',
        background: cfg.planet,
        opacity: 0.22,
        filter: 'blur(2px)',
        pointerEvents: 'none',
      }} />

      {/* Planet atmosphere ring */}
      <div style={{
        position: 'absolute',
        top: -40, left: -40,
        width: 220, height: 220,
        borderRadius: '50%',
        border: `1px solid ${cfg.color}22`,
        pointerEvents: 'none',
      }} />

      {/* Ship – docked position (right side, subtle hover) */}
      <div style={{
        position: 'absolute',
        right: 20,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 220,
        height: 110,
        animation: 'shipHover 4s ease-in-out infinite',
      }}>
        <style>{`
          @keyframes shipHover {
            0%, 100% { transform: translateY(-50%) translateX(0px); }
            50%       { transform: translateY(calc(-50% - 5px)) translateX(3px); }
          }
        `}</style>

        <ShipSpriteStyles />
        <div style={{
          filter: `drop-shadow(0 0 16px ${cfg.glow}) drop-shadow(0 4px 8px rgba(0,0,0,0.6))`,
          display: 'block',
        }}>
          <ShipSVG frame={shipType} flying={inTransit} size={110} />
        </div>

        {/* Engine idle glow */}
        {!inTransit && (
          <div style={{
            position: 'absolute',
            right: -4,
            top: '52%',
            transform: `translateY(-50%) scale(${glowScale})`,
            width: 12, height: 12,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,180,60,0.7) 0%, transparent 70%)',
            filter: 'blur(2px)',
            transition: 'transform 0.6s ease-in-out',
          }} />
        )}
      </div>

      {/* Location info – left side */}
      <div style={{
        position: 'absolute',
        left: 20, top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 5,
      }}>
        {/* Location label */}
        <div style={{
          fontSize: 9,
          letterSpacing: '0.14em',
          color: 'rgba(201,169,97,0.6)',
          textTransform: 'uppercase',
          marginBottom: 6,
        }}>
          Aktueller Standort
        </div>

        {/* Location name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: cfg.dot,
            boxShadow: `0 0 6px ${cfg.dot}`,
          }} />
          <span style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 22,
            fontWeight: 700,
            color: '#e8eff6',
            letterSpacing: '0.02em',
          }}>
            {locationName.split('/')[0].trim()}
          </span>
        </div>

        {/* Sub-name */}
        {locationName.includes('/') && (
          <div style={{
            fontSize: 10,
            color: 'rgba(200,212,224,0.5)',
            marginBottom: 4,
            marginLeft: 18,
          }}>
            {locationName.split('/').slice(1).join('/').trim()}
          </div>
        )}

        {/* Description */}
        <div style={{
          fontSize: 10,
          color: 'rgba(200,212,224,0.4)',
          fontStyle: 'italic',
          fontFamily: "'Playfair Display', serif",
          marginLeft: 18,
          maxWidth: 260,
        }}>
          {locationDesc}
        </div>

        {/* Ship label below */}
        <div style={{
          marginTop: 10,
          marginLeft: 18,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <div style={{
            fontSize: 8,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'rgba(201,169,97,0.5)',
            border: '1px solid rgba(201,169,97,0.25)',
            padding: '2px 6px',
          }}>
            {SHIP_LABELS[shipType]}
          </div>
          <div style={{
            fontSize: 8,
            color: inTransit ? '#e0904a' : '#4aaa6a',
            letterSpacing: '0.06em',
          }}>
            {inTransit ? '⟳ Im Transit' : '● Angedockt'}
          </div>
        </div>
      </div>

      {/* Bottom progress line (decorative) */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: 1,
        background: `linear-gradient(to right, transparent, ${cfg.color}40, transparent)`,
      }} />

      {/* Scanlines */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.03) 3px, rgba(0,0,0,0.03) 4px)',
        pointerEvents: 'none',
      }} />
    </div>
  )
}

const STAR_POSITIONS: [number, number, number, number][] = [
  [12,15,1,0.5],[28,65,1,0.35],[45,20,1.5,0.6],[58,75,1,0.4],
  [72,25,1,0.55],[82,55,1,0.35],[93,12,1.5,0.65],[18,48,1,0.3],
  [38,35,1,0.45],[67,50,1,0.4],[50,85,1.5,0.7],[86,40,1,0.6],
  [7,80,1,0.45],[95,70,1,0.35],[22,30,1,0.3],[60,8,1,0.5],
  [75,90,1,0.3],[42,58,1,0.4],[15,72,1,0.35],[88,22,1.5,0.55],
]
