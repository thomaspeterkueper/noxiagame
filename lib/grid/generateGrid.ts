// lib/grid/generateGrid.ts
// Erstellt: 15.06.2026
// Version:  0.5.1
//
// v0.5.1: Earth-Fluss als wirklich zusammenhängender Pfad: vertikale Schritte
//   plus horizontale Connector-Zellen, keine diagonalen Lücken mehr.
// v0.5.0: River-Auto-Tiling (river_<maske>) analog zu Straßen; Wald bekommt
//   einfache Varianten (forest_dense / forest_edge), damit Erde zusammenhängender wirkt.
// v0.4.0: Earth-Terrain sichtbar unterscheidbar: grass / forest / river /
//   urban statt grauer Platzhalterfläche. Ziel: Erde liest sich sofort als Erde.
// v0.3.0: Anomalie nur sichtbar, wenn ein fertiger Scanner (entity_id
//   'scanner') in der Kolonie steht — Entdeckung als Investition.
// v0.2.0: Anomalie-Andeutung (Schritt 8) — seed-bestimmtes anomaly-Flag.
// v0.1.0: Geteilte Grid-Generierung für ColonyGrid + MiniMap.

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
    tileType === 'tile_surface' ||
    tileType === 'tile_grass'   ||
    tileType === 'tile_urban'   ||
    tileType === 'tile_metal'   ||
    tileType === 'tile_crater'  ||
    tileType === 'tile_shaft'   ||
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

function carveEarthRiver(grid: Cell[][], seed: number, cols: number, rows: number): void {
  let col = Math.max(1, Math.min(cols - 2, Math.floor(cols * 0.32)))
  for (let r = 0; r < rows; r++) {
    const driftRoll = seededRandom(seed, 5000 + r)
    const drift = driftRoll < 0.30 ? -1 : driftRoll > 0.70 ? 1 : 0
    const nextCol = Math.max(1, Math.min(cols - 2, col + drift))

    // Hauptzelle dieser Zeile
    grid[r][col] = { type: 'river', owner: null }

    // Wenn der Fluss seitlich wandert, wird in derselben Zeile ein horizontaler
    // Anschluss gesetzt. Dadurch entsteht eine orthogonale Verbindung statt
    // eines diagonalen Sprungs.
    if (nextCol !== col) {
      const from = Math.min(col, nextCol)
      const to = Math.max(col, nextCol)
      for (let cc = from; cc <= to; cc++) grid[r][cc] = { type: 'river', owner: null }
    }

    col = nextCol
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
  const centerR = Math.floor(rows / 2)
  const centerC = Math.floor(cols / 2)

  // 1. Terrain-Grundfläche
  for (let r = 0; r < rows; r++) {
    const row: Cell[] = []
    for (let c = 0; c < cols; c++) {
      const rand = seededRandom(seed, r * cols + c)
      let t: string
      if (slug === 'earth') {
        if (rand < 0.16) t = 'tile_forest_dense'
        else if (rand < 0.31) t = 'tile_forest_edge'
        else if (rand < 0.40) t = 'tile_urban'
        else if (rand < 0.45) t = 'tile_surface'
        else t = 'tile_grass'
      } else if (slug === 'moon') {
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

  // Erde: Fluss als eigener zusammenhängender Pfad, danach maskieren.
  if (slug === 'earth') {
    carveEarthRiver(grid, seed, cols, rows)
    autotilePrefix(grid, 'river', 'river_')
  }

  // 2. Belegte Positionen aussparen
  const occupied = new Set<string>()
  for (const e of entities) occupied.add(`${e.tile_row}-${e.tile_col}`)
  for (const p of pending)  occupied.add(`${p.tile_row}-${p.tile_col}`)

  const flat: [number, number][] = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (isBuildable(grid[r][c].type) && !occupied.has(`${r}-${c}`))
        flat.push([r, c])
  flat.sort((a, b) =>
    (Math.abs(a[0] - centerR) + Math.abs(a[1] - centerC)) -
    (Math.abs(b[0] - centerR) + Math.abs(b[1] - centerC))
  )

  // 3. NPC-Bauten
  const npcCount = Math.min(Math.floor(population / 150), Math.floor(flat.length * 0.5))
  for (let i = 0; i < npcCount; i++) {
    const [r, c] = flat[i]
    const v = seededRandom(seed, 999 + r * cols + c)
    const type = v < 0.12 ? 'npc_mine' : v < 0.22 ? 'npc_solar' : 'npc_habitat'
    grid[r][c] = { type, owner: userId ? 'state' : null }
  }

  // 4. Straßennetz
  if (population > 200) {
    for (let c = 0; c < cols; c++)
      if (isBuildable(grid[centerR][c].type)) grid[centerR][c] = { type: 'road', owner: userId ? 'state' : null }

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

  // 5. Bestand
  for (const e of entities) {
    if (e.tile_row >= 0 && e.tile_row < rows && e.tile_col >= 0 && e.tile_col < cols) {
      const owner: CellOwner = !userId
        ? null
        : e.is_state_owned || e.profile_id === null
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

  // 7. Straßen-Auto-Tiling
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

  // 8. Anomalie
  const hasScanner = entities.some(e => e.entity_type === 'building' && e.entity_id === 'scanner')
  if (hasScanner) {
    const terrainCells: [number, number][] = []
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const t = grid[r][c].type
        if (!t.startsWith('building_') && !t.startsWith('npc_') && !t.startsWith('road'))
          terrainCells.push([r, c])
      }
    if (terrainCells.length > 0) {
      const pick = Math.floor(seededRandom(seed, 7777) * terrainCells.length)
      const [ar, ac] = terrainCells[pick]
      grid[ar][ac] = { ...grid[ar][ac], anomaly: true }
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
