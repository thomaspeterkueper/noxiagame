// app/dashboard/MiniMap.tsx
// Erstellt:     14.06.2026
// Version:      0.1.0
//
// Schlanke Vorschau-Karte des Koloniegrids für die Dashboard-Hauptview.
// Reine Farbflächen (kein Bild-Laden, keine Klick-Logik) → leicht & schnell.
// Die ganze Fläche ist EIN Button, der das volle ColonyGrid im Overlay öffnet.
//
// ⚠️ BEWUSSTES DUPLIKAT: Terrain-Logik (seededRandom, Regeln je Ort, COLS/ROWS)
// ist absichtlich aus ColonyGrid.tsx kopiert, NICHT geteilt — damit diese
// Komponente ColonyGrid (Parallel-Session) nicht anfasst. Falls die
// Terrain-Generierung in ColonyGrid geändert wird, MUSS sie hier nachgezogen
// werden, sonst weicht die Vorschau vom echten Grid ab. Wenn das lästig wird:
// generateGrid in lib/grid/ ziehen und beide darauf umstellen.

'use client'

const COLS = 12
const ROWS = 8

// — identisch zu ColonyGrid.tsx (bewusstes Duplikat) —
function seededRandom(seed: number, i: number): number {
  const x = Math.sin(seed + i) * 10000
  return x - Math.floor(x)
}

function isBuildable(tileType: string): boolean {
  return tileType === 'tile_surface' || tileType === 'tile_metal'
}

interface MiniEntity {
  entity_id:  string
  profile_id: string
  tile_row:   number
  tile_col:   number
  entity_type: string
}

// Terrain erzeugen — gleiche Regeln wie ColonyGrid (ohne NPC-Habitate/Straßen,
// die für eine Vorschau nicht nötig sind; eigene Gebäude werden überlagert).
function generateTerrain(slug: string): string[][] {
  const grid: string[][] = []
  const seed = slug.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  for (let r = 0; r < ROWS; r++) {
    const row: string[] = []
    for (let c = 0; c < COLS; c++) {
      const rand = seededRandom(seed, r * COLS + c)
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
  return grid
}

// Kachelfarben (dunkle Karten-Ästhetik, passt zum vollen Grid)
const TILE_COLOR: Record<string, string> = {
  tile_surface:  '#243446',
  tile_crater:   '#1c2a38',
  tile_mountain: '#2e4054',
  tile_canyon:   '#3a2a2a',
  tile_shaft:    '#1a2230',
  tile_metal:    '#3a3a48',
}

export default function MiniMap({
  slug, entities = [], userId, onOpen,
}: {
  slug: string
  entities?: MiniEntity[]
  userId: string
  onOpen: () => void
}) {
  const terrain = generateTerrain(slug)

  // Gebäude-Positionen nachschlagen
  const buildingAt: Record<string, MiniEntity> = {}
  for (const e of entities) {
    if (e.entity_type === 'building') buildingAt[`${e.tile_row}-${e.tile_col}`] = e
  }

  const ownGold = '#c9a961'
  const otherGray = '#5a6878'

  return (
    <button
      onClick={onOpen}
      title="Karte öffnen"
      style={{
        display: 'block', width: '100%', padding: '10px',
        background: '#0e1726', border: '1px solid #1f3650', borderRadius: '10px',
        cursor: 'pointer', position: 'relative',
      }}
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${COLS}, 1fr)`,
        gap: '2px', width: '100%',
      }}>
        {terrain.flatMap((row, r) =>
          row.map((tileType, c) => {
            const b = buildingAt[`${r}-${c}`]
            const bg = b
              ? (b.profile_id === userId ? ownGold : otherGray)
              : (TILE_COLOR[tileType] ?? '#243446')
            return (
              <div key={`${r}-${c}`} style={{
                aspectRatio: '1 / 1', borderRadius: '2px', background: bg,
                boxShadow: b && b.profile_id === userId ? `0 0 4px ${ownGold}` : 'none',
              }} />
            )
          })
        )}
      </div>
      <div style={{
        position: 'absolute', bottom: '14px', right: '16px',
        fontSize: '0.66rem', color: '#9fb4cf', background: 'rgba(2,4,8,0.7)',
        padding: '3px 9px', borderRadius: '999px', pointerEvents: 'none',
      }}>
        Karte öffnen →
      </div>
    </button>
  )
}
