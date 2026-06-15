// app/dashboard/MiniMap.tsx
// Erstellt:     14.06.2026
// Aktualisiert: 15.06.2026
// Version:      0.3.0
//
// Schlanke Vorschau-Karte des Koloniegrids für die Dashboard-Hauptview.
// Die ganze Fläche ist EIN Button, der das volle ColonyGrid im Overlay öffnet.
//
// v0.3.0: Gebäude (echt + NPC) rendern über das animierte BuildingSVG —
//   dieselben Sprites wie im großen Grid. Terrain/Straßen bleiben schlanke
//   Farbflächen (kein Bild-Laden). Eigene Gebäude: Goldrahmen. Die früheren
//   eigenen ICON-Strichzeichnungen sind damit entfallen.
// v0.2.0: volle generateGrid-Logik (Terrain + NPC + Bestand + Vorgänge).
//
// ⚠️ BEWUSSTES DUPLIKAT: generateGrid/seededRandom sind aus ColonyGrid.tsx
// gespiegelt, NICHT geteilt. Wird die Terrain-/Platzierungslogik dort geändert,
// hier nachziehen. Geplante Etappe B: generateGrid nach lib/grid/ ziehen und
// beide darauf umstellen.

'use client'

import React from 'react'
import { BuildingSVG, BuildingSpriteStyles } from '@/lib/grid/BuildingSVG'

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

  // 3. NPC-Bauten nach Bevölkerung. Typ per Seed variiert (nur Optik).
  const habitatCount = Math.min(Math.floor(population / 150), Math.floor(flat.length * 0.5))
  for (let i = 0; i < habitatCount; i++) {
    const [r, c] = flat[i]
    const v = seededRandom(seed, 999 + r * COLS + c)
    const type = v < 0.12 ? 'npc_mine' : v < 0.22 ? 'npc_solar' : 'npc_habitat'
    grid[r][c] = { type, owner: null }
  }

  // 4. Straßen durchs Zentrum
  if (population > 200) {
    for (let c = 0; c < COLS; c++)
      if (isBuildable(grid[centerR][c].type)) grid[centerR][c] = { type: 'road', owner: null }
    for (let r = 0; r < ROWS; r++)
      if (isBuildable(grid[r][centerC].type)) grid[r][centerC] = { type: 'road', owner: null }
  }

  // 5. Eigener/fremder Bestand (überschreibt alles)
  return grid.map((row, r) => row.map((cell, c) => {
    const e = entities.find(en => en.tile_row === r && en.tile_col === c && en.entity_type === 'building')
    if (e) return { type: `building_${e.entity_id}`, owner: 'own' as const }
    const p = pending.find(pn => pn.tile_row === r && pn.tile_col === c)
    if (p) return { type: p.status === 'building' ? 'building_construction' : `building_${p.buildable_id}`, owner: null }
    return cell
  }))
}

// Terrain-/Straßenfarben (Gebäude rendern über BuildingSVG, nicht hier)
const TILE_COLOR: Record<string, string> = {
  tile_surface:  '#243446',
  tile_crater:   '#1c2a38',
  tile_mountain: '#2e4054',
  tile_canyon:   '#3a2a2a',
  tile_shaft:    '#1a2230',
  tile_metal:    '#3a3a48',
  road:          '#5a6b80',
}
const NPC_TILE_BG    = '#1e2a3a'   // dezenter Hintergrund hinter NPC-Sprites
const CONSTRUCTION_COLOR = '#6b5a2a'

// NPC-Bautyp → entity_id fürs BuildingSVG
const NPC_ENTITY: Record<string, string> = {
  npc_mine:    'mine',
  npc_solar:   'solar',
  npc_habitat: 'habitat',
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
  const otherGray = '#5a6878'

  // Liefert pro Zelle: was rendern (Terrain-Farbe ODER Gebäude-Sprite) + Rahmen.
  function cell(cellData: { type: string; owner: 'own' | 'other' | null }, r: number, c: number) {
    const t = cellData.type

    // Echtes Gebäude aus dem Bestand?
    const ent = entities.find(e => e.tile_row === r && e.tile_col === c && e.entity_type === 'building')
    if (ent) {
      const own = ent.profile_id === userId
      return {
        bg: NPC_TILE_BG,
        outline: own ? ownGold : otherGray,
        glow: own,
        entityId: ent.entity_id,   // typrichtiges Sprite, unabhängig vom Eigentümer
      }
    }

    // Baustelle → schlichte Farbe (BuildingSVG hat kein construction-Sprite)
    if (t === 'building_construction') {
      return { bg: CONSTRUCTION_COLOR, outline: null, glow: false, entityId: null }
    }

    // NPC-Bau → BuildingSVG-Sprite (dezenter Hintergrund, kein Rahmen)
    if (NPC_ENTITY[t]) {
      return { bg: NPC_TILE_BG, outline: null, glow: false, entityId: NPC_ENTITY[t] }
    }
    // Alt-Fallback: building_habitat aus Bestand ohne ent (selten)
    if (t === 'building_habitat') {
      return { bg: NPC_TILE_BG, outline: null, glow: false, entityId: 'habitat' }
    }

    // Terrain / Straße → Farbfläche
    return { bg: TILE_COLOR[t] ?? '#243446', outline: null, glow: false, entityId: null }
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
      {/* Animations-Keyframes für BuildingSVG (auch nötig, wenn großes Grid zu ist) */}
      <BuildingSpriteStyles />

      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${COLS}, 1fr)`,
        gap: '2px', width: '100%', maxWidth: '420px', margin: '0 auto',
      }}>
        {grid.flatMap((row, r) =>
          row.map((cellData, c) => {
            const { bg, outline, glow, entityId } = cell(cellData, r, c)
            return (
              <div key={`${r}-${c}`} style={{
                width: '100%', aspectRatio: '1 / 1', borderRadius: '2px', background: bg,
                outline: outline ? `1px solid ${outline}` : 'none',
                outlineOffset: '-1px',
                boxShadow: glow ? `0 0 4px ${ownGold}` : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', boxSizing: 'border-box',
              }}>
                {entityId && (
                  <BuildingSVG
                    entityId={entityId}
                    planet={slug as 'moon' | 'mars' | 'phobos'}
                    occupancy={0.6}
                    owned={false}
                    size={28}
                  />
                )}
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
