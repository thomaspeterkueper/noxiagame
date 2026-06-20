// lib/grid/generateGrid.ts
// Erstellt: 15.06.2026
// Version:  0.3.0
//
// v0.3.0: Anomalie nur sichtbar, wenn ein fertiger Scanner (entity_id
//   'scanner') in der Kolonie steht — Entdeckung als Investition.
// v0.2.0: Anomalie-Andeutung (Schritt 8) — seed-bestimmtes anomaly-Flag.
// v0.1.0: Geteilte Grid-Generierung für ColonyGrid + MiniMap.
//
// Geteilte Grid-Generierung für ColonyGrid (großes Grid) UND MiniMap.
// Vorher war die Logik in beiden Dateien dupliziert und driftete auseinander.
// Eine Quelle, beide importieren sie.
//
// Rückgabe: Cell[][] mit { type, owner }. ColonyGrid kann via gridTypes()
// auf reine Typ-Strings reduzieren, wenn es die einfache Form braucht.
//
// NPC-Bauten werden per Seed variiert (npc_mine / npc_solar / npc_habitat) —
// nur Optik, deterministisch. Beide Grids zeigen damit dasselbe Bild.

export const COLS = 12
export const ROWS = 8

export type CellOwner = 'own' | 'other' | null

export interface Cell {
  type:     string
  owner:    CellOwner
  anomaly?: boolean   // seed-bestimmte Anomalie auf Terrain (kosmetische USP-Andeutung)
}

export interface GridEntity {
  entity_id:   string
  profile_id:  string
  entity_type: string
  tile_row:    number
  tile_col:    number
}

export interface GridPending {
  buildable_id: string
  tile_row:     number
  tile_col:     number
  status:       string   // 'building' | 'selling'
}

export function seededRandom(seed: number, i: number): number {
  const x = Math.sin(seed + i) * 10000
  return x - Math.floor(x)
}

export function isBuildable(tileType: string): boolean {
  return tileType === 'tile_surface' || tileType === 'tile_metal'
}

// NPC-Bautyp → entity_id (fürs Sprite-Rendering in beiden Grids)
export const NPC_ENTITY: Record<string, string> = {
  npc_mine:    'mine',
  npc_solar:   'solar',
  npc_habitat: 'habitat',
}

export function generateGrid(
  slug:       string,
  population: number,
  entities:   GridEntity[],
  pending:    GridPending[],
  userId?:    string,            // optional: setzt owner 'own'/'other' für Bestand
  cols:       number = COLS,
  rows:       number = ROWS,
): Cell[][] {
  const grid: Cell[][] = []
  const seed = slug.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const centerR = Math.floor(rows / 2)
  const centerC = Math.floor(cols / 2)

  // 1. Terrain (deterministisch)
  for (let r = 0; r < rows; r++) {
    const row: Cell[] = []
    for (let c = 0; c < cols; c++) {
      const rand = seededRandom(seed, r * cols + c)
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

  // 2. Belegte Positionen (Bestand + Vorgänge) aussparen
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

  // 3. NPC-Bauten nach Bevölkerung, Typ per Seed variiert (Optik)
  const npcCount = Math.min(Math.floor(population / 150), Math.floor(flat.length * 0.5))
  for (let i = 0; i < npcCount; i++) {
    const [r, c] = flat[i]
    const v = seededRandom(seed, 999 + r * cols + c)
    const type = v < 0.12 ? 'npc_mine' : v < 0.22 ? 'npc_solar' : 'npc_habitat'
    grid[r][c] = { type, owner: null }
  }

  // 4. Straßennetz: ruhiges Raster einer geplanten Kolonie.
  //    Eine horizontale Hauptachse (Mittelzeile) + wenige vertikale
  //    Querstraßen in festen Abständen — unabhängig von NPC-Positionen,
  //    damit das Netz lesbar bleibt (kein Stichweg-Kabelsalat).
  //    Auto-Tiling unten löst die Segmente auf.
  if (population > 200) {
    // Hauptachse
    for (let c = 0; c < cols; c++)
      if (isBuildable(grid[centerR][c].type)) grid[centerR][c] = { type: 'road', owner: null }

    // Querstraßen alle 4 Spalten (feste Abstände → Rasteroptik)
    const span = Math.min(Math.floor(population / 400) + 1, 3)  // 1–3 Querstraßen je nach Größe
    for (let q = 1; q <= span; q++) {
      const qc = Math.round((cols * q) / (span + 1))
      // Querstraße läuft nur ein Stück nach oben/unten von der Hauptachse (kompakt)
      const reach = 2 + Math.floor(population / 600)
      for (let r = centerR - reach; r <= centerR + reach; r++) {
        if (r < 0 || r >= rows) continue
        if (isBuildable(grid[r][qc].type)) grid[r][qc] = { type: 'road', owner: null }
      }
    }
  }

  // 5. Bestand (echte Gebäude) — überschreibt, mit Eigentümer-Markierung
  for (const e of entities) {
    if (e.tile_row >= 0 && e.tile_row < rows && e.tile_col >= 0 && e.tile_col < cols) {
      const owner: CellOwner = userId ? (e.profile_id === userId ? 'own' : 'other') : null
      grid[e.tile_row][e.tile_col] = { type: `building_${e.entity_id}`, owner }
    }
  }

  // 6. Laufende Vorgänge: Baustelle / „wird verkauft"
  for (const p of pending) {
    if (p.tile_row >= 0 && p.tile_row < rows && p.tile_col >= 0 && p.tile_col < cols) {
      grid[p.tile_row][p.tile_col] = {
        type: p.status === 'building' ? 'building_construction' : `building_${p.buildable_id}`,
        owner: null,
      }
    }
  }

  // 7. Auto-Tiling: jede 'road'-Kachel in einen konkreten Segmenttyp auflösen.
  //    Bitmaske der verbundenen Seiten: N=1, O=2, S=4, W=8 → road_<maske>.
  //    Beide Renderer (TileSVG, MiniMap) zeichnen aus derselben Maske.
  const isRoad = (r: number, c: number) =>
    r >= 0 && r < rows && c >= 0 && c < cols && grid[r][c].type.startsWith('road')
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c].type !== 'road') continue
      let mask = 0
      if (isRoad(r - 1, c)) mask |= 1   // N
      if (isRoad(r, c + 1)) mask |= 2   // O
      if (isRoad(r + 1, c)) mask |= 4   // S
      if (isRoad(r, c - 1)) mask |= 8   // W
      grid[r][c] = { type: `road_${mask}`, owner: null }
    }
  }

  // 8. Anomalie (USP-Andeutung): nur sichtbar, wenn ein Scanner FERTIG in der
  //    Kolonie steht (entity_id 'scanner' im Bestand). Ohne Scanner verborgen.
  //    Eine seed-bestimmte freie Terrain-Kachel trägt die Anomalie.
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

// Verbundene Seiten einer Straßenkachel aus dem Segmenttyp (road_<maske>).
// Liefert { n, o, s, w } — fürs Rendern in beiden Grids.
export function roadSides(type: string): { n: boolean; o: boolean; s: boolean; w: boolean } {
  const m = type.startsWith('road_') ? parseInt(type.slice(5), 10) || 0 : 0
  return { n: !!(m & 1), o: !!(m & 2), s: !!(m & 4), w: !!(m & 8) }
}

// Hilfsform für Konsumenten, die nur Typ-Strings brauchen (ColonyGrid-Altpfad).
export function gridTypes(grid: Cell[][]): string[][] {
  return grid.map(row => row.map(cell => cell.type))
}

// Anomalie-Koordinate aus dem Cell[][] ziehen (oder null). Für Konsumenten,
// die mit der reduzierten string[][]-Form arbeiten (ColonyGrid).
export function anomalyAt(grid: Cell[][]): { r: number; c: number } | null {
  for (let r = 0; r < grid.length; r++)
    for (let c = 0; c < grid[r].length; c++)
      if (grid[r][c].anomaly) return { r, c }
  return null
}
