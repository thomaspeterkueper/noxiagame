// app/dashboard/ColonyGrid.tsx
// Erstellt: 31.05.2026
// Kachelgrid mit Klick-Interaktion: Info-Popup + Gebäude bauen

'use client'

import { useState, useEffect } from 'react'
import { useGameStore } from '@/lib/store/gameStore'
import { BUILDABLE_ITEMS } from '@/lib/game/config'

const COLS = 12
const ROWS = 8
const TILE_SIZE = 44

// CSS-Verläufe als Platzhalter (bis echte Bilder vorhanden)
const TILE_STYLES: Record<string, Record<string, string>> = {
  moon: {
    tile_surface:      'linear-gradient(135deg, #b8b0a0, #a09888)',
    tile_crater:       'radial-gradient(circle at 30% 30%, #908878, #686050)',
    tile_mountain:     'linear-gradient(0deg, #908878, #b8b0a0)',
    building_habitat:  'linear-gradient(135deg, #4a7ba3, #2a5b83)',
    building_solar:    'linear-gradient(135deg, #e8c832, #c8a812)',
    building_mine:     'linear-gradient(135deg, #8a5a3a, #6a3a1a)',
    building_shipyard: 'linear-gradient(135deg, #5a7b9a, #3a5b7a)',
    building_construction: 'repeating-linear-gradient(45deg, #f5d742 0px, #f5d742 4px, #1a2a3a 4px, #1a2a3a 8px)',
    road:              '#6a6258',
  },
  mars: {
    tile_surface:      'linear-gradient(135deg, #c8603a, #b84828)',
    tile_crater:       'radial-gradient(circle at 30% 30%, #a83818, #882808)',
    tile_canyon:       'linear-gradient(90deg, #b84828, #983818)',
    building_habitat:  'linear-gradient(135deg, #5a8ab3, #3a6a93)',
    building_solar:    'linear-gradient(135deg, #e8c832, #c8a812)',
    building_mine:     'linear-gradient(135deg, #9a6a4a, #7a4a2a)',
    building_construction: 'repeating-linear-gradient(45deg, #f5d742 0px, #f5d742 4px, #1a2a3a 4px, #1a2a3a 8px)',
    road:              '#7a4020',
  },
  phobos: {
    tile_surface:      'linear-gradient(135deg, #6a7280, #5a6270)',
    tile_shaft:        'radial-gradient(circle at 30% 30%, #4a5260, #3a4250)',
    tile_metal:        'linear-gradient(135deg, #8a92a0, #7a8290)',
    building_habitat:  'linear-gradient(135deg, #5a8ab3, #3a6a93)',
    building_solar:    'linear-gradient(135deg, #e8c832, #c8a812)',
    building_construction: 'repeating-linear-gradient(45deg, #f5d742 0px, #f5d742 4px, #1a2a3a 4px, #1a2a3a 8px)',
    road:              '#4a5260',
  },
}

// Emojis für Kacheln
const TILE_EMOJI: Record<string, string> = {
  building_habitat:      '🏠',
  building_solar:        '☀️',
  building_mine:         '⛏️',
  building_shipyard:     '🚀',
  building_construction: '🏗️',
  tile_surface:          '·',
  tile_crater:           '○',
  tile_mountain:         '▲',
  tile_canyon:           '≍',
  tile_shaft:            '⬤',
  tile_metal:            '♦',
  road:                  '▬',
}

// Kachel-Beschreibungen für Info-Popup
const TILE_INFO: Record<string, { label: string; desc: string }> = {
  tile_surface:      { label: 'Freifläche',    desc: 'Bebaubar – klicke zum Bauen' },
  tile_crater:       { label: 'Krater',         desc: 'Nicht bebaubar' },
  tile_mountain:     { label: 'Felsformation',  desc: 'Nicht bebaubar' },
  tile_canyon:       { label: 'Canyon',          desc: 'Nicht bebaubar' },
  tile_shaft:        { label: 'Schacht',         desc: 'Nicht bebaubar' },
  tile_metal:        { label: 'Metallerz',       desc: 'Bebaubar' },
  building_habitat:  { label: 'Habitat',         desc: '+100 max. Bevölkerung' },
  building_solar:    { label: 'Solarfeld',       desc: '+4 Energie pro Tick' },
  building_mine:     { label: 'Mine',            desc: '+5 Metall pro Tick' },
  building_shipyard: { label: 'Werft',           desc: 'Schiffe kaufen und upgraden' },
  building_construction: { label: 'Im Bau',     desc: 'Gebäude wird fertiggestellt...' },
  road:              { label: 'Straße',          desc: 'Verbindet Gebäude' },
}

function isBuildable(tileType: string): boolean {
  return tileType === 'tile_surface' || tileType === 'tile_metal'
}

function seededRandom(seed: number, i: number): number {
  const x = Math.sin(seed + i) * 10000
  return x - Math.floor(x)
}

function generateGrid(
  slug: string,
  population: number,
  populationMax: number,
  buildings: { type: string; row: number; col: number; status: string }[],
  cols: number,
  rows: number
): string[][] {
  const grid: string[][] = []
  const seed = slug.split('').reduce((a, c) => a + c.charCodeAt(0), 0)

  // Terrain generieren
  for (let r = 0; r < rows; r++) {
    const row: string[] = []
    for (let c = 0; c < cols; c++) {
      const rand = seededRandom(seed, r * cols + c)
      if (slug === 'moon') {
        row.push(rand < 0.06 ? 'tile_crater' : rand < 0.10 ? 'tile_mountain' : 'tile_surface')
      } else if (slug === 'mars') {
        row.push(rand < 0.08 ? 'tile_crater' : rand < 0.13 ? 'tile_canyon' : 'tile_surface')
      } else {
        row.push(rand < 0.10 ? 'tile_shaft' : rand < 0.15 ? 'tile_metal' : 'tile_surface')
      }
    }
    grid.push(row)
  }

  // Flache Positionen für Habitate
  const flatPositions: [number, number][] = []
  const centerR = Math.floor(rows / 2)
  const centerC = Math.floor(cols / 2)
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (isBuildable(grid[r][c])) flatPositions.push([r, c])

  flatPositions.sort((a, b) =>
    (Math.abs(a[0] - centerR) + Math.abs(a[1] - centerC)) -
    (Math.abs(b[0] - centerR) + Math.abs(b[1] - centerC))
  )

  // Habitate basierend auf Bevölkerung
  const habitatCount = Math.min(Math.floor(population / 150), Math.floor(flatPositions.length * 0.5))
  const usedPositions = new Set<string>()
  for (let i = 0; i < habitatCount; i++) {
    const [r, c] = flatPositions[i]
    grid[r][c] = 'building_habitat'
    usedPositions.add(`${r},${c}`)
  }

  // Spieler-Gebäude platzieren (aus DB)
  for (const b of buildings) {
    if (b.row >= 0 && b.row < rows && b.col >= 0 && b.col < cols) {
      grid[b.row][b.col] = b.status === 'building' ? 'building_construction' : `building_${b.type}`
    }
  }

  // Straße durch Zentrum wenn Bevölkerung > 200
  if (population > 200) {
    for (let c = 0; c < cols; c++)
      if (isBuildable(grid[centerR][c])) grid[centerR][c] = 'road'
    for (let r = 0; r < rows; r++)
      if (isBuildable(grid[r][centerC])) grid[r][centerC] = 'road'
  }

  return grid
}

// Build-Popup Komponente
function BuildPopup({
  tileRow, tileCol, locationSlug, onClose, onBuildStarted
}: {
  tileRow: number
  tileCol: number
  locationSlug: string
  onClose: () => void
  onBuildStarted: (newCredits: number) => void
}) {
  const { credits } = useGameStore()
  const [building, setBuilding] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function getToken() {
    const { createBrowserClient } = await import('@supabase/ssr')
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }

  async function handleBuild(buildableId: string) {
    setBuilding(true)
    const token = await getToken()
    const res = await fetch(
      `/api/game/build?action=start&buildableId=${buildableId}&location=${locationSlug}&tileRow=${tileRow}&tileCol=${tileCol}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )
    const data = await res.json()
    setBuilding(false)
    if (data.ok) {
      setMsg(`✓ Baubeginn: ${data.buildable}`)
      onBuildStarted(data.newCredits)
      setTimeout(onClose, 1500)
    } else {
      setMsg(`✗ ${data.error}`)
    }
  }

  const buildItems = Object.entries(BUILDABLE_ITEMS).filter(([, b]) => b.type === 'building')

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: '#1a2a3a', border: '1px solid #2a4e7a',
        borderRadius: '12px', padding: '1.5rem', minWidth: '320px',
        fontFamily: 'system-ui, sans-serif',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: '0.65rem', color: '#b99b6b', textTransform: 'uppercase', letterSpacing: '3px', marginBottom: '1rem' }}>
          🏗️ Gebäude bauen – Kachel ({tileRow},{tileCol})
        </div>

        {msg && (
          <div style={{ padding: '0.5rem', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.8rem',
            background: msg.startsWith('✓') ? '#1a3a2a' : '#3a1a1a',
            color: msg.startsWith('✓') ? '#6fcf97' : '#e74c3c',
          }}>
            {msg}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {buildItems.map(([id, item]) => {
            const canAfford = credits >= item.cost
            return (
              <div key={id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.75rem', borderRadius: '6px',
                background: canAfford ? '#2a3a4a' : '#1a2530',
                border: '1px solid #2a4e7a',
                opacity: canAfford ? 1 : 0.6,
              }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>
                    {TILE_EMOJI[`building_${id}`]} {item.name}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#8a9ab0', marginTop: '0.2rem' }}>
                    {item.description} · {item.buildTimeTicks} Tick{item.buildTimeTicks > 1 ? 's' : ''} Bauzeit
                  </div>
                </div>
                <button
                  disabled={!canAfford || building}
                  onClick={() => handleBuild(id)}
                  style={{
                    background: canAfford ? '#2a4e7a' : '#2a3a4a',
                    color: '#fff', border: 'none',
                    padding: '0.4rem 0.8rem', borderRadius: '4px',
                    fontSize: '0.7rem', fontWeight: 700,
                    cursor: canAfford ? 'pointer' : 'not-allowed',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.cost.toLocaleString('de')} Cr
                </button>
              </div>
            )
          })}
        </div>

        <button
          onClick={onClose}
          style={{ marginTop: '1rem', width: '100%', background: 'transparent',
            color: '#64748b', border: '1px solid #2a3a4a', borderRadius: '4px',
            padding: '0.4rem', fontSize: '0.7rem', cursor: 'pointer' }}
        >
          Abbrechen
        </button>
      </div>
    </div>
  )
}

interface ColonyGridProps {
  slug:          string
  name:          string
  population:    number
  populationMax: number
  isSupplied:    boolean
  buildings?:    { type: string; row: number; col: number; status: string }[]
}

export default function ColonyGrid({
  slug, name, population, populationMax, isSupplied, buildings = [],
}: ColonyGridProps) {
  const { credits, loadFromServer } = useGameStore()
  const [grid, setGrid] = useState<string[][]>([])
  const [selectedTile, setSelectedTile] = useState<{ r: number; c: number; type: string } | null>(null)
  const [showBuildPopup, setShowBuildPopup] = useState(false)
  const styles = TILE_STYLES[slug] ?? TILE_STYLES.moon
  const popPercent = Math.round((population / populationMax) * 100)

  useEffect(() => {
    setGrid(generateGrid(slug, population, populationMax, buildings, COLS, ROWS))
  }, [slug, population, populationMax, buildings])

  function handleTileClick(r: number, c: number, tileType: string) {
    setSelectedTile({ r, c, type: tileType })
    if (isBuildable(tileType)) setShowBuildPopup(true)
  }

  if (grid.length === 0) return null

  return (
    <div style={{ background: '#1a2a3a', borderRadius: '12px', padding: '1rem', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>

      {/* Build-Popup */}
      {showBuildPopup && selectedTile && (
        <BuildPopup
          tileRow={selectedTile.r}
          tileCol={selectedTile.c}
          locationSlug={slug}
          onClose={() => { setShowBuildPopup(false); setSelectedTile(null) }}
          onBuildStarted={async (newCredits) => { await loadFromServer() }}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.75rem' }}>
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#b99b6b', textTransform: 'uppercase', letterSpacing: '3px' }}>{name}</div>
          <div style={{ fontSize: '0.55rem', color: '#8a9ab0', marginTop: '2px' }}>{slug.toUpperCase()} SECTOR</div>
        </div>
        <div style={{ display: 'flex', gap: '1rem', background: 'rgba(0,0,0,0.3)', padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.65rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#8a9ab0', fontSize: '0.5rem' }}>POP</div>
            <div style={{ color: '#fff', fontWeight: 700 }}>{population.toLocaleString('de')}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#8a9ab0', fontSize: '0.5rem' }}>CAP</div>
            <div style={{ color: '#fff', fontWeight: 700 }}>{popPercent}%</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#8a9ab0', fontSize: '0.5rem' }}>STATUS</div>
            <div style={{ color: isSupplied ? '#6fcf97' : '#e74c3c', fontWeight: 700 }}>{isSupplied ? '🟢 OK' : '🔴 RISK'}</div>
          </div>
        </div>
      </div>

      {/* Kachelgrid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${COLS}, ${TILE_SIZE}px)`,
        gap: 0, border: '2px solid #2a4e7a', borderRadius: '6px',
        overflow: 'hidden', width: `${COLS * TILE_SIZE}px`,
      }}>
        {grid.flatMap((row, r) =>
          row.map((tileType, c) => {
            const isSelected = selectedTile?.r === r && selectedTile?.c === c
            const canBuild = isBuildable(tileType)
            const emoji = TILE_EMOJI[tileType] ?? '·'
            const isBuilding = tileType.startsWith('building_')

            return (
              <div
                key={`${r}-${c}`}
                title={TILE_INFO[tileType]?.label ?? tileType}
                onClick={() => handleTileClick(r, c, tileType)}
                style={{
                  width: TILE_SIZE, height: TILE_SIZE,
                  background: styles[tileType] ?? '#4a5260',
                  boxSizing: 'border-box',
                  border: isSelected ? '2px solid #c9a961' : '0.5px solid rgba(0,0,0,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: isBuilding ? '1.2rem' : '0.7rem',
                  cursor: canBuild ? 'pointer' : 'default',
                  transition: 'all 0.1s',
                  opacity: isSelected ? 0.9 : 1,
                }}
              >
                {emoji}
              </div>
            )
          })
        )}
      </div>

      {/* Info-Panel für ausgewählte Kachel */}
      {selectedTile && !showBuildPopup && (
        <div style={{
          marginTop: '0.75rem', padding: '0.6rem 1rem',
          background: 'rgba(0,0,0,0.3)', borderRadius: '6px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: '0.75rem',
        }}>
          <div>
            <span style={{ color: '#b99b6b', fontWeight: 700 }}>
              {TILE_INFO[selectedTile.type]?.label ?? selectedTile.type}
            </span>
            <span style={{ color: '#8a9ab0', marginLeft: '0.75rem' }}>
              {TILE_INFO[selectedTile.type]?.desc}
            </span>
          </div>
          {isBuildable(selectedTile.type) && (
            <button
              onClick={() => setShowBuildPopup(true)}
              style={{
                background: '#2a4e7a', color: '#fff', border: 'none',
                padding: '0.3rem 0.75rem', borderRadius: '4px',
                fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              🏗️ Bauen
            </button>
          )}
          <button
            onClick={() => setSelectedTile(null)}
            style={{ background: 'transparent', color: '#64748b', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Bevölkerungsbalken */}
      <div style={{ marginTop: '0.6rem', background: '#0a1a2a', height: '4px', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{
          width: `${popPercent}%`, height: '100%',
          background: isSupplied ? 'linear-gradient(90deg, #6fcf97, #27ae60)' : 'linear-gradient(90deg, #e74c3c, #c0392b)',
          transition: 'width 0.5s',
        }} />
      </div>
    </div>
  )
}