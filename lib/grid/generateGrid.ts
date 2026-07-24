// lib/grid/generateGrid.ts
// Erstellt: 15.06.2026
// Aktualisiert: 24.07.2026 — Ground Truth von Scanner-Entdeckung getrennt
// Version:  0.7.0
//
// v0.7.0: Anomalien werden nicht mehr durch die Existenz eines Scanners erzeugt.
//   Sichtbar werden nur bereits gemessene/entdeckte Befunde aus dem Scan-State.
// v0.6.4: Mond-Ressourcentiles ice/helium3/titanium als bebaubar
//   freigeschaltet, damit Shackleton nach Moon Terrain v3 wieder nutzbar ist.
// v0.6.3: Neue spezialisierte Terrain-Tiles als bebaubar/straßenfähig
//   freigeschaltet: farmland/city/spaceport, mare/highland/research,
//   dust/plateau/habitat/industry.
// v0.6.2: Platzhalter-NPC-Bauten deaktiviert. Fremde Gebäude sollen erst
//   wieder erscheinen, wenn sie echten Akteuren/Fraktionen gehören.
// v0.6.1: Straßennetz wird vor NPC-Bauten gelegt; NPCs dürfen dadurch keine
//   Straßen mehr unterbrechen. Terrain-Layer bleibt fest aus locationMaps.ts.
// v0.6.0: Terrain-Layer kommt zuerst aus festen Location-Maps
//   (lib/grid/locationMaps.ts). Flüsse/Wälder/Berge bleiben dadurch stabil.

import { getFixedTerrain } from './locationMaps'
import { loadScanState } from '@/lib/game/scanning'

export const COLS = 12
export const ROWS = 8

export type CellOwner = 'own' | 'other' | 'state' | null

export interface Cell {
  type:     string
  owner:    CellOwner
  anomaly?: boolean
}

export interface GridEntity {
  entity_id:     string
  profile_id:    string | null | null
  is_state_owned?: boolean
  entity_type:   string
  tile_row:      number
  tile_col:      number
}

export interface GridPending {
  buildable_id: string
  tile_row:     number
  tile_col:     number
  status:       string
}

export function seededRandom(seed: number, i: number): number {
  const x = Math.sin(seed + i) * 10000
  return x - Math.floor(x)
}

export function isBuildable(tileType: string): boolean {
  return (
    tileType === 'tile_surface'   ||
    tileType === 'tile_grass'     ||
    tileType === 'tile_urban'     ||
    tileType === 'tile_farmland'  ||
    tileType === 'tile_city'      ||
    tileType === 'tile_spaceport' ||
    tileType === 'tile_mare'      ||
    tileType === 'tile_highland'  ||
    tileType === 'tile_research'  ||
    tileType === 'tile_ice'       ||
    tileType === 'tile_helium3'   ||
    tileType === 'tile_titanium'  ||
    tileType === 'tile_dust'      ||
    tileType === 'tile_plateau'   ||
    // tile_habitat + tile_industry: Terrain-Typen, NICHT bebaubar
    // (sehen aus wie Gebäude aber haben keine DB-Entity — Terrain-Ebene)
    tileType === 'tile_metal'     ||
    tileType === 'tile_crater'    ||
    tileType === 'tile_shaft'     ||
    tileType.startsWith('road_')
  )
}

export const NPC_ENTITY: Record<string, string> = {
  npc_mine:    'mine',
  npc_solar:   'solar',
  npc_habitat: 'habitat',
}

function terrainIs(grid: Cell[][], r: number, c: number, prefix: string): boolean {
  return r >= 0 && r < grid.length && c >= 0 && c < grid[r].length && grid[r][c].type.startsWith(prefix)
}

function autotilePrefix(grid: Cell[][], prefix: string, outPrefix: string): void {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c].type !== prefix) continue
      let mask = 0
      if (terrainIs(grid, r - 1, c, prefix) || terrainIs(grid, r - 1, c, outPrefix)) mask |= 1
      if (terrainIs(grid, r, c + 1, prefix) || terrainIs(grid, r, c + 1, outPrefix)) mask |= 2
      if (terrainIs(grid, r + 1, c, prefix) || terrainIs(grid, r + 1, c, outPrefix)) mask |= 4
      if (terrainIs(grid, r, c - 1, prefix) || terrainIs(grid, r, c - 1, outPrefix)) mask |= 8
      grid[r][c] = { ...grid[r][c], type: `${outPrefix}${mask}` }
    }
  }
}

function fallbackTerrain(slug: string, seed: number, r: number, c: number, cols: number): string {
  const rand = seededRandom(seed, r * cols + c)
  if (slug === 'earth') {
    if (rand < 0.16) return 'tile_forest_dense'
    if (rand < 0.31) return 'tile_forest_edge'
    if (rand < 0.40) return 'tile_city'
    if (rand < 0.45) return 'tile_farmland'
    return 'tile_grass'
  }
  if (slug === 'moon') return rand < 0.06 ? 'tile_crater' : rand < 0.18 ? 'tile_highland' : 'tile_surface'
  if (slug === 'mars') return rand < 0.08 ? 'tile_crater' : rand < 0.13 ? 'tile_canyon' : rand < 0.30 ? 'tile_dust' : 'tile_surface'
  return rand < 0.10 ? 'tile_shaft' : rand < 0.15 ? 'tile_metal' : 'tile_surface'
}

function addRoadNetwork(grid: Cell[][], population: number, userId: string | undefined, rows: number, cols: number): void {
  const centerR = Math.floor(rows / 2)
  if (population <= 200) return

  for (let c = 0; c < cols; c++) {
    if (isBuildable(grid[centerR][c].type)) grid[centerR][c] = { type: 'road', owner: userId ? 'state' : null }
  }

  const span = Math.min(Math.floor(population / 400) + 1, 3)
  for (let q = 1; q <= span; q++) {
    const qc = Math.round((cols * q) / (span + 1))
    const reach = 2 + Math.floor(population / 600)
    for (let r = centerR - reach; r <= centerR + reach; r++) {
      if (r < 0 || r >= rows) continue
      if (isBuildable(grid[r][qc].type)) grid[r][qc] = { type: 'road', owner: userId ? 'state' : null }
    }
  }
}

function autotileRoads(grid: Cell[][], rows: number, cols: number): void {
  const isRoad = (r: number, c: number) =>
    r >= 0 && r < rows && c >= 0 && c < cols && grid[r][c].type.startsWith('road')

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c].type !== 'road') continue
      let mask = 0
      if (isRoad(r - 1, c)) mask |= 1
      if (isRoad(r, c + 1)) mask |= 2
      if (isRoad(r + 1, c)) mask |= 4
      if (isRoad(r, c - 1)) mask |= 8
      grid[r][c] = { type: `road_${mask}`, owner: null }
    }
  }
}

export function generateGrid(
  slug:       string,
  population: number,
  entities:   GridEntity[],
  pending:    GridPending[],
  userId?:    string,
  cols:       number = COLS,
  rows:       number = ROWS,
): Cell[][] {
  const grid: Cell[][] = []
  const seed = slug.split('').reduce((a, c) => a + c.charCodeAt(0), 0)

  // 1. Terrain-Layer: feste Karten haben Vorrang, Fallback bleibt prozedural.
  for (let r = 0; r < rows; r++) {
    const row: Cell[] = []
    for (let c = 0; c < cols; c++) {
      const fixed = getFixedTerrain(slug, r, c)
      const type = fixed ?? fallbackTerrain(slug, seed, r, c, cols)
      row.push({ type, owner: null })
    }
    grid.push(row)
  }

  // 2. Terrain-Netzwerke maskieren. Der Rohcode 'river' kommt aus locationMaps.
  autotilePrefix(grid, 'river', 'river_')

  // 3. Straßennetz als öffentliche Infrastruktur.
  addRoadNetwork(grid, population, userId, rows, cols)
  autotileRoads(grid, rows, cols)

  // 4. Automatische Platzhalter-NPCs sind vorläufig deaktiviert.
  //    Echte Fremdgebäude sollen später aus DB-Entities mit realer profile_id /
  //    actor_id kommen, nicht aus dem Terrain-Generator.

  // 5. Bestand überschreibt den sichtbaren Layer, aber nicht die feste Karte.
  for (const e of entities) {
    if (e.tile_row >= 0 && e.tile_row < rows && e.tile_col >= 0 && e.tile_col < cols) {
      const owner: CellOwner = !userId
        ? null
        : (e as any).owner_class === 'STATE' || (e as any).owner_class === 'CORPORATION' || e.profile_id === null
        ? 'state'
        : e.profile_id === userId
        ? 'own'
        : 'other'
      grid[e.tile_row][e.tile_col] = { type: `building_${e.entity_id}`, owner }
    }
  }

  // 6. Vorgänge
  for (const p of pending) {
    if (p.tile_row >= 0 && p.tile_row < rows && p.tile_col >= 0 && p.tile_col < cols) {
      grid[p.tile_row][p.tile_col] = {
        type: p.status === 'building' ? 'building_construction' : `building_${p.buildable_id}`,
        owner: null,
      }
    }
  }

  // 7. Informations-Layer: nur entdeckte Befunde werden sichtbar.
  // Ground Truth selbst lebt ausserhalb des sichtbaren Grids in scanning.ts.
  const scanState = loadScanState(slug)
  for (const discovery of scanState?.discoveries ?? []) {
    if (discovery.row >= 0 && discovery.row < rows && discovery.col >= 0 && discovery.col < cols) {
      grid[discovery.row][discovery.col] = { ...grid[discovery.row][discovery.col], anomaly: true }
    }
  }

  return grid
}

function sides(type: string, prefix: string): { n: boolean; o: boolean; s: boolean; w: boolean } {
  const m = type.startsWith(prefix) ? parseInt(type.slice(prefix.length), 10) || 0 : 0
  return { n: !!(m & 1), o: !!(m & 2), s: !!(m & 4), w: !!(m & 8) }
}

export function roadSides(type: string): { n: boolean; o: boolean; s: boolean; w: boolean } {
  return sides(type, 'road_')
}

export function riverSides(type: string): { n: boolean; o: boolean; s: boolean; w: boolean } {
  return sides(type, 'river_')
}

export function gridTypes(grid: Cell[][]): string[][] {
  return grid.map(row => row.map(cell => cell.type))
}

export function anomalyAt(grid: Cell[][]): { r: number; c: number } | null {
  for (let r = 0; r < grid.length; r++)
    for (let c = 0; c < grid[r].length; c++)
      if (grid[r][c].anomaly) return { r, c }
  return null
}
