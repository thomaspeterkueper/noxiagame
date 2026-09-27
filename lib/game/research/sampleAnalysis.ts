import {
  assessObservationCapability,
  type ObservationCapabilityProfile,
  type ObservationRequirement,
} from '@/lib/game/population/observationCapability'

const CONFIDENCE_WEIGHT: Record<string, number> = { 'very-low': 0.45, low: 0.60, medium: 0.75, high: 0.90 }
const TIER_WEIGHT: Record<string, number> = { trace: 0.45, viable: 0.68, rich: 0.82, exceptional: 0.94 }

export type SampleFinding = 'confirmed' | 'inconclusive' | 'rejected'
export type DevelopmentStatus = 'blocked' | 'drilling_authorized' | 'extraction_candidate'
export type SampleKind = 'regolith_reference' | 'drill_core' | string

export type SampleAnalysisInput = {
  resourceType: string
  abundance: number
  tier: string
  confidence: string
  sampleKind?: SampleKind
}

function clamp01(value: number) { return Math.max(0, Math.min(1, value)) }
function isCoreSample(sampleKind?: string) { return sampleKind === 'drill_core' }

export function stickneyInstrumentProfile(resourceType: string, sampleKind: SampleKind = 'regolith_reference'): ObservationCapabilityProfile {
  if (isCoreSample(sampleKind)) {
    return resourceType === 'water'
      ? {
          instrumentType: 'stickney-core-lab-xrd-tga-v1',
          observable: 'hydration_signature',
          method: 'xrd+xrf+thermal-desorption',
          environments: ['interior'],
          uncertainty: 0.05,
          detectionLimit: 0.02,
          spatialResolutionMeters: 0.0001,
          energyPerObservation: 14,
          durationTicks: 8,
        }
      : {
          instrumentType: 'stickney-core-lab-xrd-xrf-v1',
          observable: 'metallic_regolith_signature',
          method: 'xrd+xrf+magnetic-susceptibility',
          environments: ['interior'],
          uncertainty: 0.04,
          detectionLimit: 0.015,
          spatialResolutionMeters: 0.0001,
          energyPerObservation: 12,
          durationTicks: 8,
        }
  }
  return resourceType === 'water'
    ? {
        instrumentType: 'stickney-field-lab-multisensor-v1',
        observable: 'hydration_signature',
        method: 'spectroscopy+thermal-desorption',
        environments: ['interior'],
        uncertainty: 0.16,
        detectionLimit: 0.12,
        spatialResolutionMeters: 0.001,
        energyPerObservation: 6,
        durationTicks: 3,
      }
    : {
        instrumentType: 'stickney-field-lab-multisensor-v1',
        observable: 'metallic_regolith_signature',
        method: 'spectroscopy+magnetic-susceptibility',
        environments: ['interior'],
        uncertainty: 0.12,
        detectionLimit: 0.08,
        spatialResolutionMeters: 0.001,
        energyPerObservation: 5,
        durationTicks: 3,
      }
}

export function stickneyObservationRequirement(resourceType: string, sampleKind: SampleKind = 'regolith_reference'): ObservationRequirement {
  if (isCoreSample(sampleKind)) {
    return resourceType === 'water'
      ? { observable: 'hydration_signature', environment: 'interior', maxUncertainty: 0.08, maxDetectionLimit: 0.04, maxSpatialResolutionMeters: 0.001 }
      : { observable: 'metallic_regolith_signature', environment: 'interior', maxUncertainty: 0.07, maxDetectionLimit: 0.03, maxSpatialResolutionMeters: 0.001 }
  }
  return resourceType === 'water'
    ? { observable: 'hydration_signature', environment: 'interior', maxUncertainty: 0.20, maxDetectionLimit: 0.15, maxSpatialResolutionMeters: 0.01 }
    : { observable: 'metallic_regolith_signature', environment: 'interior', maxUncertainty: 0.18, maxDetectionLimit: 0.12, maxSpatialResolutionMeters: 0.01 }
}

export function deriveSampleAnalysis(input: SampleAnalysisInput) {
  const signal = clamp01(Number.isFinite(input.abundance) ? input.abundance : 0)
  const sampleKind = input.sampleKind ?? 'regolith_reference'
  const coreSample = isCoreSample(sampleKind)
  const profile = stickneyInstrumentProfile(input.resourceType, sampleKind)
  const requirement = stickneyObservationRequirement(input.resourceType, sampleKind)
  const capability = assessObservationCapability(profile, requirement)
  const instrumentReliability = clamp01(1 - Number(profile.uncertainty ?? 0.25) - Number(profile.detectionLimit ?? 0.2) * 0.5)
  const quality = coreSample
    ? clamp01(
        (CONFIDENCE_WEIGHT[input.confidence] ?? 0.5) * 0.25
        + (TIER_WEIGHT[input.tier] ?? 0.5) * 0.25
        + instrumentReliability * 0.35
        + 0.15,
      )
    : clamp01(
        (CONFIDENCE_WEIGHT[input.confidence] ?? 0.5) * 0.40
        + (TIER_WEIGHT[input.tier] ?? 0.5) * 0.35
        + instrumentReliability * 0.25,
      )

  let finding: SampleFinding
  if (!capability.sufficient) finding = 'inconclusive'
  else if (signal >= 0.34 && quality >= 0.55) finding = 'confirmed'
  else if (signal < 0.16 && quality >= 0.40) finding = 'rejected'
  else finding = 'inconclusive'

  const developmentStatus: DevelopmentStatus = !capability.sufficient
    ? 'blocked'
    : coreSample && finding === 'confirmed' && quality >= 0.78 && signal >= 0.40
      ? 'extraction_candidate'
      : !coreSample && finding === 'confirmed' && quality >= 0.55 && signal >= 0.34
        ? 'drilling_authorized'
        : 'blocked'

  const composition = input.resourceType === 'water'
    ? { target: 'hydration-bearing-material', hydration_signal_index: signal, dry_matrix_index: clamp01(1 - signal) }
    : { target: 'metal-bearing-regolith', metallic_signal_index: signal, matrix_signal_index: clamp01(1 - signal) }

  return {
    signal,
    quality,
    finding,
    developmentStatus,
    composition,
    evidenceClass: coreSample ? 'direct_core' : 'surface_reference',
    sampleKind,
    capability: {
      sufficient: capability.sufficient,
      gaps: capability.gaps,
      instrumentType: profile.instrumentType,
      observable: profile.observable,
      method: profile.method,
      uncertainty: profile.uncertainty ?? null,
      detectionLimit: profile.detectionLimit ?? null,
    },
  }
}
