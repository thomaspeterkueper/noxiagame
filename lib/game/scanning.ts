// lib/game/scanning.ts
// Canonical scanner pipeline for NOXIA.
// Ground Truth -> Measurement -> Interpretation -> Discovery
// Pure domain logic: no browser storage, React, Three.js or Supabase access.

export const SCANNER_BASE_RADIUS = 4

export type ScannerSignalKind =
  | 'geological_structure'
  | 'volatile_signature'
  | 'mineral_signature'
  | 'subsurface_void'

export interface GridPoint {
  row: number
  col: number
}

export interface ScannerGroundTruth extends GridPoint {
  key: string
  kind: ScannerSignalKind
  sourceType: string
}

export interface ScannerMeasurement {
  origin: GridPoint
  radius: number
  coveredCells: GridPoint[]
  signals: Array<ScannerGroundTruth & { strength: number }>
}

export interface ScannerInterpretation {
  groundTruthKey: string
  label: string
  confidence: 'low' | 'medium'
  evidence: string
}

export interface ScannerDiscovery extends GridPoint {
  groundTruthKey: string
  kind: ScannerSignalKind
  sourceType: string
  interpretation: ScannerInterpretation
}

const SIGNAL_BY_TERRAIN: Partial<Record<string, ScannerSignalKind>> = {
  tile_crater: 'geological_structure',
  tile_canyon: 'geological_structure',
  tile_ice: 'volatile_signature',
  tile_helium3: 'mineral_signature',
  tile_titanium: 'mineral_signature',
  tile_metal: 'mineral_signature',
  tile_shaft: 'subsurface_void',
}

export function groundTruthFromTerrain(terrain: string[][]): ScannerGroundTruth[] {
  const truth: ScannerGroundTruth[] = []
  for (let row = 0; row < terrain.length; row += 1) {
    for (let col = 0; col < (terrain[row]?.length ?? 0); col += 1) {
      const sourceType = terrain[row][col]
      const kind = SIGNAL_BY_TERRAIN[sourceType]
      if (!kind) continue
      truth.push({
        key: `terrain:${row}:${col}:${sourceType}`,
        row,
        col,
        kind,
        sourceType,
      })
    }
  }
  return truth
}

export function cellsInRadius(origin: GridPoint, radius: number, rows: number, cols: number): GridPoint[] {
  const cells: GridPoint[] = []
  for (let row = Math.max(0, origin.row - radius); row <= Math.min(rows - 1, origin.row + radius); row += 1) {
    for (let col = Math.max(0, origin.col - radius); col <= Math.min(cols - 1, origin.col + radius); col += 1) {
      const dr = row - origin.row
      const dc = col - origin.col
      if (Math.hypot(dr, dc) <= radius) cells.push({ row, col })
    }
  }
  return cells
}

export function measureScanner(args: {
  origin: GridPoint
  radius?: number
  rows: number
  cols: number
  groundTruth: ScannerGroundTruth[]
}): ScannerMeasurement {
  const radius = args.radius ?? SCANNER_BASE_RADIUS
  const coveredCells = cellsInRadius(args.origin, radius, args.rows, args.cols)
  const covered = new Set(coveredCells.map(cell => `${cell.row}:${cell.col}`))
  const signals = args.groundTruth
    .filter(item => covered.has(`${item.row}:${item.col}`))
    .map(item => {
      const distance = Math.hypot(item.row - args.origin.row, item.col - args.origin.col)
      const strength = Math.max(0.2, 1 - distance / Math.max(1, radius + 0.5))
      return { ...item, strength: Number(strength.toFixed(3)) }
    })
  return { origin: args.origin, radius, coveredCells, signals }
}

export function interpretMeasurement(measurement: ScannerMeasurement): ScannerInterpretation[] {
  return measurement.signals.map(signal => {
    switch (signal.kind) {
      case 'volatile_signature':
        return { groundTruthKey: signal.key, label: 'Flüchtige Materialsignatur', confidence: signal.strength >= 0.65 ? 'medium' : 'low', evidence: 'Spektrale und strukturelle Signatur im Messfeld' }
      case 'mineral_signature':
        return { groundTruthKey: signal.key, label: 'Mineralogische Signatur', confidence: signal.strength >= 0.65 ? 'medium' : 'low', evidence: 'Materialsignatur im Messfeld' }
      case 'subsurface_void':
        return { groundTruthKey: signal.key, label: 'Möglicher Hohlraum', confidence: signal.strength >= 0.65 ? 'medium' : 'low', evidence: 'Geometrische Abweichung im Untergrundsignal' }
      default:
        return { groundTruthKey: signal.key, label: 'Geologische Struktur', confidence: signal.strength >= 0.65 ? 'medium' : 'low', evidence: 'Topografisch-geologische Struktur im Messfeld' }
    }
  })
}

export function discoveriesFromMeasurement(measurement: ScannerMeasurement): ScannerDiscovery[] {
  const interpretations = new Map(interpretMeasurement(measurement).map(item => [item.groundTruthKey, item]))
  return measurement.signals.map(signal => ({
    groundTruthKey: signal.key,
    row: signal.row,
    col: signal.col,
    kind: signal.kind,
    sourceType: signal.sourceType,
    interpretation: interpretations.get(signal.key)!,
  }))
}

export function mergeDiscoveries(existing: ScannerDiscovery[], incoming: ScannerDiscovery[]): ScannerDiscovery[] {
  const merged = new Map(existing.map(item => [item.groundTruthKey, item]))
  for (const item of incoming) merged.set(item.groundTruthKey, item)
  return [...merged.values()]
}
