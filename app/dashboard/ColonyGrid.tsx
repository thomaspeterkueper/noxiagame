// app/dashboard/ColonyGrid.tsx
// Erstellt: 31.05.2026
// Aktualisiert: 31.05.2026 – SVG-Kacheln statt CSS-Verläufe
// 
// Kachelgrid pro Kolonie (12×8):
// - Terrain wird seed-basiert deterministisch generiert
// - Gebäude aus DB werden auf gespeicherten Positionen angezeigt
// - SVG-Kacheln aus lib/grid/TileSVG.tsx (kein externes Bild nötig)
// - Klick auf bebaubare Kachel öffnet Build-Popup
// - Hover zeigt Kachelinfo an

'use client'

import { useState, useEffect } from 'react'
import { useGameStore } from '@/lib/store/gameStore'
import { BUILDABLE_ITEMS } from '@/lib/game/config'
import { TileSVG } from '@/lib/grid/TileSVG'

function TileDisplay({ tileType, slug }: { tileType: string; slug: string }) {
  const [src, setSrc] = useState(`/images/grid/${slug}/${tileType}.webp`)
  const [useSVG, setUseSVG] = useState(false)

  if (useSVG) return <TileSVG type={tileType} planet={slug as 'moon' | 'mars' | 'phobos'} />

  return (
    <img
      src={src}
      width={44} height={44}
      style={{ display: 'block' }}
      onError={() => {
        if (src.endsWith('.webp')) setSrc(`/images/grid/${slug}/${tileType}.png`)
        else setUseSVG(true)
      }}
    />
  )
}

const COLS = 12
const ROWS = 8
const TILE_SIZE = 44

// Kacheltypen die bebaubar sind
function isBuildable(tileType: string): boolean {
  return tileType === 'tile_surface' || tileType === 'tile_metal'
}

// Seed-basierter Zufallsgenerator – deterministisch pro Kolonie
function seededRandom(seed: number, i: number): number {
  const x = Math.sin(seed + i) * 10000
  return x - Math.floor(x)
}

// Generiert das Terrain-Grid basierend auf Kolonie und Bevölkerung
function generateGrid(
  slug:          string,
  population:    number,
  populationMax: number,
  buildings:     { type: string; row: number; col: number; status: string }[],
  cols:          number,
  rows:          number
): string[][] {
  const grid: string[][] = []
  const seed = slug.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const centerR = Math.floor(rows / 2)
  const centerC = Math.floor(cols / 2)

  // 1. Terrain generieren (deterministisch durch Seed)
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

  // 2. Flache Positionen für Habitate und Gebäude sammeln
  const flatPositions: [number, number][] = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (isBuildable(grid[r][c])) flatPositions.push([r, c])

  // 3. Nach Entfernung zum Zentrum sortieren (Gebäude wachsen von Mitte nach außen)
  flatPositions.sort((a, b) =>
    (Math.abs(a[0] - centerR) + Math.abs(a[1] - centerC)) -
    (Math.abs(b[0] - centerR) + Math.abs(b[1] - centerC))
  )

  // 4. Habitate basierend auf Bevölkerung platzieren
  const habitatCount = Math.min(Math.floor(population / 150), Math.floor(flatPositions.length * 0.5))
  for (let i = 0; i < habitatCount; i++) {
    const [r, c] = flatPositions[i]
    grid[r][c] = 'building_habitat'
  }

  // 5. Spieler-Gebäude aus DB platzieren
  for (const b of buildings) {
    if (b.row >= 0 && b.row < rows && b.col >= 0 && b.col < cols) {
      grid[b.row][b.col] = b.status === 'building'
        ? 'building_construction'
        : `building_${b.type}`
    }
  }

  // 6. Straßen durch Zentrum wenn genug Bevölkerung
  if (population > 200) {
    for (let c = 0; c < cols; c++)
      if (isBuildable(grid[centerR][c])) grid[centerR][c] = 'road'
    for (let r = 0; r < rows; r++)
      if (isBuildable(grid[r][centerC])) grid[r][centerC] = 'road'
  }

  return grid
}

// ── Build-Popup ───────────────────────────────────────────────

function BuildPopup({
  tileRow, tileCol, locationSlug, onClose, onBuildStarted
}: {
  tileRow:        number
  tileCol:        number
  locationSlug:   string
  onClose:        () => void
  onBuildStarted: (newCredits: number) => void
}) {
  const { credits } = useGameStore()
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]         = useState<string | null>(null)

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
    setLoading(true)
    const token = await getToken()
    const res = await fetch(
      `/api/game/build?action=start&buildableId=${buildableId}&location=${locationSlug}&tileRow=${tileRow}&tileCol=${tileCol}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )
    const data = await res.json()
    setLoading(false)
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
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#1a2a3a', border: '1px solid #2a4e7a', borderRadius: '12px', padding: '1.5rem', minWidth: '320px', fontFamily: 'system-ui, sans-serif' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: '0.65rem', color: '#b99b6b', textTransform: 'uppercase', letterSpacing: '3px', marginBottom: '1rem' }}>
          🏗️ Gebäude bauen – Kachel ({tileRow},{tileCol})
        </div>

        {msg && (
          <div style={{ padding: '0.5rem', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.8rem',
            background: msg.startsWith('✓') ? '#1a3a2a' : '#3a1a1a',
            color: msg.startsWith('✓') ? '#6fcf97' : '#e74c3c' }}>
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
                border: '1px solid #2a4e7a', opacity: canAfford ? 1 : 0.6,
              }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#8a9ab0', marginTop: '0.2rem' }}>
                    {item.description} · {item.buildTimeTicks} Tick{item.buildTimeTicks > 1 ? 's' : ''} Bauzeit
                  </div>
                </div>
                <button
                  disabled={!canAfford || loading}
                  onClick={() => handleBuild(id)}
                  style={{
                    background: canAfford ? '#2a4e7a' : '#2a3a4a',
                    color: '#fff', border: 'none',
                    padding: '0.4rem 0.8rem', borderRadius: '4px',
                    fontSize: '0.7rem', fontWeight: 700,
                    cursor: canAfford ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap',
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
          style={{ marginTop: '1rem', width: '100%', background: 'transparent', color: '#64748b', border: '1px solid #2a3a4a', borderRadius: '4px', padding: '0.4rem', fontSize: '0.7rem', cursor: 'pointer' }}
        >
          Abbrechen
        </button>
      </div>
    </div>
  )
}

// ── Hauptkomponente ───────────────────────────────────────────

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
  const { loadFromServer } = useGameStore()
  const [grid, setGrid]               = useState<string[][]>([])
  const [selectedTile, setSelectedTile] = useState<{ r: number; c: number; type: string } | null>(null)
  const [showBuildPopup, setShowBuildPopup] = useState(false)
  const popPercent = Math.round((population / populationMax) * 100)

  // Grid neu generieren wenn Bevölkerung oder Gebäude sich ändern
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
          onBuildStarted={async () => { await loadFromServer() }}
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
            <div style={{ color: isSupplied ? '#6fcf97' : '#e74c3c', fontWeight: 700 }}>{isSupplied ? '🟢' : '🔴'}</div>
          </div>
        </div>
      </div>

      {/* Kachelgrid – SVG-Kacheln ohne externe Dateien */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${COLS}, ${TILE_SIZE}px)`,
        gap: 0,
        border: '2px solid #2a4e7a',
        borderRadius: '6px',
        overflow: 'hidden',
        width: `${COLS * TILE_SIZE}px`,
      }}>
        {grid.flatMap((row, r) =>
          row.map((tileType, c) => {
            const isSelected  = selectedTile?.r === r && selectedTile?.c === c
            const canBuild    = isBuildable(tileType)
            const isBuilding  = tileType.startsWith('building_')

            return (
              <div
                key={`${r}-${c}`}
                title={tileType.replace(/_/g, ' ')}
                onClick={() => handleTileClick(r, c, tileType)}
                style={{
                  width:   TILE_SIZE,
                  height:  TILE_SIZE,
                  cursor:  canBuild ? 'pointer' : 'default',
                  outline: isSelected ? '2px solid #c9a961' : 'none',
                  outlineOffset: '-2px',
                  boxSizing: 'border-box',
                  flexShrink: 0,
                }}
              >
                <TileDisplay tileType={tileType} slug={slug} />
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
              {selectedTile.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </span>
            <span style={{ color: '#8a9ab0', marginLeft: '0.75rem' }}>
              {isBuildable(selectedTile.type) ? 'Bebaubar' : 'Nicht bebaubar'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {isBuildable(selectedTile.type) && (
              <button
                onClick={() => setShowBuildPopup(true)}
                style={{ background: '#2a4e7a', color: '#fff', border: 'none', padding: '0.3rem 0.75rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}
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
