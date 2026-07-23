// lib/game/streetTiles.ts
// Erstellt:     20.07.2026
// Aktualisiert: 20.07.2026 — Adapter: getStreetTiles (provisorisch: generateGrid)
// Version:      0.1.0
//
// ADAPTER — Abstraktionsgrenze für Straßen-Abfrage.
// Die Walkable Colony ruft ausschließlich getStreetTiles() auf.
// Interne Implementierung ist austauschbar:
//   v0.x: generateGrid() (deterministisch, kein DB)
//   v1.0: tile_entities WHERE entity_id = 'road' (nach Migration A')
//
// GATE: Keine direkte Abhängigkeit von generateGrid() in der Mikro-Ebene.

import { generateGrid, type GridCell } from './gridGenerator'

export interface StreetTile {
  row:      number
  col:      number
  // Straßentyp — wird nach A' aus tile_entities gelesen
  subtype:  'main' | 'side' | 'crossing'
  // Nach A': aus tile_entities
  entityId?:    string
  builtAt?:     string
  ownerClass?:  string
}

/**
 * Gibt alle Straßen-Tiles für eine Location zurück.
 *
 * PROVISORISCH (v0.1): Liest aus generateGrid().
 * NACH A' (v1.0): Liest aus tile_entities WHERE entity_id IN ('road','road_main').
 *
 * Die Walkable Colony darf diese Funktion aufrufen.
 * Die Walkable Colony darf generateGrid() NICHT direkt aufrufen.
 */
export function getStreetTiles(
  locationSlug: string,
  population:   number,
  entities:     any[],      // tile_entities für diesen Ort
  pending:      any[],      // player_builds pending
  userId:       string,
  cols:         number = 32,
  rows:         number = 24,
): StreetTile[] {
  // Provisorisch: aus generateGrid() ableiten
  const grid = generateGrid(locationSlug, population, entities, pending, userId, cols, rows)

  const streets: StreetTile[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r]?.[c]
      if (!cell) continue
      const t = cell.type
      if (t === 'tile_road_main' || t === 'tile_road_side' || t === 'tile_road_crossing') {
        streets.push({
          row:     r,
          col:     c,
          subtype: t === 'tile_road_main'     ? 'main'
                 : t === 'tile_road_crossing' ? 'crossing'
                 : 'side',
        })
      }
    }
  }
  return streets
}

/**
 * Gibt den nächstgelegenen Straßen-Tile zu einer Position zurück.
 * Nützlich um NPCs auf Straßen zu halten.
 */
export function nearestStreetTile(
  row:     number,
  col:     number,
  streets: StreetTile[],
): StreetTile | null {
  if (streets.length === 0) return null
  return streets.reduce((best, s) => {
    const d  = Math.abs(s.row - row) + Math.abs(s.col - col)
    const db = Math.abs(best.row - row) + Math.abs(best.col - col)
    return d < db ? s : best
  })
}

/**
 * Prüft ob ein Tile eine Straße ist.
 */
export function isStreet(row: number, col: number, streets: StreetTile[]): boolean {
  return streets.some(s => s.row === row && s.col === col)
}
