// lib/grid/TileSVG.tsx
// Erstellt: 31.05.2026
// Aktualisiert: 24.06.2026 – spezialisierte Tile-Sets für Erde, Mond und Mars
// SVG-Kacheln für das ColonyGrid – Mond, Mars, Phobos, Erde

import { roadSides, riverSides } from './generateGrid'

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
  earth:  { base:'#8fbf7a', dark:'#5f8f57', darker:'#3f6f3f', building:'#5f83a6', buildingDark:'#3d5e7d', accent:'#d7b45a', road:'#6f7478', roadLight:'#c7d0d5' },
  moon:   { base:'#b8b0a0', dark:'#a09888', darker:'#78766f', building:'#4a7ba3', buildingDark:'#3a6a8a', accent:'#f5d742', road:'#888078', roadLight:'#a09888' },
  mars:   { base:'#c8603a', dark:'#b84828', darker:'#7d2f1d', building:'#5a8ab3', buildingDark:'#4a7aa3', accent:'#f5d742', road:'#7a4020', roadLight:'#9a6040' },
  phobos: { base:'#6a7280', dark:'#5a6270', darker:'#4a5260', building:'#5a8ab3', buildingDark:'#4a7aa3', accent:'#f5d742', road:'#4a5260', roadLight:'#5a6270' },
}

function Surface({ c }: { c: TileColors }) {
  return <svg width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill={c.base}/><circle cx="12" cy="12" r="3" fill={c.dark} opacity="0.3"/><circle cx="36" cy="36" r="4" fill={c.dark} opacity="0.2"/><circle cx="24" cy="18" r="2" fill={c.darker} opacity="0.25"/></svg>
}

function Grass() {
  return <svg width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill="#8fbd73"/><circle cx="9" cy="12" r="2" fill="#6f9f5b" opacity="0.45"/><circle cx="30" cy="18" r="2" fill="#6f9f5b" opacity="0.35"/><circle cx="39" cy="37" r="3" fill="#6f9f5b" opacity="0.35"/></svg>
}

function Forest({ dense = false }: { dense?: boolean }) {
  return <svg width="48" height="48" viewBox="0 0 48 48">
    <rect width="48" height="48" fill={dense ? '#649f55' : '#7fb66b'}/>
    <circle cx="10" cy="19" r={dense ? 10 : 8} fill="#356f3c"/>
    <circle cx="24" cy="17" r={dense ? 11 : 9} fill="#2f6536"/>
    <circle cx="38" cy="25" r={dense ? 10 : 8} fill="#3a7440"/>
    <circle cx="18" cy="36" r={dense ? 9 : 6} fill="#315f36"/>
    {dense && <circle cx="35" cy="38" r="8" fill="#28592e"/>}
    <rect x="23" y="22" width="3" height="12" fill="#5b4937" opacity="0.7"/>
  </svg>
}

function Farmland() {
  return <svg width="48" height="48" viewBox="0 0 48 48">
    <rect width="48" height="48" fill="#9fbd67"/>
    {[7,15,23,31,39].map(x => <path key={x} d={`M${x} 0 C${x-5} 14 ${x+5} 28 ${x} 48`} stroke="#d8c26b" strokeWidth="3" opacity="0.75" fill="none"/>)}
    <path d="M0 35 H48" stroke="#7c9d55" strokeWidth="2" opacity="0.45"/>
  </svg>
}

function City() {
  return <svg width="48" height="48" viewBox="0 0 48 48">
    <rect width="48" height="48" fill="#9fa6a1"/>
    <rect x="0" y="22" width="48" height="5" fill="#737a7c" opacity="0.8"/>
    <rect x="22" y="0" width="5" height="48" fill="#737a7c" opacity="0.8"/>
    <rect x="7" y="8" width="11" height="11" fill="#6f7f86" rx="1"/>
    <rect x="30" y="7" width="10" height="14" fill="#687780" rx="1"/>
    <rect x="9" y="31" width="12" height="9" fill="#79897f" rx="1"/>
    <rect x="30" y="30" width="11" height="11" fill="#6f7f86" rx="1"/>
  </svg>
}

function Spaceport() {
  return <svg width="48" height="48" viewBox="0 0 48 48">
    <rect width="48" height="48" fill="#8f9b95"/>
    <circle cx="24" cy="24" r="17" fill="#656f73"/>
    <circle cx="24" cy="24" r="10" fill="#9da8ad"/>
    <path d="M24 8 L29 25 L24 22 L19 25 Z" fill="#e8edf0"/>
    <rect x="21" y="28" width="6" height="9" fill="#e8edf0"/>
  </svg>
}

function River({ type }: { type: string }) {
  const { n, o, s, w } = riverSides(type)
  const isolated = !n && !o && !s && !w
  const W = 15
  const half = 24
  return <svg width="48" height="48" viewBox="0 0 48 48">
    <rect width="48" height="48" fill="#86b875"/>
    <rect x={half - W/2} y={half - W/2} width={W} height={W} fill="#4d9fc0"/>
    {(n || isolated) && <rect x={half - W/2} y="0" width={W} height={half} fill="#4d9fc0"/>}
    {(s || isolated) && <rect x={half - W/2} y={half} width={W} height={half} fill="#4d9fc0"/>}
    {w && <rect x="0" y={half - W/2} width={half} height={W} fill="#4d9fc0"/>}
    {o && <rect x={half} y={half - W/2} width={half} height={W} fill="#4d9fc0"/>}
    <circle cx="24" cy="24" r="7.5" fill="#5da9c8"/>
    <path d="M20 0 L20 48" stroke="#b9e2ed" strokeWidth="2" opacity="0.35"/>
    {(w || o) && <path d="M0 20 L48 20" stroke="#b9e2ed" strokeWidth="2" opacity="0.25"/>}
  </svg>
}

function Urban() {
  return <City/>
}

function Crater({ c }: { c: TileColors }) {
  return <svg width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill={c.base}/><ellipse cx="24" cy="24" rx="16" ry="8" fill={c.dark}/><ellipse cx="24" cy="24" rx="10" ry="5" fill={c.darker} opacity="0.5"/><ellipse cx="20" cy="22" rx="3" ry="2" fill={c.base} opacity="0.4"/></svg>
}

function Mountain({ c }: { c: TileColors }) {
  return <svg width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill={c.base}/><polygon points="24,8 14,32 34,32" fill={c.dark}/><polygon points="24,8 18,32 30,32" fill={c.darker} opacity="0.5"/><polygon points="24,16 20,32 28,32" fill={c.base} opacity="0.3"/></svg>
}

function MetalVein({ c }: { c: TileColors }) {
  return <svg width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill={c.base}/><polygon points="10,10 20,15 15,25 5,20" fill={c.accent} opacity="0.6"/><polygon points="30,30 40,35 35,45 25,40" fill={c.accent} opacity="0.6"/><rect x="22" y="22" width="4" height="4" fill={c.accent} opacity="0.8"/></svg>
}

function Shaft({ c }: { c: TileColors }) {
  return <svg width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill={c.base}/><rect x="16" y="16" width="16" height="16" fill={c.darker} rx="2"/><rect x="20" y="20" width="8" height="8" fill={c.dark}/><line x1="24" y1="8" x2="24" y2="16" stroke={c.darker} strokeWidth="2"/><line x1="24" y1="32" x2="24" y2="40" stroke={c.darker} strokeWidth="2"/></svg>
}

function Canyon({ c }: { c: TileColors }) {
  return <svg width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill={c.base}/><rect x="0" y="16" width="48" height="16" fill={c.darker}/><path d="M0 20 H48" stroke={c.dark} strokeWidth="4" opacity="0.65"/><path d="M0 29 H48" stroke="#3b160f" strokeWidth="2" opacity="0.55"/></svg>
}

function Mare() {
  return <svg width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill="#77766f"/><circle cx="12" cy="14" r="2" fill="#5f5e59" opacity="0.35"/><circle cx="34" cy="30" r="3" fill="#5f5e59" opacity="0.28"/><path d="M0 34 C12 29 24 37 48 31" stroke="#8f8e86" strokeWidth="3" opacity="0.35" fill="none"/></svg>
}

function Highland() {
  return <svg width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill="#c4beb0"/><polygon points="8,35 18,15 29,35" fill="#a9a294" opacity="0.8"/><polygon points="23,37 33,12 43,37" fill="#9f988a" opacity="0.75"/><circle cx="15" cy="11" r="2" fill="#8f887c" opacity="0.35"/></svg>
}

function Research() {
  return <svg width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill="#b7b2a8"/><circle cx="24" cy="25" r="13" fill="#dce8ef"/><rect x="11" y="25" width="26" height="12" fill="#8c9aa2"/><path d="M24 12 L34 4" stroke="#eef7fb" strokeWidth="3"/><circle cx="35" cy="4" r="3" fill="#eef7fb"/></svg>
}

function IceField() {
  return <svg width="48" height="48" viewBox="0 0 48 48">
    <rect width="48" height="48" fill="#bfc8c9"/>
    <path d="M0 16 C12 12 22 18 34 12 C40 9 44 10 48 12" stroke="#d9f0f4" strokeWidth="5" opacity="0.55" fill="none"/>
    <path d="M0 34 C14 28 25 38 48 30" stroke="#8fc3d8" strokeWidth="4" opacity="0.45" fill="none"/>
    <polygon points="17,12 22,22 15,21" fill="#e7fbff" opacity="0.75"/>
    <polygon points="31,26 37,37 28,35" fill="#e7fbff" opacity="0.6"/>
    <circle cx="10" cy="38" r="2" fill="#6fa8bd" opacity="0.35"/>
  </svg>
}

function HeliumField() {
  return <svg width="48" height="48" viewBox="0 0 48 48">
    <rect width="48" height="48" fill="#b8b0a0"/>
    <ellipse cx="24" cy="25" rx="17" ry="9" fill="#9b9384" opacity="0.8"/>
    <circle cx="16" cy="23" r="2" fill="#f5d742" opacity="0.75"/>
    <circle cx="25" cy="27" r="2.5" fill="#f5d742" opacity="0.65"/>
    <circle cx="34" cy="22" r="1.8" fill="#f5d742" opacity="0.55"/>
    <path d="M12 34 C22 30 32 36 42 31" stroke="#d5c273" strokeWidth="2" opacity="0.45" fill="none"/>
  </svg>
}

function TitaniumField() {
  return <svg width="48" height="48" viewBox="0 0 48 48">
    <rect width="48" height="48" fill="#aaa69d"/>
    <path d="M4 34 L17 19 L27 25 L42 10" stroke="#59636b" strokeWidth="5" opacity="0.65" fill="none"/>
    <path d="M8 39 L20 25 L31 30 L45 17" stroke="#d0d3d2" strokeWidth="2" opacity="0.5" fill="none"/>
    <circle cx="14" cy="24" r="2" fill="#40484f" opacity="0.6"/>
    <circle cx="35" cy="18" r="2" fill="#40484f" opacity="0.55"/>
  </svg>
}

function Dust() {
  return <svg width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill="#c8603a"/><path d="M0 15 C14 10 30 21 48 14" stroke="#dc7a4e" strokeWidth="4" opacity="0.45" fill="none"/><path d="M0 34 C16 28 28 38 48 32" stroke="#9f3f24" strokeWidth="3" opacity="0.35" fill="none"/></svg>
}

function Plateau() {
  return <svg width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill="#b84e30"/><rect x="5" y="10" width="38" height="20" rx="2" fill="#8f3922"/><path d="M7 31 H42" stroke="#d07a50" strokeWidth="4" opacity="0.35"/><circle cx="16" cy="17" r="2" fill="#5e2418" opacity="0.45"/></svg>
}

function MarsHabitat() {
  return <svg width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill="#bd5735"/><circle cx="24" cy="24" r="14" fill="#d9e2e6"/><rect x="10" y="24" width="28" height="10" fill="#70828b"/><rect x="20" y="17" width="8" height="17" fill="#9fb3bc" opacity="0.8"/></svg>
}

function Industry() {
  return <svg width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill="#b94c2b"/><rect x="8" y="23" width="31" height="14" fill="#5f6670"/><rect x="12" y="14" width="6" height="23" fill="#434950"/><rect x="28" y="10" width="6" height="27" fill="#434950"/><circle cx="31" cy="8" r="4" fill="#d5b15a" opacity="0.45"/></svg>
}

function Road({ c, type }: { c: TileColors; type: string }) {
  const { n, o, s, w } = roadSides(type)
  const W = 13
  const half = 24
  const lw = 3
  const isolated = !n && !o && !s && !w
  return <svg width="48" height="48" viewBox="0 0 48 48">
    <rect width="48" height="48" fill={c.base}/>
    <rect x={half - W/2} y={half - W/2} width={W} height={W} fill={c.road}/>
    {(n || isolated) && <rect x={half - W/2} y="0" width={W} height={half} fill={c.road}/>} 
    {(s || isolated) && <rect x={half - W/2} y={half} width={W} height={half} fill={c.road}/>} 
    {w && <rect x="0" y={half - W/2} width={half} height={W} fill={c.road}/>} 
    {o && <rect x={half} y={half - W/2} width={half} height={W} fill={c.road}/>} 
    {(n || isolated) && <rect x={half - lw/2} y="0" width={lw} height={half} fill={c.roadLight}/>} 
    {(s || isolated) && <rect x={half - lw/2} y={half} width={lw} height={half} fill={c.roadLight}/>} 
    {w && <rect x="0" y={half - lw/2} width={half} height={lw} fill={c.roadLight}/>} 
    {o && <rect x={half} y={half - lw/2} width={half} height={lw} fill={c.roadLight}/>} 
  </svg>
}

function Habitat({ c }: { c: TileColors }) {
  return <svg width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill={c.building}/><rect x="12" y="18" width="24" height="24" fill={c.buildingDark} rx="3"/><rect x="16" y="26" width="8" height="16" fill={c.darker}/><rect x="28" y="26" width="8" height="16" fill={c.darker}/><rect x="20" y="30" width="4" height="12" fill={c.roadLight}/><polygon points="12,18 24,8 36,18" fill={c.accent}/></svg>
}

function Solar({ c }: { c: TileColors }) {
  return <svg width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill={c.building}/><rect x="18" y="12" width="12" height="24" fill={c.darker}/><rect x="8" y="20" width="32" height="6" fill={c.accent} rx="1"/><rect x="10" y="28" width="28" height="4" fill={c.accent} rx="1"/><rect x="12" y="36" width="24" height="4" fill={c.accent} rx="1"/></svg>
}

function Mine({ c }: { c: TileColors }) {
  return <svg width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill={c.building}/><rect x="14" y="20" width="20" height="20" fill={c.darker} rx="2"/><rect x="18" y="24" width="12" height="12" fill={c.dark} rx="1"/><rect x="22" y="16" width="4" height="8" fill={c.accent}/><circle cx="24" cy="28" r="3" fill={c.base}/></svg>
}

function Shipyard({ c }: { c: TileColors }) {
  return <svg width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill={c.building}/><rect x="8" y="8" width="32" height="32" fill={c.buildingDark} rx="4"/><circle cx="24" cy="24" r="10" fill={c.dark}/><circle cx="24" cy="24" r="5" fill={c.accent}/><rect x="22" y="8" width="4" height="8" fill={c.darker}/><rect x="22" y="32" width="4" height="8" fill={c.darker}/><rect x="8" y="36" width="32" height="4" fill={c.road}/></svg>
}

function Construction({ c }: { c: TileColors }) {
  return <svg width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill={c.base}/><rect x="0" y="0" width="6" height="48" fill={c.accent} opacity="0.5"/><rect x="12" y="0" width="6" height="48" fill={c.accent} opacity="0.5"/><rect x="24" y="0" width="6" height="48" fill={c.accent} opacity="0.5"/><rect x="36" y="0" width="6" height="48" fill={c.accent} opacity="0.5"/><rect x="22" y="10" width="4" height="28" fill={c.darker} opacity="0.7"/><rect x="14" y="10" width="20" height="4" fill={c.darker} opacity="0.7"/><circle cx="22" cy="10" r="2" fill={c.accent}/></svg>
}

export function TileSVG({ type, planet }: { type: string; planet: string }) {
  const c = COLORS[planet] ?? COLORS.moon

  if (type.startsWith('road')) {
    if (type === 'road' || type === 'road_cross') return <Road c={c} type="road_15" />
    if (type === 'road_h') return <Road c={c} type="road_10" />
    if (type === 'road_v') return <Road c={c} type="road_5" />
    return <Road c={c} type={type} />
  }
  if (type.startsWith('river_')) return <River type={type} />

  switch (type) {
    case 'tile_grass':            return <Grass/>
    case 'tile_forest':
    case 'tile_forest_edge':      return <Forest/>
    case 'tile_forest_dense':     return <Forest dense/>
    case 'tile_farmland':         return <Farmland/>
    case 'tile_city':             return <City/>
    case 'tile_spaceport':        return <Spaceport/>
    case 'tile_river':            return <River type="river_5"/>
    case 'tile_urban':            return <Urban/>
    case 'tile_surface':          return <Surface c={c}/>
    case 'tile_crater':           return <Crater c={c}/>
    case 'tile_mountain':         return <Mountain c={c}/>
    case 'tile_metal':            return <MetalVein c={c}/>
    case 'tile_canyon':           return <Canyon c={c}/>
    case 'tile_shaft':            return <Shaft c={c}/>
    case 'tile_mare':             return <Mare/>
    case 'tile_highland':         return <Highland/>
    case 'tile_research':         return <Research/>
    case 'tile_ice':              return <IceField/>
    case 'tile_helium3':          return <HeliumField/>
    case 'tile_titanium':         return <TitaniumField/>
    case 'tile_dust':             return <Dust/>
    case 'tile_plateau':          return <Plateau/>
    case 'tile_habitat':          return <MarsHabitat/>
    case 'tile_industry':         return <Industry/>
    case 'building_habitat':      return <Habitat c={c}/>
    case 'building_solar':        return <Solar c={c}/>
    case 'building_mine':         return <Mine c={c}/>
    case 'building_shipyard':     return <Shipyard c={c}/>
    case 'building_construction': return <Construction c={c}/>
    default:                      return <Surface c={c}/>
  }
}
