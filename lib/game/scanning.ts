// lib/game/scanning.ts
// Erstellt:     24.07.2026
// Aktualisiert: 31.08.2026 — persistenter Discovery-State + clientseitiger Runtime-Cache
// Version:      0.2.0
//
// Scanner-Domänenmodell für den ersten NOXIA-Vertical-Slice.
// Ground Truth, Messung, Interpretation und Entdeckung bleiben getrennt.
// Wissen erzeugt keine Anomalien; es kann später nur Interpretationen vertiefen.

export const SCANNER_BASE_RADIUS = 4
export const SCAN_STORAGE_VERSION = 1
export const SCANNER_SESSION_CLOSED_EVENT = 'noxia:scanner-session-closed'

export interface GridPoint {
  row: number
  col: number
}

export interface GroundTruthAnomaly extends GridPoint {
  id: string
  locationSlug: string
  kind: 'geological_anomaly'
  strength: number
}

export interface ScannerMeasurement {
  id: string
  locationSlug: string
  scannerEntityId: string
  origin: GridPoint
  radius: number
  measuredAt: string
  coveredCells: GridPoint[]
  signals: Array<{
    groundTruthId: string
    row: number
    col: number
    signalClass: 'unknown_subsurface'
    strength: number
  }>
}

export interface ScannerInterpretation {
  measurementId: string
  level: 'anomaly_only'
  label: 'Geologische Anomalie'
  confidence: 'low'
}

export interface ScannerDiscovery extends GridPoint {
  groundTruthId: string
  measurementId: string
  interpretation: ScannerInterpretation
}

export interface StoredScanState {
  version: number
  latestMeasurement: ScannerMeasurement
  discoveries: ScannerDiscovery[]
}

const runtimeDiscoveries = new Map<string, ScannerDiscovery[]>()

function hashText(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function unit(seed: number): number {
  let x = seed >>> 0
  x ^= x << 13
  x ^= x >>> 17
  x ^= x << 5
  return (x >>> 0) / 4294967296
}

/**
 * Deterministische Ground Truth, unabhängig davon, ob ein Scanner gebaut wurde.
 * Später wird diese Funktion durch persistente planetare Deposits/Anomalien ersetzt.
 */
export function groundTruthForLocation(locationSlug: string, rows: number, cols: number): GroundTruthAnomaly[] {
  const seed = hashText(`noxia:ground-truth:${locationSlug}`)
  const row = Math.min(rows - 1, Math.floor(unit(seed + 101) * rows))
  const col = Math.min(cols - 1, Math.floor(unit(seed + 211) * cols))
  return [{
    id: `gt:${locationSlug}:geo:001`,
    locationSlug,
    row,
    col,
    kind: 'geological_anomaly',
    strength: 0.55 + unit(seed + 307) * 0.4,
  }]
}

export function cellsInRadius(origin: GridPoint, radius: number, rows: number, cols: number): GridPoint[] {
  const cells: GridPoint[] = []
  for (let row = Math.max(0, origin.row - radius); row <= Math.min(rows - 1, origin.row + radius); row++) {
    for (let col = Math.max(0, origin.col - radius); col <= Math.min(cols - 1, origin.col + radius); col++) {
      const dr = row - origin.row
      const dc = col - origin.col
      if (Math.sqrt(dr * dr + dc * dc) <= radius) cells.push({ row, col })
    }
  }
  return cells
}

export function runScannerMeasurement(args: {
  locationSlug: string
  scannerEntityId: string
  origin: GridPoint
  rows: number
  cols: number
  radius?: number
  measuredAt?: string
}): { measurement: ScannerMeasurement; discoveries: ScannerDiscovery[] } {
  const radius = args.radius ?? SCANNER_BASE_RADIUS
  const measuredAt = args.measuredAt ?? new Date().toISOString()
  const coveredCells = cellsInRadius(args.origin, radius, args.rows, args.cols)
  const covered = new Set(coveredCells.map(cell => `${cell.row},${cell.col}`))
  const truth = groundTruthForLocation(args.locationSlug, args.rows, args.cols)
  const detected = truth.filter(item => covered.has(`${item.row},${item.col}`))

  const measurement: ScannerMeasurement = {
    id: `measurement:${args.scannerEntityId}:${Date.parse(measuredAt)}`,
    locationSlug: args.locationSlug,
    scannerEntityId: args.scannerEntityId,
    origin: args.origin,
    radius,
    measuredAt,
    coveredCells,
    signals: detected.map(item => ({
      groundTruthId: item.id,
      row: item.row,
      col: item.col,
      signalClass: 'unknown_subsurface' as const,
      strength: item.strength,
    })),
  }

  const discoveries: ScannerDiscovery[] = detected.map(item => ({
    groundTruthId: item.id,
    measurementId: measurement.id,
    row: item.row,
    col: item.col,
    interpretation: {
      measurementId: measurement.id,
      level: 'anomaly_only',
      label: 'Geologische Anomalie',
      confidence: 'low',
    },
  }))

  return { measurement, discoveries }
}

export function scanStorageKey(locationSlug: string): string {
  return `noxia:scan-state:v${SCAN_STORAGE_VERSION}:${locationSlug}`
}

export function setRuntimeDiscoveries(locationSlug: string, discoveries: ScannerDiscovery[]): void {
  runtimeDiscoveries.set(locationSlug, [...discoveries])
}

export function runtimeDiscoveriesForLocation(locationSlug: string): ScannerDiscovery[] {
  return runtimeDiscoveries.get(locationSlug) ?? []
}

export function saveScanState(locationSlug: string, state: Omit<StoredScanState, 'version'>): void {
  setRuntimeDiscoveries(locationSlug, state.discoveries)
  if (typeof window === 'undefined') return
  window.localStorage.setItem(scanStorageKey(locationSlug), JSON.stringify({ version: SCAN_STORAGE_VERSION, ...state }))
}

export function loadScanState(locationSlug: string): StoredScanState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(scanStorageKey(locationSlug))
    if (!raw) {
      setRuntimeDiscoveries(locationSlug, [])
      return null
    }
    const parsed = JSON.parse(raw) as StoredScanState
    if (parsed.version !== SCAN_STORAGE_VERSION) return null
    setRuntimeDiscoveries(locationSlug, parsed.discoveries ?? [])
    return parsed
  } catch {
    return null
  }
}
