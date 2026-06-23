// lib/grid/TileSVG.tsx
// Erstellt: 31.05.2026
// Aktualisiert: 23.06.2026 – einfache Earth-Terrain-Tiles
// SVG-Kacheln für das ColonyGrid – Mond, Mars, Phobos, Erde

import { roadSides } from './generateGrid'

interface TileColors {
  base:         string
  dark:         string
  darker:       string
  building:     string
  buildingDark: string
  accent:       string
  road:         string
  roadLight:    string
}

const COLORS: Record<string, TileColors> = {
  earth: {
    base:         '#8fbf7a',
    dark:         '#5f8f57',
    darker:       '#3f6f3f',
    building:     '#5f83a6',
    buildingDark: '#3d5e7d',
    accent:       '#d7b45a',
    road:         '#767b7e',
    roadLight:    '#b7c0c5',
  },
  moon: {
    base:         '#b8b0a0',
    dark:         '#a09888',
    darker:       '#908878',
    building:     '#4a7ba3',
    buildingDark: '#3a6a8a',
    accent:       '#f5d742',
    road:         '#888078',
    roadLight:    '#a09888',
  },
  mars: {
    base:         '#c8603a',
    dark:         '#b84828',
    darker:       '#a83818',
    building:     '#5a8ab3',
    buildingDark: '#4a7aa3',
    accent:       '#f5d742',
    road:         '#7a4020',
    roadLight:    '#9a6040',
  },
  phobos: {
    base:         '#6a7280',
    dark:         '#5a6270',
    darker:       '#4a5260',
    building:     '#5a8ab3',
    buildingDark: '#4a7aa3',
    accent:       '#f5d742',
    road:         '#4a5260',
    roadLight:    '#5a6270',
  },
}

function Surface({ c }: { c: TileColors }) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      <rect width="48" height="48" fill={c.base}/>
      <circle cx="12" cy="12" r="3" fill={c.dark} opacity="0.3"/>
      <circle cx="36" cy="36" r="4" fill={c.dark} opacity="0.2"/>
      <circle cx="24" cy="18" r="2" fill={c.darker} opacity="0.25"/>
    </svg>
  )
}

function Grass() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      <rect width="48" height="48" fill="#8fbd73"/>
      <circle cx="9" cy="12" r="2" fill="#6f9f5b" opacity="0.45"/>
      <circle cx="30" cy="18" r="2" fill="#6f9f5b" opacity="0.35"/>
      <circle cx="39" cy="37" r="3" fill="#6f9f5b" opacity="0.35"/>
    </svg>
  )
}

function Forest() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      <rect width="48" height="48" fill="#7fb66b"/>
      <circle cx="12" cy="20" r="9" fill="#356f3c"/>
      <circle cx="25" cy="17" r="10" fill="#2f6536"/>
      <circle cx="37" cy="25" r="9" fill="#3a7440"/>
      <circle cx="18" cy="35" r="7" fill="#315f36"/>
      <rect x="23" y="22" width="3" height="12" fill="#5b4937" opacity="0.75"/>
    </svg>
  )
}

function River() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      <rect width="48" height="48" fill="#87b875"/>
      <path d="M18 0 C10 10 28 16 20 26 C14 34 26 40 20 48 L34 48 C42 38 29 32 36 21 C42 12 25 6 32 0 Z" fill="#5da9c8"/>
      <path d="M25 0 C18 8 34 13 27 23 C22 31 32 36 27 48" fill="none" stroke="#b9e2ed" strokeWidth="2" opacity="0.55"/>
    </svg>
  )
}

function Urban() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      <rect width="48" height="48" fill="#a8aaa0"/>
      <rect x="0" y="22" width="48" height="5" fill="#7d8384" opacity="0.65"/>
      <rect x="22" y="0" width="5" height="48" fill="#7d8384" opacity="0.65"/>
      <rect x="8" y="9" width="12" height="9" fill="#8b9188" rx="1"/>
      <rect x="29" y="30" width="12" height="9" fill="#8b9188" rx="1"/>
    </svg>
  )
}

function Crater({ c }: { c: TileColors }) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      <rect width="48" height="48" fill={c.base}/>
      <ellipse cx="24" cy="24" rx="16" ry="8" fill={c.dark}/>
      <ellipse cx="24" cy="24" rx="10" ry="5" fill={c.darker} opacity="0.5"/>
      <ellipse cx="20" cy="22" rx="3" ry="2" fill={c.base} opacity="0.4"/>
    </svg>
  )
}

function Mountain({ c }: { c: TileColors }) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      <rect width="48" height="48" fill={c.base}/>
      <polygon points="24,8 14,32 34,32" fill={c.dark}/>
      <polygon points="24,8 18,32 30,32" fill={c.darker} opacity="0.5"/>
      <polygon points="24,16 20,32 28,32" fill={c.base} opacity="0.3"/>
    </svg>
  )
}

function MetalVein({ c }: { c: TileColors }) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      <rect width="48" height="48" fill={c.base}/>
      <polygon points="10,10 20,15 15,25 5,20" fill={c.accent} opacity="0.6"/>
      <polygon points="30,30 40,35 35,45 25,40" fill={c.accent} opacity="0.6"/>
      <rect x="22" y="22" width="4" height="4" fill={c.accent} opacity="0.8"/>
    </svg>
  )
}

function Shaft({ c }: { c: TileColors }) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      <rect width="48" height="48" fill={c.base}/>
      <rect x="16" y="16" width="16" height="16" fill={c.darker} rx="2"/>
      <rect x="20" y="20" width="8" height="8" fill={c.dark}/>
      <line x1="24" y1="8" x2="24" y2="16" stroke={c.darker} strokeWidth="2"/>
      <line x1="24" y1="32" x2="24" y2="40" stroke={c.darker} strokeWidth="2"/>
    </svg>
  )
}

function Canyon({ c }: { c: TileColors }) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      <rect width="48" height="48" fill={c.base}/>
      <rect x="0" y="18" width="48" height="12" fill={c.darker}/>
      <rect x="0" y="20" width="48" height="8" fill={c.dark}/>
    </svg>
  )
}

function Road({ c, type }: { c: TileColors; type: string }) {
  const { n, o, s, w } = roadSides(type)
  const W = 10
  const half = 24
  const lw = 5
  const isolated = !n && !o && !s && !w
  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      <rect width="48" height="48" fill={c.base}/>
      <rect x={half - W/2} y={half - W/2} width={W} height={W} fill={c.road}/>
      {n && <rect x={half - W/2} y={0} width={W} height={half} fill={c.road}/>} 
      {s && <rect x={half - W/2} y={half} width={W} height={half} fill={c.road}/>} 
      {w && <rect x={0} y={half - W/2} width={half} height={W} fill={c.road}/>} 
      {o && <rect x={half} y={half - W/2} width={half} height={W} fill={c.road}/>} 
      {n && <rect x={half - lw/2} y={0} width={lw} height={half} fill={c.roadLight}/>} 
      {s && <rect x={half - lw/2} y={half} width={lw} height={half} fill={c.roadLight}/>} 
      {w && <rect x={0} y={half - lw/2} width={half} height={lw} fill={c.roadLight}/>} 
      {o && <rect x={half} y={half - lw/2} width={half} height={lw} fill={c.roadLight}/>} 
      {isolated && <rect x={half - W/2} y={half - W/2} width={W} height={W} fill={c.road}/>} 
    </svg>
  )
}

function Habitat({ c }: { c: TileColors }) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      <rect width="48" height="48" fill={c.building}/>
      <rect x="12" y="18" width="24" height="24" fill={c.buildingDark} rx="3"/>
      <rect x="16" y="26" width="8" height="16" fill={c.darker}/>
      <rect x="28" y="26" width="8" height="16" fill={c.darker}/>
      <rect x="20" y="30" width="4" height="12" fill={c.roadLight}/>
      <polygon points="12,18 24,8 36,18" fill={c.accent}/>
    </svg>
  )
}

function Solar({ c }: { c: TileColors }) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      <rect width="48" height="48" fill={c.building}/>
      <rect x="18" y="12" width="12" height="24" fill={c.darker}/>
      <rect x="8" y="20" width="32" height="6" fill={c.accent} rx="1"/>
      <rect x="10" y="28" width="28" height="4" fill={c.accent} rx="1"/>
      <rect x="12" y="36" width="24" height="4" fill={c.accent} rx="1"/>
    </svg>
  )
}

function Mine({ c }: { c: TileColors }) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      <rect width="48" height="48" fill={c.building}/>
      <rect x="14" y="20" width="20" height="20" fill={c.darker} rx="2"/>
      <rect x="18" y="24" width="12" height="12" fill={c.dark} rx="1"/>
      <rect x="22" y="16" width="4" height="8" fill={c.accent}/>
      <circle cx="24" cy="28" r="3" fill={c.base}/>
    </svg>
  )
}

function Shipyard({ c }: { c: TileColors }) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      <rect width="48" height="48" fill={c.building}/>
      <rect x="8" y="8" width="32" height="32" fill={c.buildingDark} rx="4"/>
      <circle cx="24" cy="24" r="10" fill={c.dark}/>
      <circle cx="24" cy="24" r="5" fill={c.accent}/>
      <rect x="22" y="8" width="4" height="8" fill={c.darker}/>
      <rect x="22" y="32" width="4" height="8" fill={c.darker}/>
      <rect x="8" y="36" width="32" height="4" fill={c.road}/>
    </svg>
  )
}

function Construction({ c }: { c: TileColors }) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      <rect width="48" height="48" fill={c.base}/>
      <rect x="0" y="0" width="6" height="48" fill={c.accent} opacity="0.5"/>
      <rect x="12" y="0" width="6" height="48" fill={c.accent} opacity="0.5"/>
      <rect x="24" y="0" width="6" height="48" fill={c.accent} opacity="0.5"/>
      <rect x="36" y="0" width="6" height="48" fill={c.accent} opacity="0.5"/>
      <rect x="22" y="10" width="4" height="28" fill={c.darker} opacity="0.7"/>
      <rect x="14" y="10" width="20" height="4" fill={c.darker} opacity="0.7"/>
      <circle cx="22" cy="10" r="2" fill={c.accent}/>
    </svg>
  )
}

export function TileSVG({ type, planet }: { type: string; planet: string }) {
  const c = COLORS[planet] ?? COLORS.moon

  if (type.startsWith('road')) {
    if (type === 'road' || type === 'road_cross') return <Road c={c} type="road_15" />
    if (type === 'road_h') return <Road c={c} type="road_10" />
    if (type === 'road_v') return <Road c={c} type="road_5" />
    return <Road c={c} type={type} />
  }

  switch (type) {
    case 'tile_grass':            return <Grass/>
    case 'tile_forest':           return <Forest/>
    case 'tile_river':            return <River/>
    case 'tile_urban':            return <Urban/>
    case 'tile_surface':          return <Surface c={c}/>
    case 'tile_crater':           return <Crater c={c}/>
    case 'tile_mountain':         return <Mountain c={c}/>
    case 'tile_metal':            return <MetalVein c={c}/>
    case 'tile_canyon':           return <Canyon c={c}/>
    case 'tile_shaft':            return <Shaft c={c}/>
    case 'building_habitat':      return <Habitat c={c}/>
    case 'building_solar':        return <Solar c={c}/>
    case 'building_mine':         return <Mine c={c}/>
    case 'building_shipyard':     return <Shipyard c={c}/>
    case 'building_construction': return <Construction c={c}/>
    default:                      return <Surface c={c}/>
  }
}