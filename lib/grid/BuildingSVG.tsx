// lib/grid/BuildingSVG.tsx
// Animierte Gebäude-Sprites fürs ColonyGrid - Premium Edition
// Komplett überarbeitet mit mehr Details, besseren Animationen und konsistenter Ästhetik

import React from 'react'

type Planet = 'moon' | 'mars' | 'phobos' | 'earth' | 'prometheus'
type Status = 'active' | 'damaged' | 'disabled'

type PalEntry = { body: string; bodyDark: string; bodyLight: string; accent: string; accentDim: string }

// Erweiterte Farbpalette
const PAL: Record<Planet, PalEntry> = {
  moon:   { 
    body: '#4a7ba3', 
    bodyDark: '#3a6a8a', 
    bodyLight: '#6a9bc3',
    accent: '#f5d742', 
    accentDim: '#c4a832' 
  },
  mars:   { 
    body: '#5a8ab3', 
    bodyDark: '#4a7aa3', 
    bodyLight: '#7aaad3',
    accent: '#f5d742', 
    accentDim: '#c4a832' 
  },
  phobos: { 
    body: '#5a8ab3', 
    bodyDark: '#4a7aa3', 
    bodyLight: '#7aaad3',
    accent: '#f5d742', 
    accentDim: '#c4a832' 
  },
  earth: {
    body: '#3a6a9a',
    bodyDark: '#2a5a8a',
    bodyLight: '#5a8aba',
    accent: '#7fd9b0',
    accentDim: '#4aaa80',
  },
  prometheus: {
    body: '#5a4a2a',
    bodyDark: '#4a3a1a',
    bodyLight: '#7a6a3a',
    accent: '#c9a961',
    accentDim: '#a08030',
  },
}
// Sicherer Zugriff — unbekannte Slugs fallen auf moon-Palette zurück.
function pal(planet: string): PalEntry {
  return (PAL as Record<string, PalEntry>)[planet] ?? PAL.moon
}

// Material-Farben
const STEEL = '#7c8590'
const STEEL_DARK = '#5a636e'
const INK = '#1f2b36'
const GLASS = 'rgba(200, 230, 255, 0.15)'

// Ressourcen-Farben (leuchtend auf dunklem Hintergrund)
const WATER = '#2f86c9'
const WATER_GLOW = 'rgba(47, 134, 201, 0.3)'
const OXY = '#3fb0c9'
const OXY_GLOW = 'rgba(63, 176, 201, 0.3)'
const HEAT = '#e8702a'
const HEAT_GLOW = 'rgba(232, 112, 42, 0.3)'
const GREEN = '#4f9e54'
const GREEN_GLOW = 'rgba(79, 158, 84, 0.3)'
const ICEC = '#7fb8de'
const ICEC_GLOW = 'rgba(127, 184, 222, 0.3)'
const POWER = '#ffd700'
const POWER_GLOW = 'rgba(255, 215, 0, 0.3)'
const PURPLE = '#b48ce8'
const PURPLE_GLOW = 'rgba(180, 140, 232, 0.3)'

export interface BuildingSVGProps {
  entityId: string
  planet?: string   // string statt Planet-Union — pal() fällt auf moon-Palette zurück
  status?: Status
  condition?: number
  occupancy?: number
  owned?: boolean
  size?: number
  production?: number
}

type SpriteFn = (c: typeof PAL[Planet], occ: number, prod?: number) => React.ReactNode

const spinC = { transformBox: 'fill-box' as const, transformOrigin: 'center' as const }

// ── Hilfsfunktionen für wiederkehrende Muster ──

// Erstellt ein Raster von Punkten
const gridPoints = (cols: number, rows: number, spacing: number, offsetX: number, offsetY: number) => {
  const points: {x: number, y: number}[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      points.push({ x: offsetX + c * spacing, y: offsetY + r * spacing })
    }
  }
  return points
}

// Erstellt Fenster in einem Kreis
const circularWindows = (count: number, radius: number, lit: number, cx: number, cy: number, color: string, size: number = 4) => {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius
    const on = i < lit
    
    return (
      <g key={`win-${i}`}>
        <rect
          x={x - size/2}
          y={y - size/2}
          width={size}
          height={size}
          rx={1.5}
          fill={on ? color : '#2a3a4a'}
          stroke={STEEL}
          strokeWidth={0.6}
        />
        {on && (
          <rect
            x={x - size/3}
            y={y - size/3}
            width={size * 0.67}
            height={size * 0.67}
            rx={1}
            className={`b-pulse b-d${i % 4}`}
            fill="#fff"
            opacity={0.7}
          />
        )}
      </g>
    )
  })
}

// ── SPRITES ──

const SPRITES: Record<string, SpriteFn> = {

  // ═══════════════════════════════════════════════════
  // EXTRACTION (Ressourcenförderung)
  // ═══════════════════════════════════════════════════

  solar: (c) => (
    <>
      {/* Basisplatte mit Schatten */}
      <rect x={5} y={5} width={38} height={38} rx={4} fill={c.bodyDark} stroke={INK} strokeWidth={1.2} />
      <rect x={7} y={7} width={34} height={34} rx={3} fill={c.bodyDark} stroke={STEEL_DARK} strokeWidth={0.5} />
      
      {/* Solarpanel mit Zellenstruktur */}
      <g>
        <rect x={10} y={10} width={28} height={28} rx={2} fill={c.body} stroke={STEEL} strokeWidth={0.8} />
        
        {/* Zellenraster */}
        <g stroke="#2a5a7a" strokeWidth={0.4} opacity={0.5}>
          {[13, 17, 21, 25, 29, 33].map(x => (
            <line key={`v${x}`} x1={x} y1={11} x2={x} y2={37} />
          ))}
          {[13, 17, 21, 25, 29, 33].map(y => (
            <line key={`h${y}`} x1={11} y1={y} x2={37} y2={y} />
          ))}
        </g>
        
        {/* Reflexionen */}
        <rect className="b-glint" x={14} y={14} width={20} height={20} fill="#fff" opacity={0} />
        <rect className="b-glint b-d2" x={16} y={16} width={16} height={16} fill="#fff" opacity={0} />
      </g>
      
      {/* Energieausgang */}
      <line x1={24} y1={38} x2={24} y2={42} stroke={POWER} strokeWidth={2} />
      <circle className="b-pulse" cx={24} cy={40} r={2} fill={POWER} opacity={0.6} />
      
      {/* Rahmenbeleuchtung */}
      <rect x={6} y={6} width={36} height={36} rx={3} fill="none" stroke={c.accent} strokeWidth={0.5} opacity={0.3} />
    </>
  ),

  mine: (c) => (
    <>
      {/* Achteckige Basis */}
      <polygon points="14,5 34,5 43,14 43,34 34,43 14,43 5,34 5,14" fill={c.bodyDark} stroke={INK} strokeWidth={1.2} />
      <polygon points="15,7 33,7 41,15 41,33 33,41 15,41 7,33 7,15" fill="none" stroke={STEEL} strokeWidth={0.5} opacity={0.5} />
      
      {/* Bohrturm */}
      <rect x={20} y={8} width={8} height={12} fill={c.body} stroke={STEEL} strokeWidth={0.8} />
      
      {/* Bohrkopf */}
      <circle className="b-pulse" cx={24} cy={22} r={10} fill={c.accent} opacity={0.1} />
      <circle cx={24} cy={22} r={7} fill={c.bodyDark} stroke={STEEL} strokeWidth={1} />
      
      {/* Rotierende Bohrer */}
      <g className="b-spin b-fast" style={spinC} stroke={INK} strokeWidth={2} strokeLinecap="round">
        <line x1={24} y1={16} x2={24} y2={28} />
        <line x1={17} y1={22} x2={31} y2={22} />
      </g>
      
      {/* Zentrum */}
      <circle cx={24} cy={22} r={2} fill={c.accent} />
      
      {/* Förderband */}
      <rect x={10} y={32} width={28} height={4} rx={2} fill="#1a2a3a" stroke={STEEL} strokeWidth={0.8} />
      <g className="b-spin" style={{ ...spinC, animationDuration: '2s' }}>
        <line x1={12} y1={34} x2={36} y2={34} stroke={c.accent} strokeWidth={0.5} opacity={0.4} />
      </g>
      
      {/* Geförderte Ressourcen */}
      {[0, 1, 2, 3].map(i => (
        <circle 
          key={`rock-${i}`}
          className={`b-rise b-d${i % 4}`}
          cx={14 + i * 7}
          cy={32}
          r={1.5}
          fill={ICEC}
          opacity={0.7}
        />
      ))}
    </>
  ),

  ice: (c) => (
    <>
      {/* Basis */}
      <rect x={7} y={7} width={34} height={34} rx={4} fill={c.bodyDark} stroke={INK} strokeWidth={1.2} />
      
      {/* Bohrplattform */}
      <rect x={16} y={8} width={16} height={16} rx={2} fill={c.body} stroke={STEEL} strokeWidth={0.8} />
      
      {/* Bohrer */}
      <circle className="b-pulse" cx={24} cy={16} r={6} fill={ICEC_GLOW} />
      <circle cx={24} cy={16} r={4} fill={c.bodyDark} stroke={STEEL} strokeWidth={0.8} />
      <g className="b-spin b-fast" style={spinC} stroke={STEEL} strokeWidth={1.5}>
        <line x1={24} y1={13} x2={24} y2={19} />
        <line x1={21} y1={16} x2={27} y2={16} />
      </g>
      
      {/* Eisbrocken */}
      {[0, 1, 2].map(i => {
        const x = 16 + i * 8
        const y = 30 + (i % 2) * 3
        return (
          <g key={`ice-${i}`} className={`b-rise b-d${i % 3}`}>
            <polygon points={`${x-2},${y} ${x},${y-3} ${x+2},${y} ${x+1.5},${y+2} ${x-1.5},${y+2}`} fill={ICEC} />
          </g>
        )
      })}
      
      {/* Kühlrippen */}
      <g stroke={STEEL} strokeWidth={0.6} opacity={0.5}>
        <line x1={10} y1={28} x2={14} y2={28} />
        <line x1={10} y1={30} x2={14} y2={30} />
        <line x1={10} y1={32} x2={14} y2={32} />
        <line x1={34} y1={28} x2={38} y2={28} />
        <line x1={34} y1={30} x2={38} y2={30} />
        <line x1={34} y1={32} x2={38} y2={32} />
      </g>
      
      {/* Eiskristalle (dekorativ) */}
      <g stroke={ICEC} strokeWidth={0.5} opacity={0.4}>
        <line x1={12} y1={12} x2={14} y2={14} />
        <line x1={36} y1={36} x2={34} y2={34} />
        <line x1={36} y1={12} x2={34} y2={14} />
        <line x1={12} y1={36} x2={14} y2={34} />
      </g>
    </>
  ),

  geothermal: (c) => (
    <>
      {/* Basis */}
      <rect x={7} y={7} width={34} height={34} rx={4} fill={c.bodyDark} stroke={INK} strokeWidth={1.2} />
      
      {/* Geothermie-Brunnen */}
      <rect x={16} y={8} width={16} height={8} rx={2} fill={c.body} stroke={STEEL} strokeWidth={0.8} />
      <rect x={14} y={14} width={20} height={4} rx={2} fill={c.bodyDark} stroke={STEEL} strokeWidth={0.6} />
      
      {/* Wärmequelle */}
      <circle className="b-pulse" cx={24} cy={28} r={12} fill={HEAT_GLOW} />
      <circle className="b-pulse b-d1" cx={24} cy={28} r={8} fill={HEAT} opacity={0.5} />
      <circle className="b-pulse b-d2" cx={24} cy={28} r={5} fill="#ff8a4a" opacity={0.7} />
      <circle cx={24} cy={28} r={2.5} fill={c.accent} />
      
      {/* Dampf - aufsteigend */}
      {[0, 1, 2].map(i => (
        <g key={`steam-${i}`} className={`b-rise b-d${i % 3}`}>
          <circle cx={20 + i * 4} cy={24} r={2} fill="#fff" opacity={0.2} />
        </g>
      ))}
      
      {/* Rotierende Turbine */}
      <g className="b-spin" style={{ ...spinC, animationDuration: '4s' }} stroke={STEEL} strokeWidth={1.5}>
        <line x1={24} y1={22} x2={24} y2={34} />
        <line x1={18} y1={28} x2={30} y2={28} />
      </g>
    </>
  ),

  // ═══════════════════════════════════════════════════
  // PROCESSING (Verarbeitung)
  // ═══════════════════════════════════════════════════

  isru: (c) => (
    <>
      {/* Basis */}
      <rect x={6} y={6} width={36} height={36} rx={4} fill={c.bodyDark} stroke={INK} strokeWidth={1.2} />
      
      {/* Reaktorkammer */}
      <rect x={10} y={12} width={28} height={16} rx={8} fill="#0a1520" stroke={STEEL} strokeWidth={1.2} />
      
      {/* Kühlrippen */}
      <g stroke={STEEL} strokeWidth={0.8} opacity={0.6}>
        {[14, 18, 22, 26, 30, 34].map(x => (
          <line key={`cool-${x}`} x1={x} y1={12} x2={x} y2={28} />
        ))}
      </g>
      
      {/* Plasmakern */}
      <circle className="b-pulse" cx={24} cy={20} r={6} fill={POWER_GLOW} />
      <circle className="b-pulse b-d1" cx={24} cy={20} r={4} fill="#ffd27a" opacity={0.5} />
      <circle className="b-pulse b-d2" cx={24} cy={20} r={2} fill={c.accent} />
      
      {/* Magnetfeld */}
      <g className="b-spin" style={{ ...spinC, animationDuration: '3s' }} stroke={OXY} strokeWidth={0.6} opacity={0.3}>
        <path d="M14,20 Q19,14 24,20 Q29,26 34,20" fill="none" />
        <path d="M14,20 Q19,26 24,20 Q29,14 34,20" fill="none" />
      </g>
      
      {/* Ausgänge */}
      <rect x={16} y={28} width={6} height={4} rx={1} fill={STEEL} />
      <rect x={26} y={28} width={6} height={4} rx={1} fill={STEEL} />
      
      {/* Produktion */}
      <circle className="b-pulse b-d0" cx={19} cy={36} r={2} fill={WATER} />
      <circle className="b-pulse b-d2" cx={29} cy={36} r={2} fill={OXY} />
    </>
  ),

  smelter: (c) => (
    <>
      {/* Basis */}
      <rect x={7} y={7} width={34} height={34} rx={4} fill={c.bodyDark} stroke={INK} strokeWidth={1.2} />
      
      {/* Schmelzofen */}
      <rect x={12} y={10} width={24} height={20} rx={3} fill="#1a0a05" stroke={STEEL} strokeWidth={1.2} />
      
      {/* Schmelze */}
      <circle className="b-pulse" cx={24} cy={20} r={9} fill={HEAT_GLOW} />
      <circle className="b-pulse b-d1" cx={24} cy={20} r={6} fill={HEAT} opacity={0.6} />
      <circle className="b-pulse b-d2" cx={24} cy={20} r={3.5} fill="#ffd27a" />
      
      {/* Schlacke */}
      <path d="M16,24 Q20,28 24,24 Q28,28 32,24" fill="none" stroke="#ff8a4a" strokeWidth={1} opacity={0.5} />
      
      {/* Ausfluss */}
      <rect x={20} y={30} width={8} height={4} rx={1} fill={STEEL} />
      
      {/* Metalltropfen */}
      {[0, 1, 2].map(i => (
        <circle 
          key={`metal-${i}`}
          className={`b-rise b-d${i % 3}`}
          cx={22 + i * 2}
          cy={32}
          r={1.5}
          fill={c.accent}
          opacity={0.6}
        />
      ))}
    </>
  ),

  electrolysis: (c) => (
    <>
      {/* Basis */}
      <rect x={7} y={7} width={34} height={34} rx={4} fill={c.bodyDark} stroke={INK} strokeWidth={1.2} />
      
      {/* Elektrolysezellen */}
      <g>
        {/* Zelle 1 */}
        <rect x={10} y={14} width={10} height={14} rx={2} fill="#0a1520" stroke={STEEL} strokeWidth={0.8} />
        <rect x={13} y={16} width={4} height={10} rx={1} fill={c.body} stroke={STEEL} strokeWidth={0.5} />
        <circle className="b-pulse b-d0" cx={15} cy={21} r={2} fill={OXY} opacity={0.4} />
        
        {/* Zelle 2 */}
        <rect x={28} y={14} width={10} height={14} rx={2} fill="#0a1520" stroke={STEEL} strokeWidth={0.8} />
        <rect x={31} y={16} width={4} height={10} rx={1} fill={c.body} stroke={STEEL} strokeWidth={0.5} />
        <circle className="b-pulse b-d2" cx={33} cy={21} r={2} fill={WATER} opacity={0.4} />
      </g>
      
      {/* Verbindung */}
      <line x1={20} y1={18} x2={28} y2={18} stroke={STEEL} strokeWidth={0.8} />
      <line x1={20} y1={24} x2={28} y2={24} stroke={STEEL} strokeWidth={0.8} />
      
      {/* Blasen */}
      {[0, 1, 2, 3].map(i => (
        <circle 
          key={`bubble-${i}`}
          className={`b-rise b-d${i % 4}`}
          cx={12 + i * 8}
          cy={30}
          r={1.2}
          fill={i % 2 === 0 ? OXY : WATER}
          opacity={0.3}
        />
      ))}
    </>
  ),

  water_plant: (c) => (
    <>
      {/* Basis */}
      <rect x={7} y={7} width={34} height={34} rx={4} fill={c.bodyDark} stroke={INK} strokeWidth={1.2} />
      
      {/* Wasserbecken */}
      <circle cx={24} cy={24} r={14} fill="#0a1a2a" stroke={STEEL} strokeWidth={1.2} />
      
      {/* Wasser */}
      <circle className="b-pulse" cx={24} cy={24} r={11} fill={WATER} opacity={0.3} />
      <circle className="b-pulse b-d1" cx={24} cy={24} r={8} fill={WATER} opacity={0.2} />
      
      {/* Wellen */}
      <g stroke={WATER} strokeWidth={0.8} opacity={0.5}>
        <path d="M16,24 Q20,20 24,24 Q28,28 32,24" fill="none" />
        <path d="M16,26 Q20,22 24,26 Q28,30 32,26" fill="none" />
      </g>
      
      {/* Pumpe */}
      <circle cx={24} cy={24} r={3} fill={c.body} stroke={STEEL} strokeWidth={0.8} />
      <g className="b-spin" style={{ ...spinC, animationDuration: '2s' }} stroke={STEEL} strokeWidth={1}>
        <line x1={24} y1={22} x2={24} y2={26} />
        <line x1={22} y1={24} x2={26} y2={24} />
      </g>
      
      {/* Rohre */}
      <line x1={24} y1={38} x2={24} y2={42} stroke={WATER} strokeWidth={2} />
    </>
  ),

  water_recycler: (c) => (
    <>
      {/* Basis */}
      <rect x={7} y={7} width={34} height={34} rx={4} fill={c.bodyDark} stroke={INK} strokeWidth={1.2} />
      
      {/* Kondensator-Trommel */}
      <rect x={12} y={10} width={24} height={16} rx={6} fill="#0a1a2a" stroke={WATER} strokeWidth={1.2} />
      
      {/* Kühlrippen */}
      <g stroke={STEEL} strokeWidth={0.6} opacity={0.5}>
        {[16, 20, 24, 28, 32].map(x => (
          <line key={`rib-${x}`} x1={x} y1={10} x2={x} y2={26} />
        ))}
      </g>
      
      {/* Kondensation */}
      <rect className="b-pulse" x={14} y={12} width={20} height={12} rx={4} fill={WATER} opacity={0.15} />
      
      {/* Tropfen */}
      <g>
        <circle className="b-rise b-d0" cx={18} cy={30} r={1.8} fill={WATER} />
        <circle className="b-rise b-d1" cx={24} cy={32} r={2} fill={WATER} />
        <circle className="b-rise b-d2" cx={30} cy={30} r={1.6} fill={WATER} />
      </g>
      
      {/* Auffangbecken */}
      <rect x={14} y={32} width={20} height={6} rx={2} fill="#0a1a2a" stroke={WATER} strokeWidth={0.8} />
      
      {/* Auslauf */}
      <rect x={21} y={38} width={6} height={4} rx={1} fill={STEEL} />
    </>
  ),

  ice_drill: (c) => SPRITES['ice'](c, 0),

  // ═══════════════════════════════════════════════════
  // LIFE & POPULATION
  // ═══════════════════════════════════════════════════

  habitat: (c, occ) => {
    const lit = Math.round(Math.max(0, Math.min(1, occ || 0)) * 12)
    
    return (
      <>
        {/* Äußere Hülle */}
        <circle cx={24} cy={24} r={20} fill="none" stroke={c.bodyDark} strokeWidth={8} />
        <circle cx={24} cy={24} r={22} fill="none" stroke={STEEL} strokeWidth={0.8} opacity={0.3} />
        
        {/* Fenster */}
        {circularWindows(12, 16, lit, 24, 24, c.accent, 5)}
        
        {/* Zentrale Steuerung */}
        <circle cx={24} cy={24} r={7} fill={c.body} stroke={STEEL} strokeWidth={0.8} />
        <circle cx={24} cy={24} r={3} fill={c.accent} />
        <circle cx={24} cy={24} r={4.5} fill="none" stroke={c.accent} strokeWidth={0.5} opacity={0.5} />
        
        {/* Belegungsbalken */}
        <rect x={16} y={42} width={16} height={2} rx={1} fill={STEEL} opacity={0.3} />
        <rect x={16} y={42} width={16 * (occ || 0)} height={2} rx={1} fill={c.accent} />
        
        {/* Lebenszeichen - Herzschlag */}
        {occ && occ > 0.5 && (
          <path 
            className="b-pulse" 
            d="M20,38 L22,38 L23,36 L25,40 L26,38 L28,38" 
            fill="none" 
            stroke="#ff6b6b" 
            strokeWidth={0.8}
          />
        )}
      </>
    )
  },

  hydroponics: (c) => (
    <>
      {/* Basis - Gewächshaus */}
      <rect x={7} y={7} width={34} height={34} rx={4} fill="#0a1a10" stroke={INK} strokeWidth={1.2} />
      
      {/* Glashaus - transparent */}
      <rect x={9} y={9} width={30} height={30} rx={3} fill={GLASS} stroke={STEEL} strokeWidth={0.8} />
      <rect x={9} y={9} width={30} height={30} rx={3} fill="none" stroke={STEEL_DARK} strokeWidth={0.3} opacity={0.5} />
      
      {/* Pflanzenreihen */}
      <g>
        {[0, 1, 2].map(row => (
          <g key={`row-${row}`}>
            <line x1={12} y1={16 + row * 8} x2={36} y2={16 + row * 8} stroke="#1a3a20" strokeWidth={3} opacity={0.5} />
            {[0, 1, 2, 3].map(col => {
              const x = 14 + col * 7
              const y = 16 + row * 8
              return (
                <g key={`plant-${row}-${col}`} className={`b-pulse b-d${(row + col) % 4}`}>
                  <circle cx={x} cy={y} r={2.5} fill={GREEN} opacity={0.7} />
                  <circle cx={x} cy={y-1} r={1.5} fill={GREEN} opacity={0.9} />
                  <circle cx={x+1} cy={y-2} r={1} fill="#6abf6e" opacity={0.6} />
                </g>
              )
            })}
          </g>
        ))}
      </g>
      
      {/* Bewässerungssystem */}
      <g stroke={WATER} strokeWidth={0.6} opacity={0.4}>
        <line x1={12} y1={12} x2={36} y2={12} />
        <line x1={12} y1={12} x2={12} y2={36} />
        <line x1={36} y1={12} x2={36} y2={36} />
      </g>
      
      {/* Wachstumslicht */}
      <rect className="b-pulse" x={12} y={10} width={24} height={2} rx={1} fill="#ff5fb0" opacity={0.3} />
    </>
  ),

  oxygen_recycler: (c) => (
    <>
      {/* Basis */}
      <circle cx={24} cy={24} r={18} fill={c.bodyDark} stroke={INK} strokeWidth={1.2} />
      
      {/* Filtereinheit */}
      <circle cx={24} cy={24} r={13} fill="#0a1520" stroke={STEEL} strokeWidth={1.2} />
      
      {/* Rotierende Filter */}
      <g className="b-spin b-fast" style={spinC}>
        <circle cx={24} cy={24} r={10} fill="none" stroke={OXY} strokeWidth={1.5} opacity={0.3} />
        <circle cx={24} cy={24} r={6} fill="none" stroke={OXY} strokeWidth={1} opacity={0.2} />
        
        {/* Filterflügel */}
        <path d="M24,24 L24,14 A10,10 0 0,1 32,18 Z" fill={OXY} opacity={0.15} />
        <path d="M24,24 L34,24 A10,10 0 0,1 30,32 Z" fill={OXY} opacity={0.15} />
        <path d="M24,24 L24,34 A10,10 0 0,1 16,30 Z" fill={OXY} opacity={0.15} />
        <path d="M24,24 L14,24 A10,10 0 0,1 18,16 Z" fill={OXY} opacity={0.15} />
      </g>
      
      {/* Luftstrom */}
      <circle className="b-pulse" cx={24} cy={24} r={4} fill={OXY_GLOW} />
      <circle cx={24} cy={24} r={2} fill={OXY} />
      
      {/* Ein-/Auslass */}
      <circle cx={24} cy={6} r={2} fill="none" stroke={OXY} strokeWidth={0.8} />
      <circle cx={24} cy={42} r={2} fill="none" stroke={OXY} strokeWidth={0.8} />
    </>
  ),

  // ═══════════════════════════════════════════════════
  // STORAGE
  // ═══════════════════════════════════════════════════

  tank: (c) => (
    <>
      {/* Basis */}
      <rect x={7} y={7} width={34} height={34} rx={4} fill={c.bodyDark} stroke={INK} strokeWidth={1.2} />
      
      {/* Tanks */}
      <g>
        {/* Tank 1 - Wasser */}
        <rect x={10} y={12} width={12} height={18} rx={4} fill={c.body} stroke={STEEL} strokeWidth={0.8} />
        <rect x={12} y={14} width={8} height={14} rx={2} fill={WATER} opacity={0.6} />
        <circle className="b-pulse b-d0" cx={16} cy={30} r={1.5} fill={WATER} />
        
        {/* Tank 2 - Sauerstoff */}
        <rect x={26} y={12} width={12} height={18} rx={4} fill={c.body} stroke={STEEL} strokeWidth={0.8} />
        <rect x={28} y={16} width={8} height={10} rx={2} fill={OXY} opacity={0.4} />
        <circle className="b-pulse b-d2" cx={32} cy={30} r={1.5} fill={OXY} />
      </g>
      
      {/* Verbindungsrohre */}
      <line x1={22} y1={16} x2={26} y2={16} stroke={STEEL} strokeWidth={1.2} />
      <line x1={22} y1={28} x2={26} y2={28} stroke={STEEL} strokeWidth={1.2} />
      
      {/* Füllstandsanzeigen */}
      <rect x={8} y={12} width={2} height={18} rx={1} fill={STEEL} opacity={0.3} />
      <rect x={8} y={12} width={2} height={12} rx={1} fill={WATER} opacity={0.5} />
      <rect x={38} y={12} width={2} height={18} rx={1} fill={STEEL} opacity={0.3} />
      <rect x={38} y={16} width={2} height={8} rx={1} fill={OXY} opacity={0.5} />
    </>
  ),

  warehouse: (c) => (
    <>
      {/* Lagerhalle */}
      <rect x={7} y={9} width={34} height={30} rx={3} fill={c.bodyDark} stroke={INK} strokeWidth={1.2} />
      
      {/* Dach */}
      <polygon points="6,9 24,4 42,9" fill={c.body} stroke={STEEL} strokeWidth={0.8} />
      
      {/* Regale */}
      <g>
        {[0, 1, 2].map(row => (
          <g key={`shelf-row-${row}`}>
            <rect x={10} y={13 + row * 9} width={28} height={6} rx={1} fill={c.body} stroke={STEEL} strokeWidth={0.6} />
            {[0, 1, 2].map(col => (
              <rect 
                key={`shelf-${row}-${col}`}
                x={13 + col * 9} 
                y={14 + row * 9} 
                width={6} 
                height={4} 
                rx={0.5} 
                fill="#2a3a4a" 
                stroke={STEEL_DARK} 
                strokeWidth={0.4}
              />
            ))}
          </g>
        ))}
      </g>
      
      {/* Tor */}
      <rect x={20} y={30} width={8} height={9} rx={1} fill="#1a2a3a" stroke={STEEL} strokeWidth={0.8} />
      <rect x={21} y={31} width={6} height={7} rx={0.5} fill={c.accent} opacity={0.1} className="b-pulse" />
      
      {/* Beleuchtung */}
      <rect x={8} y={9} width={2} height={2} fill={c.accent} opacity={0.3} className="b-pulse b-d0" />
      <rect x={38} y={9} width={2} height={2} fill={c.accent} opacity={0.3} className="b-pulse b-d2" />
    </>
  ),

  // ═══════════════════════════════════════════════════
  // MANUFACTURING
  // ═══════════════════════════════════════════════════

  parts_factory: (c) => (
    <>
      {/* Fabrikhalle */}
      <rect x={7} y={7} width={34} height={34} rx={4} fill={c.bodyDark} stroke={INK} strokeWidth={1.2} />
      
      {/* Produktionslinie */}
      <rect x={10} y={28} width={28} height={6} rx={2} fill="#1a2a3a" stroke={STEEL} strokeWidth={0.8} />
      
      {/* Förderband */}
      <g className="b-spin" style={{ ...spinC, animationDuration: '1.5s' }}>
        <line x1={12} y1={31} x2={36} y2={31} stroke={STEEL} strokeWidth={0.5} opacity={0.5} strokeDasharray="2 2" />
      </g>
      
      {/* Maschine */}
      <rect x={14} y={12} width={20} height={14} rx={2} fill={c.body} stroke={STEEL} strokeWidth={0.8} />
      
      {/* Zahnräder */}
      <g className="b-spin" style={{ ...spinC, animationDuration: '3s' }}>
        <circle cx={20} cy={19} r={4} fill="none" stroke={c.accent} strokeWidth={1} />
        <circle cx={28} cy={19} r={3} fill="none" stroke={c.accent} strokeWidth={1} />
        <line x1={20} y1={16} x2={20} y2={22} stroke={c.accent} strokeWidth={0.5} />
        <line x1={17} y1={19} x2={23} y2={19} stroke={c.accent} strokeWidth={0.5} />
        <line x1={28} y1={17} x2={28} y2={21} stroke={c.accent} strokeWidth={0.5} />
        <line x1={26} y1={19} x2={30} y2={19} stroke={c.accent} strokeWidth={0.5} />
      </g>
      
      {/* Produktion */}
      <circle className="b-pulse b-d0" cx={16} cy={34} r={2} fill={c.accent} />
      <circle className="b-pulse b-d1" cx={22} cy={34} r={2} fill={c.accent} opacity={0.7} />
      <circle className="b-pulse b-d2" cx={28} cy={34} r={2} fill={c.accent} opacity={0.4} />
    </>
  ),

  // ═══════════════════════════════════════════════════
  // LOGISTICS & EXPLORATION
  // ═══════════════════════════════════════════════════

  landing_pad: (c) => (
    <>
      {/* Landeplattform - achteckig */}
      <polygon points="14,4 34,4 44,14 44,34 34,44 14,44 4,34 4,14" fill={c.bodyDark} stroke={INK} strokeWidth={1.2} />
      
      {/* Landekreis */}
      <circle cx={24} cy={24} r={14} fill="#1a2a3a" stroke={STEEL} strokeWidth={1.2} />
      <circle cx={24} cy={24} r={11} fill="none" stroke={STEEL_DARK} strokeWidth={0.5} strokeDasharray="3 3" />
      
      {/* Start-/Landesignale */}
      <g>
        {[0, 1, 2, 3].map(i => {
          const angle = (i / 4) * Math.PI * 2 - Math.PI / 4
          const x = 24 + Math.cos(angle) * 8
          const y = 24 + Math.sin(angle) * 8
          return (
            <circle 
              key={`beacon-${i}`}
              className={`b-pulse b-d${i % 4}`}
              cx={x}
              cy={y}
              r={2}
              fill={c.accent}
              opacity={0.6}
            />
          )
        })}
      </g>
      
      {/* Landeplatz-Markierungen */}
      <g stroke={c.accent} strokeWidth={1} opacity={0.4}>
        <line x1={24} y1={10} x2={24} y2={14} />
        <line x1={24} y1={34} x2={24} y2={38} />
        <line x1={10} y1={24} x2={14} y2={24} />
        <line x1={34} y1={24} x2={38} y2={24} />
      </g>
    </>
  ),

  relay_tower: (c) => (
    <>
      {/* Basis */}
      <circle cx={24} cy={24} r={16} fill={c.bodyDark} stroke={INK} strokeWidth={1.2} />
      
      {/* Antennenmast */}
      <rect x={22} y={6} width={4} height={20} fill={STEEL} stroke={INK} strokeWidth={0.5} />
      
      {/* Antennen */}
      <g>
        {/* Parabolantenne */}
        <path d="M18,10 Q24,4 30,10" fill="none" stroke={STEEL} strokeWidth={1.2} />
        <line x1={24} y1={7} x2={24} y2={3} stroke={STEEL} strokeWidth={0.8} />
        
        {/* Dipolantenne */}
        <line x1={18} y1={14} x2={30} y2={14} stroke={STEEL} strokeWidth={0.6} />
        
        {/* Sendeimpulse */}
        <g className="b-pulse">
          <circle cx={24} cy={8} r={3} fill="none" stroke={PURPLE} strokeWidth={0.8} opacity={0.6} />
          <circle cx={24} cy={8} r={5} fill="none" stroke={PURPLE} strokeWidth={0.5} opacity={0.4} />
          <circle cx={24} cy={8} r={7} fill="none" stroke={PURPLE} strokeWidth={0.3} opacity={0.2} />
        </g>
      </g>
      
      {/* Rotierender Radar-Sweep */}
      <g className="b-spin" style={{ ...spinC, animationDuration: '4s' }}>
        <path d="M24,24 L24,8 A16,16 0 0,1 35,17 Z" fill={PURPLE} opacity={0.15} />
        <line x1={24} y1={24} x2={24} y2={8} stroke={PURPLE} strokeWidth={0.8} opacity={0.4} />
      </g>
      
      {/* Basis-Steuerung */}
      <rect x={18} y={28} width={12} height={6} rx={2} fill={c.body} stroke={STEEL} strokeWidth={0.6} />
      <circle className="b-pulse b-d0" cx={21} cy={31} r={1.5} fill={PURPLE} opacity={0.6} />
      <circle className="b-pulse b-d2" cx={27} cy={31} r={1.5} fill={PURPLE} opacity={0.6} />
    </>
  ),

  trade_depot: (c) => (
    <>
      {/* Handelsstation */}
      <rect x={7} y={16} width={34} height={22} rx={4} fill={c.bodyDark} stroke={INK} strokeWidth={1.2} />
      
      {/* Dach */}
      <polygon points="4,16 24,6 44,16" fill={c.body} stroke={STEEL} strokeWidth={0.8} />
      
      {/* Handelsfenster */}
      <rect x={12} y={22} width={10} height={8} rx={1} fill="#1a2a3a" stroke={STEEL} strokeWidth={0.6} />
      <rect x={26} y={22} width={10} height={8} rx={1} fill="#1a2a3a" stroke={STEEL} strokeWidth={0.6} />
      
      {/* Waren - Handelsgüter */}
      <rect x={14} y={24} width={6} height={4} rx={0.5} fill={c.accent} opacity={0.3} className="b-pulse b-d0" />
      <rect x={28} y={24} width={6} height={4} rx={0.5} fill={c.accent} opacity={0.3} className="b-pulse b-d2" />
      
      {/* Handelssymbole */}
      <g stroke={c.accent} strokeWidth={1} opacity={0.6}>
        <path d="M17,30 L19,30 M18,29 L18,31" />
        <path d="M31,30 L29,30 M30,29 L30,31" />
      </g>
      
      {/* Tür */}
      <rect x={21} y={28} width={6} height={10} rx={1} fill="#0a1520" stroke={STEEL} strokeWidth={0.6} />
    </>
  ),

  // ═══════════════════════════════════════════════════
  // SCIENCE & RESEARCH
  // ═══════════════════════════════════════════════════

  school: (c) => (
    <>
      {/* Akademiegebäude */}
      <rect x={7} y={12} width={34} height={26} rx={3} fill={c.bodyDark} stroke={INK} strokeWidth={1.2} />
      
      {/* Dach - griechischer Tempel-Stil */}
      <polygon points="4,12 24,2 44,12" fill={c.body} stroke={STEEL} strokeWidth={0.8} />
      <polygon points="12,12 24,6 36,12" fill="none" stroke={c.accent} strokeWidth={0.5} opacity={0.3} />
      
      {/* Säulen */}
      <g>
        <rect x={10} y={18} width={3} height={20} rx={1} fill={STEEL} opacity={0.6} />
        <rect x={35} y={18} width={3} height={20} rx={1} fill={STEEL} opacity={0.6} />
        <rect x={16} y={18} width={2} height={20} rx={1} fill={STEEL} opacity={0.3} />
        <rect x={30} y={18} width={2} height={20} rx={1} fill={STEEL} opacity={0.3} />
      </g>
      
      {/* Eingang */}
      <rect x={20} y={26} width={8} height={12} rx={1} fill="#0a1520" stroke={STEEL} strokeWidth={0.6} />
      
      {/* Fenster mit Lernlicht */}
      <rect className="b-pulse b-d0" x={12} y={20} width={5} height={4} rx={1} fill={c.accent} opacity={0.4} />
      <rect className="b-pulse b-d2" x={31} y={20} width={5} height={4} rx={1} fill={c.accent} opacity={0.4} />
      
      {/* Wissenssymbol - offenes Buch */}
      <g transform="translate(24, 10)" stroke={c.accent} strokeWidth={0.8} fill="none">
        <path d="M-4,0 L0,-2 L4,0" />
        <path d="M-4,0 L-4,3 L0,2 L4,3 L4,0" opacity={0.5} />
      </g>
    </>
  ),

  scanner: (c) => (
    <>
      {/* Scaneinheit */}
      <rect x={7} y={7} width={34} height={34} rx={4} fill={c.bodyDark} stroke={INK} strokeWidth={1.2} />
      
      {/* Radar-Schüssel */}
      <circle cx={24} cy={24} r={14} fill="#0a1520" stroke={STEEL} strokeWidth={1.2} />
      <circle cx={24} cy={24} r={11} fill="none" stroke={STEEL_DARK} strokeWidth={0.5} />
      <circle cx={24} cy={24} r={7} fill="none" stroke={STEEL_DARK} strokeWidth={0.3} />
      
      {/* Scan-Keile */}
      <g className="b-spin" style={{ ...spinC, animationDuration: '3s' }}>
        {/* Haupt-Sweep */}
        <path d="M24,24 L24,10 A14,14 0 0,1 35,20 Z" fill={PURPLE} opacity={0.2} />
        <line x1={24} y1={24} x2={24} y2={10} stroke={PURPLE} strokeWidth={1.2} opacity={0.5} />
        
        {/* Sekundär-Sweep */}
        <path d="M24,24 L24,38 A14,14 0 0,1 13,28 Z" fill={PURPLE} opacity={0.1} />
        <line x1={24} y1={24} x2={24} y2={38} stroke={PURPLE} strokeWidth={0.6} opacity={0.2} />
      </g>
      
      {/* Entdeckungspunkte */}
      <g>
        <circle className="b-pulse b-d0" cx={18} cy={18} r={1.5} fill={PURPLE} opacity={0.3} />
        <circle className="b-pulse b-d1" cx={30} cy={30} r={1.5} fill={PURPLE} opacity={0.3} />
        <circle className="b-pulse b-d2" cx={32} cy={17} r={1.5} fill={PURPLE} opacity={0.2} />
      </g>
      
      {/* Zentrum */}
      <circle cx={24} cy={24} r={2.5} fill={PURPLE} />
    </>
  ),
  // ═══════════════════════════════════════════════════
  // ADMIN & COMMAND
  // ═══════════════════════════════════════════════════

  command_center: (c) => (
    <>
      <rect x={5} y={5} width={38} height={38} rx={5} fill={c.bodyDark} stroke={INK} strokeWidth={1.5} />
      <rect x={7} y={7} width={34} height={34} rx={4} fill="none" stroke={c.accent} strokeWidth={0.8} opacity={0.3} />
      <rect x={12} y={12} width={24} height={20} rx={3} fill={c.body} stroke={STEEL} strokeWidth={1.2} />
      <polygon points="10,12 24,5 38,12" fill={c.bodyLight} stroke={STEEL} strokeWidth={0.8} />
      <line x1={24} y1={5} x2={24} y2={3} stroke={c.accent} strokeWidth={1.5} />
      <circle className="b-pulse" cx={24} cy={3} r={2} fill={c.accent} />
      <rect x={15} y={18} width={18} height={8} rx={2} fill="#0a1520" stroke={STEEL} strokeWidth={0.6} />
      <rect x={17} y={20} width={14} height={4} rx={1} fill={c.accent} opacity={0.15} className="b-pulse" />
      <rect x={14} y={28} width={5} height={4} rx={1} fill="#0a1520" stroke={STEEL} strokeWidth={0.4} />
      <rect x={29} y={28} width={5} height={4} rx={1} fill="#0a1520" stroke={STEEL} strokeWidth={0.4} />
      <line x1={18} y1={5} x2={18} y2={9} stroke={STEEL} strokeWidth={0.8} />
      <line x1={30} y1={5} x2={30} y2={9} stroke={STEEL} strokeWidth={0.8} />
      <circle className="b-pulse b-d0" cx={18} cy={4} r={1.5} fill={PURPLE} opacity={0.5} />
      <circle className="b-pulse b-d2" cx={30} cy={4} r={1.5} fill={PURPLE} opacity={0.5} />
      <circle className="b-pulse b-d0" cx={14} cy={15} r={1.2} fill={GREEN} />
      <circle className="b-pulse b-d1" cx={14} cy={18} r={1.2} fill={GREEN} />
      <circle className="b-pulse b-d2" cx={14} cy={21} r={1.2} fill={GREEN} />
      <rect x={22} y={30} width={4} height={6} rx={1} fill="#0a1520" stroke={STEEL} strokeWidth={0.6} />
    </>
  ),

  admin: (c) => (
    <>
      <rect x={6} y={6} width={36} height={36} rx={4} fill={c.bodyDark} stroke={INK} strokeWidth={1.2} />
      <rect x={10} y={12} width={28} height={22} rx={3} fill={c.body} stroke={STEEL} strokeWidth={1} />
      <rect x={10} y={12} width={28} height={3} rx={1} fill={c.bodyLight} stroke={STEEL} strokeWidth={0.6} />
      {[0, 1, 2].map(i => (
        <rect key={`wt-${i}`} x={14 + i * 8} y={17} width={5} height={4} rx={1}
          fill="#0a1520" stroke={STEEL} strokeWidth={0.4}
          className={`b-pulse b-d${i % 3}`} opacity={0.5 + (i % 2) * 0.3} />
      ))}
      {[0, 1, 2].map(i => (
        <rect key={`wb-${i}`} x={14 + i * 8} y={25} width={5} height={4} rx={1}
          fill="#0a1520" stroke={STEEL} strokeWidth={0.4}
          className={`b-pulse b-d${(i + 2) % 3}`} opacity={0.3 + (i % 2) * 0.3} />
      ))}
      <rect x={21} y={30} width={6} height={4} rx={1} fill="#0a1520" stroke={STEEL} strokeWidth={0.6} />
      <line x1={24} y1={8} x2={24} y2={12} stroke={STEEL} strokeWidth={0.6} />
      <polygon points="24,8 30,10 24,12" fill={c.accent} opacity={0.7} className="b-pulse" />
    </>
  ),

  governor: (c) => (
    <>
      <rect x={6} y={6} width={36} height={36} rx={5} fill={c.bodyDark} stroke={INK} strokeWidth={1.5} />
      <rect x={12} y={14} width={24} height={20} rx={3} fill={c.body} stroke={STEEL} strokeWidth={1} />
      <polygon points="8,14 24,6 40,14" fill={c.bodyLight} stroke={STEEL} strokeWidth={0.8} />
      <rect x={16} y={18} width={16} height={8} rx={2} fill="#0a1520" stroke={STEEL} strokeWidth={0.8} />
      <rect x={18} y={20} width={12} height={4} rx={1} fill={c.accent} opacity={0.2} className="b-pulse" />
      <rect x={14} y={28} width={4} height={4} rx={1} fill="#0a1520" stroke={STEEL} strokeWidth={0.4} />
      <rect x={30} y={28} width={4} height={4} rx={1} fill="#0a1520" stroke={STEEL} strokeWidth={0.4} />
      <rect x={21} y={30} width={6} height={4} rx={1.5} fill="#0a1520" stroke={STEEL} strokeWidth={0.6} />
      <g transform="translate(24, 10)" stroke={c.accent} strokeWidth={1} fill="none">
        <path d="M-4,0 L-2,-3 L0,0 L2,-3 L4,0" />
        <path d="M-4,0 L4,0" />
        <circle cx={0} cy={-2} r={0.8} />
      </g>
      <rect x={11} y={16} width={1.5} height={10} fill={STEEL} opacity={0.4} />
      <rect x={35.5} y={16} width={1.5} height={10} fill={STEEL} opacity={0.4} />
    </>
  ),

  embassy: (c) => (
    <>
      <rect x={6} y={6} width={36} height={36} rx={4} fill={c.bodyDark} stroke={INK} strokeWidth={1.2} />
      <rect x={10} y={14} width={28} height={20} rx={3} fill={c.body} stroke={STEEL} strokeWidth={1} />
      <rect x={10} y={14} width={28} height={3} rx={1} fill={c.bodyLight} stroke={STEEL} strokeWidth={0.6} />
      <rect x={14} y={19} width={20} height={8} rx={2} fill="#0a1520" stroke={STEEL} strokeWidth={0.6} />
      <rect x={16} y={21} width={16} height={4} rx={1} fill={c.accent} opacity={0.12} className="b-pulse" />
      <line x1={14} y1={8} x2={14} y2={14} stroke={STEEL} strokeWidth={0.4} />
      <polygon points="14,8 18,10 14,12" fill={c.accent} opacity={0.5} />
      <line x1={34} y1={8} x2={34} y2={14} stroke={STEEL} strokeWidth={0.4} />
      <polygon points="34,8 30,10 34,12" fill={PURPLE} opacity={0.5} />
      <rect x={22} y={30} width={4} height={4} rx={1} fill="#0a1520" stroke={STEEL} strokeWidth={0.4} />
    </>
  ),

  // ═══════════════════════════════════════════════════
  // MILITARY & DEFENSE
  // ═══════════════════════════════════════════════════

  barracks: (c) => (
    <>
      <rect x={6} y={6} width={36} height={36} rx={4} fill={c.bodyDark} stroke={INK} strokeWidth={1.2} />
      <rect x={9} y={12} width={30} height={22} rx={3} fill={c.body} stroke={STEEL} strokeWidth={1} />
      <rect x={9} y={12} width={30} height={3} rx={1} fill={c.bodyLight} stroke={STEEL} strokeWidth={0.6} />
      {[0, 1, 2, 3].map(i => (
        <rect key={`bw-${i}`} x={12 + i * 7} y={18} width={4} height={3} rx={0.5}
          fill="#0a1520" stroke={STEEL} strokeWidth={0.4}
          className={`b-pulse b-d${i % 3}`} opacity={0.4 + (i % 2) * 0.2} />
      ))}
      {[0,1,2,3,4].map(i => (
        <circle key={`star-${i}`} cx={16 + i * 4} cy={14} r={1} stroke={c.accent} strokeWidth={0.8} fill="none" opacity={0.5} />
      ))}
      <rect x={21} y={30} width={6} height={4} rx={0.5} fill="#0a1520" stroke={STEEL} strokeWidth={0.6} />
      <circle className="b-pulse b-d0" cx={12} cy={16} r={1} fill="#ff6b6b" opacity={0.6} />
      <circle className="b-pulse b-d2" cx={36} cy={16} r={1} fill="#ff6b6b" opacity={0.6} />
    </>
  ),

  defense: (c) => (
    <>
      <rect x={6} y={6} width={36} height={36} rx={4} fill={c.bodyDark} stroke={INK} strokeWidth={1.2} />
      <circle cx={24} cy={24} r={14} fill={c.body} stroke={STEEL} strokeWidth={1.2} />
      <circle cx={24} cy={24} r={11} fill="#0a1520" stroke={STEEL} strokeWidth={0.8} />
      <g className="b-spin" style={{ ...spinC, animationDuration: '6s' }}>
        <rect x={22} y={10} width={4} height={10} rx={2} fill={STEEL} stroke={INK} strokeWidth={0.5} />
        <rect x={21} y={8} width={6} height={4} rx={1} fill={STEEL_DARK} stroke={INK} strokeWidth={0.5} />
        <circle cx={24} cy={7} r={2} fill="none" stroke={c.accent} strokeWidth={0.8} opacity={0.5} />
      </g>
      <rect x={14} y={28} width={20} height={6} rx={2} fill={c.bodyDark} stroke={STEEL} strokeWidth={0.6} />
      <circle className="b-pulse" cx={24} cy={36} r={2} fill={GREEN} />
    </>
  ),

  // ═══════════════════════════════════════════════════
  // INFRASTRUCTURE
  // ═══════════════════════════════════════════════════

  power_plant: (c) => (
    <>
      <rect x={6} y={6} width={36} height={36} rx={4} fill={c.bodyDark} stroke={INK} strokeWidth={1.2} />
      <path d="M14,34 L18,10 L30,10 L34,34 Z" fill={c.body} stroke={STEEL} strokeWidth={1} />
      <circle className="b-rise b-d0" cx={20} cy={8} r={2} fill="#fff" opacity={0.15} />
      <circle className="b-rise b-d1" cx={24} cy={6} r={2.5} fill="#fff" opacity={0.12} />
      <circle className="b-rise b-d2" cx={28} cy={8} r={2} fill="#fff" opacity={0.15} />
      <rect x={14} y={26} width={20} height={8} rx={2} fill={c.bodyDark} stroke={STEEL} strokeWidth={0.8} />
      <g className="b-spin" style={{ ...spinC, animationDuration: '2s' }} stroke={c.accent} strokeWidth={0.6} opacity={0.5}>
        <line x1={18} y1={30} x2={30} y2={30} />
        <line x1={24} y1={26} x2={24} y2={34} />
      </g>
      <line x1={24} y1={34} x2={24} y2={38} stroke={POWER} strokeWidth={2} />
      <circle className="b-pulse" cx={24} cy={38} r={2} fill={POWER} opacity={0.4} />
    </>
  ),

  fusion: (c) => (
    <>
      <rect x={5} y={5} width={38} height={38} rx={5} fill={c.bodyDark} stroke={INK} strokeWidth={1.5} />
      <circle cx={24} cy={24} r={16} fill="#0a0a15" stroke={STEEL} strokeWidth={1.5} />
      <circle className="b-pulse" cx={24} cy={24} r={10} fill={POWER_GLOW} />
      <circle className="b-pulse b-d1" cx={24} cy={24} r={7} fill="#ffd27a" opacity={0.4} />
      <circle className="b-pulse b-d2" cx={24} cy={24} r={4} fill="#ff8a4a" opacity={0.5} />
      <circle cx={24} cy={24} r={2} fill="#fff" opacity={0.8} />
      <g className="b-spin" style={{ ...spinC, animationDuration: '4s' }} stroke={PURPLE} strokeWidth={0.8} opacity={0.3}>
        <path d="M14,24 Q19,14 24,24 Q29,34 34,24" fill="none" />
        <path d="M14,24 Q19,34 24,24 Q29,14 34,24" fill="none" />
      </g>
      <circle className="b-pulse b-d0" cx={10} cy={10} r={2} fill={POWER} opacity={0.2} />
      <circle className="b-pulse b-d1" cx={38} cy={10} r={2} fill={POWER} opacity={0.2} />
      <circle className="b-pulse b-d2" cx={10} cy={38} r={2} fill={POWER} opacity={0.2} />
      <circle className="b-pulse b-d3" cx={38} cy={38} r={2} fill={POWER} opacity={0.2} />
    </>
  ),

  // ═══════════════════════════════════════════════════
  // SPECIAL
  // ═══════════════════════════════════════════════════

  monument: (c) => (
    <>
      <rect x={6} y={6} width={36} height={36} rx={4} fill={c.bodyDark} stroke={INK} strokeWidth={1.2} />
      <rect x={14} y={28} width={20} height={8} rx={2} fill={c.body} stroke={STEEL} strokeWidth={0.8} />
      <polygon points="18,28 30,28 26,8 22,8" fill={c.bodyLight} stroke={STEEL} strokeWidth={0.8} />
      <polygon points="21,8 27,8 24,4" fill={c.accent} stroke={STEEL} strokeWidth={0.6} />
      <circle className="b-pulse" cx={24} cy={14} r={2} fill={c.accent} opacity={0.3} />
      <circle className="b-pulse b-d1" cx={24} cy={14} r={1} fill={c.accent} />
      <circle cx={24} cy={32} r={6} fill="none" stroke={c.accent} strokeWidth={0.5} opacity={0.2} className="b-spin" style={spinC} />
    </>
  ),

  temple: (c) => (
    <>
      <rect x={6} y={6} width={36} height={36} rx={4} fill={c.bodyDark} stroke={INK} strokeWidth={1.2} />
      <rect x={10} y={20} width={28} height={16} rx={2} fill={c.body} stroke={STEEL} strokeWidth={0.8} />
      {[0, 1, 2, 3].map(i => (
        <rect key={`tc-${i}`} x={13 + i * 7} y={10} width={2.5} height={12} rx={1}
          fill={c.bodyLight} stroke={STEEL} strokeWidth={0.4} />
      ))}
      <polygon points="8,10 24,4 40,10" fill={c.bodyLight} stroke={STEEL} strokeWidth={0.8} />
      <g transform="translate(24, 16)" stroke={c.accent} strokeWidth={0.8} fill="none" opacity={0.6}>
        <circle cx={0} cy={0} r={3} />
        <path d="M-3,0 L3,0 M0,-3 L0,3" />
      </g>
      <circle className="b-pulse b-d0" cx={16} cy={32} r={1.5} fill={c.accent} opacity={0.3} />
      <circle className="b-pulse b-d2" cx={32} cy={32} r={1.5} fill={c.accent} opacity={0.3} />
      <rect x={22} y={30} width={4} height={6} rx={1} fill="#0a1520" stroke={STEEL} strokeWidth={0.4} />
    </>
  ),
}

// ── Hauptkomponente ──

export function BuildingSVG({
  entityId,
  planet = 'moon' as string,
  status = 'active',
  condition = 100,
  occupancy = 0,
  owned = false,
  size = 44,
}: BuildingSVGProps) {
  const c = pal(planet)
  const sprite = SPRITES[entityId]
  const broken = status !== 'active' || condition < 40
  const dim = broken ? 0.4 : condition < 100 ? 0.5 + (condition / 100) * 0.5 : 1

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 48 48" 
      style={{ 
        display: 'block', 
        overflow: 'visible',
        filter: broken ? 'grayscale(0.3)' : 'none'
      }}
    >
      {/* Besitz-Rahmen */}
      {owned && (
        <rect 
          x={2} 
          y={2} 
          width={44} 
          height={44} 
          rx={5} 
          fill="none" 
          stroke={c.accent} 
          strokeWidth={2} 
          opacity={0.8}
          className="b-glow"
        />
      )}
      
      {/* Gebäude-Sprite */}
      <g className={broken ? 'b-paused' : undefined} opacity={dim}>
        {sprite
          ? sprite(c, occupancy)
          : (
            <rect 
              x={10} 
              y={10} 
              width={28} 
              height={28} 
              rx={4} 
              fill={c.body} 
              stroke={INK} 
              strokeWidth={1.2}
            />
          )
        }
      </g>
      
      {/* Schadens-Indikator */}
      {broken && (
        <g>
          {/* Warn-Dreieck */}
          <polygon points="38,6 44,18 32,18" fill="#d8402e" stroke="#fff" strokeWidth={1} />
          <polygon points="39.2,8.5 42.8,15.5 35.6,15.5" fill="#d8402e" />
          
          {/* Ausrufezeichen */}
          <rect x={39.2} y={10.5} width={1.6} height={3.6} fill="#fff" />
          <rect x={39.2} y={14.6} width={1.6} height={1.4} fill="#fff" />
          
          {/* Schadensblitze */}
          <g opacity={0.3} className="b-pulse">
            <line x1={8} y1={6} x2={12} y2={12} stroke="#d8402e" strokeWidth={2} />
            <line x1={40} y1={42} x2={36} y2={36} stroke="#d8402e" strokeWidth={2} />
          </g>
        </g>
      )}
      
      {/* Zustands-LED */}
      {status === 'active' && condition >= 80 && (
        <circle cx={4} cy={4} r={2} fill={GREEN} className="b-pulse" />
      )}
      {status === 'active' && condition >= 40 && condition < 80 && (
        <circle cx={4} cy={4} r={2} fill={c.accent} className="b-pulse" />
      )}
      {broken && (
        <circle cx={4} cy={4} r={2} fill="#d8402e" className="b-pulse" />
      )}
    </svg>
  )
}

// ── Styles ──

export function BuildingSpriteStyles() {
  return (
    <style>{`
      /* Rotation */
      .b-spin {
        transform-box: fill-box;
        transform-origin: center;
        animation: b-spin 9s linear infinite;
      }
      .b-spin-r {
        transform-box: fill-box;
        transform-origin: center;
        animation: b-spin 9s linear infinite reverse;
      }
      .b-fast {
        animation-duration: 3s;
      }
      @keyframes b-spin {
        to { transform: rotate(360deg); }
      }
      
      /* Pulsation */
      .b-pulse {
        animation: b-pulse 2.4s ease-in-out infinite;
      }
      .b-d0 { animation-delay: 0s; }
      .b-d1 { animation-delay: 0.6s; }
      .b-d2 { animation-delay: 1.2s; }
      .b-d3 { animation-delay: 1.8s; }
      @keyframes b-pulse {
        0%, 100% { opacity: 0.25; }
        50% { opacity: 0.9; }
      }
      
      /* Glint / Reflexion */
      .b-glint {
        animation: b-glint 5s ease-in-out infinite;
      }
      @keyframes b-glint {
        0%, 72%, 100% { opacity: 0; }
        78% { opacity: 0.4; }
        80% { opacity: 0.1; }
      }
      
      /* Aufsteigende Partikel */
      .b-rise {
        animation: b-rise 2.2s ease-in infinite;
      }
      @keyframes b-rise {
        0% { transform: translateY(0); opacity: 0; }
        20% { opacity: 0.8; }
        100% { transform: translateY(-16px); opacity: 0; }
      }
      
      /* Glow-Effekt für Besitz-Rahmen */
      .b-glow {
        animation: b-glow 2s ease-in-out infinite alternate;
      }
      @keyframes b-glow {
        0% { filter: drop-shadow(0 0 2px rgba(255,215,0,0.1)); }
        100% { filter: drop-shadow(0 0 8px rgba(255,215,0,0.3)); }
      }
      
      /* Pause bei Schaden */
      .b-paused * {
        animation-play-state: paused !important;
      }
    `}</style>
  )
}
