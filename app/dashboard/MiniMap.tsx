// app/dashboard/MiniMap.tsx
// Erstellt:     14.06.2026
// Aktualisiert: 14.06.2026
// Version:      0.2.0
//
// Schlanke Vorschau-Karte des Koloniegrids für die Dashboard-Hauptview.
// Reine Farbflächen (kein Bild-Laden, keine Klick-Logik) → leicht & schnell.
// Die ganze Fläche ist EIN Button, der das volle ColonyGrid im Overlay öffnet.
//
// v0.2.0: Nutzt jetzt die VOLLE generateGrid-Logik (Terrain + NPC-Habitate +
//   eigener/fremder Bestand + laufende Vorgänge) — identisch zu ColonyGrid,
//   damit die Mini exakt dasselbe zeigt wie das große Grid (vorher zeigte sie
//   nur Terrain). Farben je Kacheltyp/Gebäude.
//
// ⚠️ BEWUSSTES DUPLIKAT: generateGrid/seededRandom sind absichtlich aus
// ColonyGrid.tsx gespiegelt, NICHT geteilt — damit diese Komponente ColonyGrid
// (Parallel-Session) nicht anfasst. Wird die Terrain-/Platzierungslogik dort
// geändert, MUSS sie hier nachgezogen werden. Wenn das lästig wird:
// generateGrid nach lib/grid/ ziehen und beide darauf umstellen.

'use client'

const COLS = 12
const ROWS = 8

function seededRandom(seed: number, i: number): number {
  const x = Math.sin(seed + i) * 10000
  return x - Math.floor(x)
}

function isBuildable(tileType: string): boolean {
  return tileType === 'tile_surface' || tileType === 'tile_metal'
}

interface MiniEntity {
  entity_id:   string
  profile_id:  string
  entity_type: string
  tile_row:    number
  tile_col:    number
}

interface MiniPending {
  buildable_id: string
  tile_row:     number
  tile_col:     number
  status:       string
}

// Volle Grid-Generierung — gespiegelt aus ColonyGrid.generateGrid.
// Liefert zusätzlich pro Zelle den Eigentümer (für Goldmarkierung).
function generateGrid(
  slug: string,
  population: number,
  entities: MiniEntity[],
  pending: MiniPending[],
): { type: string; owner: 'own' | 'other' | null }[][] {
  const grid: { type: string; owner: 'own' | 'other' | null }[][] = []
  const seed = slug.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const centerR = Math.floor(ROWS / 2)
  const centerC = Math.floor(COLS / 2)

  // 1. Terrain
  for (let r = 0; r < ROWS; r++) {
    const row: { type: string; owner: 'own' | 'other' | null }[] = []
    for (let c = 0; c < COLS; c++) {
      const rand = seededRandom(seed, r * COLS + c)
      let t: string
      if (slug === 'moon') {
        t = rand < 0.06 ? 'tile_crater' : rand < 0.10 ? 'tile_mountain' : 'tile_surface'
      } else if (slug === 'mars') {
        t = rand < 0.08 ? 'tile_crater' : rand < 0.13 ? 'tile_canyon' : 'tile_surface'
      } else {
        t = rand < 0.10 ? 'tile_shaft' : rand < 0.15 ? 'tile_metal' : 'tile_surface'
      }
      row.push({ type: t, owner: null })
    }
    grid.push(row)
  }

  // 2. Belegte Positionen (Bestand + Vorgänge) für NPC-Habitate aussparen
  const occupied = new Set<string>()
  for (const e of entities) occupied.add(`${e.tile_row}-${e.tile_col}`)
  for (const p of pending)  occupied.add(`${p.tile_row}-${p.tile_col}`)

  const flat: [number, number][] = []
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (isBuildable(grid[r][c].type) && !occupied.has(`${r}-${c}`))
        flat.push([r, c])
  flat.sort((a, b) =>
    (Math.abs(a[0] - centerR) + Math.abs(a[1] - centerC)) -
    (Math.abs(b[0] - centerR) + Math.abs(b[1] - centerC))
  )

  // 3. NPC-Habitate nach Bevölkerung
  const habitatCount = Math.min(Math.floor(population / 150), Math.floor(flat.length * 0.5))
  for (let i = 0; i < habitatCount; i++) {
    const [r, c] = flat[i]
    grid[r][c] = { type: 'building_habitat', owner: null }
  }

  // 4. Straßen durchs Zentrum
  if (population > 200) {
    for (let c = 0; c < COLS; c++)
      if (isBuildable(grid[centerR][c].type)) grid[centerR][c] = { type: 'road', owner: null }
    for (let r = 0; r < ROWS; r++)
      if (isBuildable(grid[r][centerC].type)) grid[r][centerC] = { type: 'road', owner: null }
  }

  // 5. Eigener/fremder Bestand (überschreibt alles, mit Eigentümer-Markierung)
  return grid.map((row, r) => row.map((cell, c) => {
    const e = entities.find(en => en.tile_row === r && en.tile_col === c && en.entity_type === 'building')
    if (e) return { type: `building_${e.entity_id}`, owner: 'own' as const } // owner wird unten je userId gesetzt
    const p = pending.find(pn => pn.tile_row === r && pn.tile_col === c)
    if (p) return { type: p.status === 'building' ? 'building_construction' : `building_${p.buildable_id}`, owner: null }
    return cell
  }))
}

// Farben
const TILE_COLOR: Record<string, string> = {
  tile_surface:  '#243446',
  tile_crater:   '#1c2a38',
  tile_mountain: '#2e4054',
  tile_canyon:   '#3a2a2a',
  tile_shaft:    '#1a2230',
  tile_metal:    '#3a3a48',
  road:          '#33445a',
}
const NPC_HABITAT_COLOR = '#46586e'   // NPC-Habitate: gedämpftes Blaugrau
const CONSTRUCTION_COLOR = '#6b5a2a'  // Baustelle

// Symbole pro Gebäudetyp (eigene + fremde echte Gebäude)
const BUILDING_ICON: Record<string, string> = {
  mine:    '⛏️',
  solar:   '⚡',
  habitat: '🏘️',
}

export default function MiniMap({
  slug, population = 0, entities = [], pending = [], userId, onOpen,
}: {
  slug: string
  population?: number
  entities?: MiniEntity[]
  pending?: MiniPending[]
  userId: string
  onOpen: () => void
}) {
  const grid = generateGrid(slug, population, entities, pending)
  const ownGold = '#c9a961'
  const otherGray = '#7d8ca0'

  function cellColor(cell: { type: string; owner: 'own' | 'other' | null }, r: number, c: number): { bg: string; glow: boolean; icon: string } {
    // Echtes Gebäude? Eigentümer + Typ bestimmen.
    const ent = entities.find(e => e.tile_row === r && e.tile_col === c && e.entity_type === 'building')
    if (ent) {
      const own = ent.profile_id === userId
      return { bg: own ? ownGold : otherGray, glow: own, icon: BUILDING_ICON[ent.entity_id] ?? '▪' }
    }
    if (cell.type === 'building_construction') return { bg: CONSTRUCTION_COLOR, glow: false, icon: '🏗️' }
    if (cell.type === 'building_habitat')      return { bg: NPC_HABITAT_COLOR, glow: false, icon: '🏠' }
    if (cell.type.startsWith('building_'))      return { bg: NPC_HABITAT_COLOR, glow: false, icon: '' }
    return { bg: TILE_COLOR[cell.type] ?? '#243446', glow: false, icon: '' }
  }

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
        {grid.flatMap((row, r) =>
          row.map((cell, c) => {
            const { bg, glow, icon } = cellColor(cell, r, c)
            return (
              <div key={`${r}-${c}`} style={{
                width: '100%', aspectRatio: '1 / 1', borderRadius: '2px', background: bg,
                boxShadow: glow ? `0 0 4px ${ownGold}` : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.6rem', lineHeight: 1, overflow: 'hidden',
              }}>
                {icon}
              </div>
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
