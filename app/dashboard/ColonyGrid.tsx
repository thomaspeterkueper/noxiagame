// app/dashboard/ColonyGrid.tsx
// Erstellt: 31.05.2026
// Zeigt ein 12×8 Kachelgrid pro Kolonie mit CSS-Verläufen und Emojis

'use client'

import { useState, useEffect } from 'react'

// ============================================================
// KONFIGURATION
// ============================================================

const COLS = 12
const ROWS = 8
const TILE_SIZE = 44  // Etwas kleiner für bessere Übersicht

// ============================================================
// FARBEN & STILE pro Kolonie (CSS-Verläufe + Schatten)
// ============================================================

const TILE_STYLES: Record<string, Record<string, string>> = {
  moon: {
    // Terrain
    tile_surface:     'linear-gradient(135deg, #b8b0a0, #a09888)',
    tile_crater:      'radial-gradient(circle at 30% 30%, #908878, #686050)',
    tile_mountain:    'linear-gradient(0deg, #908878, #b8b0a0)',
    // Gebäude mit Emoji-Overlay
    building_habitat: 'linear-gradient(135deg, #4a7ba3, #2a5b83)',
    building_solar:   'linear-gradient(135deg, #e8c832, #c8a812)',
    building_mine:    'linear-gradient(135deg, #8a5a3a, #6a3a1a)',
    building_shipyard:'linear-gradient(135deg, #5a7b9a, #3a5b7a)',
    road:             '#6a6258',
  },
  mars: {
    tile_surface:     'linear-gradient(135deg, #c8603a, #b84828)',
    tile_crater:      'radial-gradient(circle at 30% 30%, #a83818, #882808)',
    tile_canyon:      'linear-gradient(90deg, #b84828, #983818)',
    building_habitat: 'linear-gradient(135deg, #5a8ab3, #3a6a93)',
    building_solar:   'linear-gradient(135deg, #e8c832, #c8a812)',
    building_mine:    'linear-gradient(135deg, #9a6a4a, #7a4a2a)',
    road:             '#7a4020',
  },
  phobos: {
    tile_surface:     'linear-gradient(135deg, #6a7280, #5a6270)',
    tile_shaft:       'radial-gradient(circle at 30% 30%, #4a5260, #3a4250)',
    tile_metal:       'linear-gradient(135deg, #8a92a0, #7a8290)',
    building_habitat: 'linear-gradient(135deg, #5a8ab3, #3a6a93)',
    building_solar:   'linear-gradient(135deg, #e8c832, #c8a812)',
    road:             '#4a5260',
  },
}

// Emojis für Gebäude-Overlay
const BUILDING_EMOJI: Record<string, string> = {
  building_habitat: '🏠',
  building_solar:   '☀️',
  building_mine:    '⛏️',
  building_shipyard:'🚀',
  road:             '▬',
}

// Terrain-Emojis (optional)
const TERRAIN_EMOJI: Record<string, string> = {
  tile_surface:  '·',
  tile_crater:   '○',
  tile_mountain: '▲',
  tile_canyon:   '≍',
  tile_shaft:    '⬤',
  tile_metal:    '♦',
}

// Gebäudetypen-Mapping
const BUILDING_TILE: Record<string, string> = {
  mine:    'building_mine',
  solar:   'building_solar',
  habitat: 'building_habitat',
}

// ============================================================
// HILFSFUNKTIONEN
// ============================================================

// Einfacher Seed-basierter Zufallsgenerator
function seededRandom(seed: number, i: number): number {
  const x = Math.sin(seed + i) * 10000
  return x - Math.floor(x)
}

// Prüft ob eine Position flach genug für ein Gebäude ist
function isFlatTerrain(tileType: string): boolean {
  return tileType === 'tile_surface' || tileType === 'tile_metal'
}

// Generiert das Grid basierend auf Bevölkerung und Gebäuden
function generateGrid(
  slug: string,
  population: number,
  populationMax: number,
  buildings: string[],
  cols: number,
  rows: number
): { grid: string[][]; buildingPositions: [number, number][] } {
  const grid: string[][] = []
  const seed = slug.split('').reduce((a, c) => a + c.charCodeAt(0), 0)

  // 1. Terrain generieren
  for (let r = 0; r < rows; r++) {
    const row: string[] = []
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c
      const rand = seededRandom(seed, i)

      if (slug === 'moon') {
        if (rand < 0.06) row.push('tile_crater')
        else if (rand < 0.10) row.push('tile_mountain')
        else row.push('tile_surface')
      } else if (slug === 'mars') {
        if (rand < 0.08) row.push('tile_crater')
        else if (rand < 0.13) row.push('tile_canyon')
        else row.push('tile_surface')
      } else {
        if (rand < 0.10) row.push('tile_shaft')
        else if (rand < 0.15) row.push('tile_metal')
        else row.push('tile_surface')
      }
    }
    grid.push(row)
  }

  // 2. Alle flachen Positionen finden (für Gebäude)
  const flatPositions: [number, number][] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (isFlatTerrain(grid[r][c])) {
        flatPositions.push([r, c])
      }
    }
  }

  // 3. Positionen nach Entfernung zum Zentrum sortieren
  const centerR = Math.floor(rows / 2)
  const centerC = Math.floor(cols / 2)
  flatPositions.sort((a, b) => {
    const distA = Math.abs(a[0] - centerR) + Math.abs(a[1] - centerC)
    const distB = Math.abs(b[0] - centerR) + Math.abs(b[1] - centerC)
    return distA - distB
  })

  // 4. Habitate basierend auf Bevölkerung
  const habitatCount = Math.min(
    Math.floor(population / 150),
    Math.floor(flatPositions.length * 0.6)
  )
  for (let i = 0; i < habitatCount; i++) {
    const [r, c] = flatPositions[i]
    grid[r][c] = 'building_habitat'
  }

  // 5. Spieler-Gebäude platzieren
  let buildingIdx = habitatCount
  const buildingPositions: [number, number][] = []
  for (const building of buildings) {
    const tileType = BUILDING_TILE[building]
    if (!tileType) continue
    if (buildingIdx < flatPositions.length) {
      const [r, c] = flatPositions[buildingIdx]
      grid[r][c] = tileType
      buildingPositions.push([r, c])
      buildingIdx++
    }
  }

  // 6. Straßen zwischen Gebäuden (minimales Netzwerk)
  if (population > 200 && buildingPositions.length > 1) {
    // Horizontale Hauptstraße durch Zentrum
    for (let c = 0; c < cols; c++) {
      if (isFlatTerrain(grid[centerR][c]) && !grid[centerR][c].startsWith('building_')) {
        grid[centerR][c] = 'road'
      }
    }
    // Vertikale Hauptstraße
    for (let r = 0; r < rows; r++) {
      if (isFlatTerrain(grid[r][centerC]) && !grid[r][centerC].startsWith('building_')) {
        grid[r][centerC] = 'road'
      }
    }
  }

  return { grid, buildingPositions }
}

// ============================================================
// HAUPTKOMPONENTE
// ============================================================

interface ColonyGridProps {
  slug:          string
  name:          string
  population:    number
  populationMax: number
  isSupplied:    boolean
  buildings?:    string[]
}

export default function ColonyGrid({
  slug,
  name,
  population,
  populationMax,
  isSupplied,
  buildings = [],
}: ColonyGridProps) {
  const [grid, setGrid] = useState<string[][]>([])
  const [hoveredTile, setHoveredTile] = useState<{ r: number; c: number; type: string } | null>(null)

  const styles = TILE_STYLES[slug] ?? TILE_STYLES.moon
  const popPercent = Math.round((population / populationMax) * 100)

  useEffect(() => {
    const { grid: newGrid } = generateGrid(slug, population, populationMax, buildings, COLS, ROWS)
    setGrid(newGrid)
  }, [slug, population, populationMax, buildings])

  if (grid.length === 0) {
    return (
      <div style={{
        width: COLS * TILE_SIZE,
        padding: '2rem',
        textAlign: 'center',
        color: '#94a3b8',
        background: '#f4f2ed',
        borderRadius: '8px',
      }}>
        🏗️ Kolonie wird aufgebaut...
      </div>
    )
  }

  const getTileDisplay = (tileType: string): { emoji: string; tooltip: string } => {
    if (tileType.startsWith('building_')) {
      return { emoji: BUILDING_EMOJI[tileType] || '🏗️', tooltip: tileType.replace('building_', '').toUpperCase() }
    }
    if (tileType.startsWith('tile_')) {
      return { emoji: TERRAIN_EMOJI[tileType] || '·', tooltip: tileType.replace('tile_', '').toUpperCase() }
    }
    if (tileType === 'road') {
      return { emoji: '▬', tooltip: 'ROAD' }
    }
    return { emoji: '·', tooltip: tileType }
  }

  return (
    <div style={{
      background: '#1a2a3a',
      borderRadius: '12px',
      padding: '1rem',
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    }}>
      
      {/* Grid-Header mit Statistik */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: '0.75rem',
        padding: '0 0.25rem',
      }}>
        <div>
          <div style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            color: '#b99b6b',
            textTransform: 'uppercase',
            letterSpacing: '3px',
          }}>
            {name}
          </div>
          <div style={{
            fontSize: '0.55rem',
            color: '#8a9ab0',
            marginTop: '2px',
          }}>
            {slug.toUpperCase()} SECTOR
          </div>
        </div>
        
        {/* Kompakte Statistik neben dem Grid */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          background: 'rgba(0,0,0,0.3)',
          padding: '0.4rem 0.8rem',
          borderRadius: '20px',
          fontSize: '0.65rem',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#8a9ab0', fontSize: '0.5rem', letterSpacing: '1px' }}>POP</div>
            <div style={{ color: '#fff', fontWeight: 700 }}>{population.toLocaleString('de')}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#8a9ab0', fontSize: '0.5rem', letterSpacing: '1px' }}>CAP</div>
            <div style={{ color: '#fff', fontWeight: 700 }}>{popPercent}%</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#8a9ab0', fontSize: '0.5rem', letterSpacing: '1px' }}>STATUS</div>
            <div style={{ color: isSupplied ? '#6fcf97' : '#e74c3c', fontWeight: 700 }}>
              {isSupplied ? '🟢 OK' : '🔴 RISK'}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#8a9ab0', fontSize: '0.5rem', letterSpacing: '1px' }}>BUILD</div>
            <div style={{ color: '#f5d742', fontWeight: 700 }}>{buildings.length + Math.floor(population / 150)}</div>
          </div>
        </div>
      </div>

      {/* Das Kachelgrid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${COLS}, ${TILE_SIZE}px)`,
        gap: 0,
        border: '2px solid #2a4e7a',
        borderRadius: '6px',
        overflow: 'hidden',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)',
        width: `${COLS * TILE_SIZE}px`,
      }}>
        {grid.flatMap((row, r) =>
          row.map((tileType, c) => {
            const { emoji, tooltip } = getTileDisplay(tileType)
            const isBuilding = tileType.startsWith('building_')
            
            return (
              <div
                key={`${r}-${c}`}
                onMouseEnter={() => setHoveredTile({ r, c, type: tileType })}
                onMouseLeave={() => setHoveredTile(null)}
                style={{
                  width: TILE_SIZE,
                  height: TILE_SIZE,
                  background: styles[tileType] || '#4a5260',
                  backgroundSize: 'cover',
                  boxSizing: 'border-box',
                  border: '0.5px solid rgba(0,0,0,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isBuilding ? '1.2rem' : '0.7rem',
                  fontWeight: isBuilding ? 400 : 300,
                  textShadow: '0 0 2px rgba(0,0,0,0.5)',
                  transition: 'all 0.1s ease',
                  cursor: 'pointer',
                  opacity: hoveredTile?.r === r && hoveredTile?.c === c ? 0.85 : 1,
                  transform: hoveredTile?.r === r && hoveredTile?.c === c ? 'scale(0.98)' : 'scale(1)',
                }}
              >
                <span style={{
                  filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.3))',
                }}>
                  {emoji}
                </span>
              </div>
            )
          })
        )}
      </div>

      {/* Tooltip für aktuelle Kachel (folgt der Maus – vereinfacht) */}
      {hoveredTile && (
        <div style={{
          position: 'fixed',
          background: '#1a2a3a',
          color: '#fff',
          fontSize: '0.6rem',
          padding: '2px 6px',
          borderRadius: '4px',
          border: '1px solid #b99b6b',
          fontFamily: 'monospace',
          pointerEvents: 'none',
          zIndex: 100,
          top: 'auto',
          left: 'auto',
        }}>
          {hoveredTile.type.replace(/_/g, ' ').toUpperCase()}
        </div>
      )}

      {/* Bevölkerungsbalken */}
      <div style={{ marginTop: '0.6rem' }}>
        <div style={{
          background: '#0a1a2a',
          height: '4px',
          borderRadius: '3px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${popPercent}%`,
            height: '100%',
            background: isSupplied ? 'linear-gradient(90deg, #6fcf97, #27ae60)' : 'linear-gradient(90deg, #e74c3c, #c0392b)',
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>
    </div>
  )
}