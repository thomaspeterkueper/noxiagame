// lib/game/scanner/domain.ts
// Pure NOXIA scanner domain. No React, Three.js, LocalStorage or persistence.

export type ScannerGroundTruth = {
  subjectId: string
  locationId: string
  kind: string
  signal: number
  discoverable: boolean
  tile?: { row: number; col: number }
}

export type ScannerMeasurement = {
  subjectId: string
  locationId: string
  measuredSignal: number
  quality: number
}

export type ScannerInterpretation = {
  subjectId: string
  locationId: string
  confidence: number
  classification: 'insufficient' | 'candidate' | 'confirmed'
  explanation: string
}

export type ScannerDiscovery = {
  discoveryKey: string
  subjectId: string
  locationId: string
  kind: string
  tile?: { row: number; col: number }
  confidence: number
}

export type ScannerPipelineResult = {
  groundTruth: ScannerGroundTruth
  measurement: ScannerMeasurement
  interpretation: ScannerInterpretation
  discovery: ScannerDiscovery | null
}

export type ScannerConfig = {
  sensitivity: number
  confirmationThreshold: number
}

export const DEFAULT_SCANNER_CONFIG: ScannerConfig = {
  sensitivity: 1,
  confirmationThreshold: 0.72,
}

function clamp01(value: number) { return Math.max(0, Math.min(1, value)) }

export function measureGroundTruth(truth: ScannerGroundTruth, config = DEFAULT_SCANNER_CONFIG): ScannerMeasurement {
  // Deterministic by design. Environmental/noise models may later be injected,
  // but Ground Truth itself is never mutated by measurement.
  const measuredSignal = clamp01(truth.signal * config.sensitivity)
  return { subjectId: truth.subjectId, locationId: truth.locationId, measuredSignal, quality: clamp01(config.sensitivity) }
}

export function interpretMeasurement(measurement: ScannerMeasurement, config = DEFAULT_SCANNER_CONFIG): ScannerInterpretation {
  const confidence = clamp01(measurement.measuredSignal * measurement.quality)
  if (confidence >= config.confirmationThreshold) return { ...measurement, confidence, classification: 'confirmed', explanation: 'Messsignal überschreitet die Bestätigungsschwelle.' }
  if (confidence >= config.confirmationThreshold * 0.55) return { ...measurement, confidence, classification: 'candidate', explanation: 'Messsignal ist plausibel, aber die Evidenz reicht noch nicht für eine Entdeckung.' }
  return { ...measurement, confidence, classification: 'insufficient', explanation: 'Messsignal reicht für eine belastbare Interpretation nicht aus.' }
}

export function deriveDiscovery(truth: ScannerGroundTruth, interpretation: ScannerInterpretation): ScannerDiscovery | null {
  if (!truth.discoverable || interpretation.classification !== 'confirmed') return null
  return {
    discoveryKey: `${truth.locationId}:${truth.subjectId}`,
    subjectId: truth.subjectId,
    locationId: truth.locationId,
    kind: truth.kind,
    tile: truth.tile,
    confidence: interpretation.confidence,
  }
}

export function runScannerPipeline(truth: ScannerGroundTruth, config = DEFAULT_SCANNER_CONFIG): ScannerPipelineResult {
  const measurement = measureGroundTruth(truth, config)
  const interpretation = interpretMeasurement(measurement, config)
  return { groundTruth: truth, measurement, interpretation, discovery: deriveDiscovery(truth, interpretation) }
}

export function mergeDiscoveries(existing: ScannerDiscovery[], incoming: ScannerDiscovery[]): ScannerDiscovery[] {
  const merged = new Map(existing.map(item => [item.discoveryKey, item]))
  for (const item of incoming) {
    const previous = merged.get(item.discoveryKey)
    if (!previous || item.confidence > previous.confidence) merged.set(item.discoveryKey, item)
  }
  return [...merged.values()]
}
