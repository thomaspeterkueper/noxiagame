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
import { generateGrid, NPC_ENTITY, roadSides, COLS } from '@/lib/grid/generateGrid'

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
const ROAD_LINE      = '#8595a8'   // helle Straßenstriche in der Mini

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
        road: null,
      }
    }

    // Baustelle → schlichte Farbe (BuildingSVG hat kein construction-Sprite)
    if (t === 'building_construction') {
      return { bg: CONSTRUCTION_COLOR, outline: null, glow: false, entityId: null, road: null }
    }

    // NPC-Bau → BuildingSVG-Sprite (dezenter Hintergrund, kein Rahmen)
    if (NPC_ENTITY[t]) {
      return { bg: NPC_TILE_BG, outline: null, glow: false, entityId: NPC_ENTITY[t], road: null }
    }
    // Alt-Fallback: building_habitat aus Bestand ohne ent (selten)
    if (t === 'building_habitat') {
      return { bg: NPC_TILE_BG, outline: null, glow: false, entityId: 'habitat', road: null }
    }

    // Straße → maskenbasierte Striche (verbundene Seiten)
    if (t.startsWith('road')) {
      return { bg: TILE_COLOR.road ?? '#2a3a4e', outline: null, glow: false, entityId: null, road: roadSides(t) }
    }

    // Terrain → Farbfläche
    return { bg: TILE_COLOR[t] ?? '#243446', outline: null, glow: false, entityId: null, road: null }
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
            const { bg, outline, glow, entityId, road } = cell(cellData, r, c)
            return (
              <div key={`${r}-${c}`} style={{
                width: '100%', aspectRatio: '1 / 1', borderRadius: '2px', background: bg,
                outline: outline ? `1px solid ${outline}` : 'none',
                outlineOffset: '-1px',
                boxShadow: glow ? `0 0 4px ${ownGold}` : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', boxSizing: 'border-box',
                position: 'relative',
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
                {road && (
                  <svg viewBox="0 0 10 10" width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
                    {/* Belag-Striche von der Mitte zu verbundenen Seiten */}
                    {road.n && <rect x={3.5} y={0}   width={3} height={5} fill={ROAD_LINE} />}
                    {road.s && <rect x={3.5} y={5}   width={3} height={5} fill={ROAD_LINE} />}
                    {road.w && <rect x={0}   y={3.5} width={5} height={3} fill={ROAD_LINE} />}
                    {road.o && <rect x={5}   y={3.5} width={5} height={3} fill={ROAD_LINE} />}
                    <rect x={3.5} y={3.5} width={3} height={3} fill={ROAD_LINE} />
                  </svg>
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
