// lib/game/world/biosphereState.ts
//
// Dynamic biological function is deliberately separate from static land-cover.
// This module adds no scheduler or persistence authority: callers advance it from
// NOXIA's existing authoritative tick and persist through existing server/state boundaries.

export type PhenologyState =
  | 'dormant'
  | 'emergence'
  | 'vegetative'
  | 'reproductive'
  | 'senescent'
  | 'evergreen'
  | 'unknown'

export interface BiosphereFunctionalState {
  vegetationType: string
  photosyntheticActivity: number
  waterStress: number
  heatStress: number
  phenologyState: PhenologyState
  biomassState: number
  soilMoisture: number | null
  tick: number
  sourceRef: string
}

export interface BiosphereForcing {
  /** 0..1 usable illumination after day length/cloud/geometry adapters. */
  solarAvailability: number
  /** 0..1 root-zone water availability. */
  waterAvailability: number
  /** 0..1 thermal suitability; 1 means no heat/cold limitation. */
  thermalSuitability: number
  /** 0..1 species/land-cover specific phenological activity factor. */
  phenologyFactor: number
  /** 0..1 remaining functional capacity after disease/disturbance. */
  disturbanceFactor: number
  /** Optional independently modelled local soil/root-zone store. */
  soilMoisture?: number | null
  phenologyState?: PhenologyState
  sourceRef: string
}

export interface BiosphereTransitionConfig {
  /** Fraction of the gap to the forcing-defined target resolved per shared simulation tick. */
  activityResponseFraction: number
  stressResponseFraction: number
  /** Normalized standing-biomass increment per unit activity per tick. */
  biomassGrowthFraction: number
  /** Normalized turnover pressure per unit combined stress per tick. */
  biomassTurnoverFraction: number
}

export interface SifObservation {
  kind: 'solar_induced_fluorescence'
  /** Raw/retrieved observation value; never interpreted as photosynthetic activity by this type. */
  value: number
  unit: string
  observedAt: string
  sourceRef: string
  footprint?: {
    spatialResolutionM?: number | null
    geometryRef?: string | null
  }
}

export interface CalibratedBiosphereObservation {
  /** Derived biological proxy after a named retrieval/calibration model. */
  photosyntheticActivityProxy: number
  sourceObservationRef: string
  calibrationModelRef: string
  uncertainty?: number | null
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) throw new Error('biosphere normalized values must be finite')
  return Math.max(0, Math.min(1, value))
}

function requireSourceRef(sourceRef: string, label: string): string {
  const value = sourceRef.trim()
  if (!value) throw new Error(`${label} requires sourceRef provenance`)
  return value
}

function approach(current: number, target: number, fraction: number): number {
  const f = clamp01(fraction)
  return clamp01(current + (target - current) * f)
}

export function createBiosphereFunctionalState(input: {
  vegetationType: string
  photosyntheticActivity?: number
  waterStress?: number
  heatStress?: number
  phenologyState?: PhenologyState
  biomassState?: number
  soilMoisture?: number | null
  tick: number
  sourceRef: string
}): BiosphereFunctionalState {
  const vegetationType = input.vegetationType.trim()
  if (!vegetationType) throw new Error('biosphere state requires vegetationType')
  if (!Number.isInteger(input.tick) || input.tick < 0) throw new Error('biosphere state requires a non-negative integer tick')

  return {
    vegetationType,
    photosyntheticActivity: clamp01(input.photosyntheticActivity ?? 0),
    waterStress: clamp01(input.waterStress ?? 0),
    heatStress: clamp01(input.heatStress ?? 0),
    phenologyState: input.phenologyState ?? 'unknown',
    biomassState: clamp01(input.biomassState ?? 0),
    soilMoisture: input.soilMoisture == null ? null : clamp01(input.soilMoisture),
    tick: input.tick,
    sourceRef: requireSourceRef(input.sourceRef, 'biosphere state'),
  }
}

/**
 * Reference transition for the shared NOXIA tick.
 *
 * Coefficients are supplied by the caller/configuration so this scientific
 * state model does not silently impose gameplay balancing constants.
 */
export function advanceBiosphereState(
  previous: BiosphereFunctionalState,
  forcing: BiosphereForcing,
  config: BiosphereTransitionConfig,
  tick: number,
): BiosphereFunctionalState {
  if (!Number.isInteger(tick) || tick <= previous.tick) {
    throw new Error('biosphere transition tick must advance monotonically')
  }
  const sourceRef = requireSourceRef(forcing.sourceRef, 'biosphere forcing')

  const solar = clamp01(forcing.solarAvailability)
  const water = clamp01(forcing.waterAvailability)
  const thermal = clamp01(forcing.thermalSuitability)
  const phenology = clamp01(forcing.phenologyFactor)
  const disturbance = clamp01(forcing.disturbanceFactor)

  // Multiplicative limiting-factor model: poor state in one required domain
  // can depress current function without mutating the underlying vegetation class.
  const targetActivity = clamp01(solar * water * thermal * phenology * disturbance)
  const targetWaterStress = 1 - water
  const targetHeatStress = 1 - thermal

  const photosyntheticActivity = approach(
    previous.photosyntheticActivity,
    targetActivity,
    config.activityResponseFraction,
  )
  const waterStress = approach(previous.waterStress, targetWaterStress, config.stressResponseFraction)
  const heatStress = approach(previous.heatStress, targetHeatStress, config.stressResponseFraction)

  const growth = photosyntheticActivity * clamp01(config.biomassGrowthFraction)
  const combinedStress = clamp01((waterStress + heatStress) / 2)
  const turnover = combinedStress * clamp01(config.biomassTurnoverFraction)
  const biomassState = clamp01(previous.biomassState + growth - turnover)

  return {
    vegetationType: previous.vegetationType,
    photosyntheticActivity,
    waterStress,
    heatStress,
    phenologyState: forcing.phenologyState ?? previous.phenologyState,
    biomassState,
    soilMoisture: forcing.soilMoisture == null ? previous.soilMoisture : clamp01(forcing.soilMoisture),
    tick,
    sourceRef,
  }
}

/**
 * Raw SIF remains an observation. A calibrated biological proxy requires an
 * explicit model reference and cannot be produced by accidental field aliasing.
 */
export function calibrateSifObservation(
  observation: SifObservation,
  input: { photosyntheticActivityProxy: number; calibrationModelRef: string; uncertainty?: number | null },
): CalibratedBiosphereObservation {
  if (observation.kind !== 'solar_induced_fluorescence') throw new Error('unsupported biosphere observation')
  requireSourceRef(observation.sourceRef, 'SIF observation')
  const calibrationModelRef = requireSourceRef(input.calibrationModelRef, 'SIF calibration')

  return {
    photosyntheticActivityProxy: clamp01(input.photosyntheticActivityProxy),
    sourceObservationRef: observation.sourceRef,
    calibrationModelRef,
    uncertainty: input.uncertainty == null ? null : Math.max(0, input.uncertainty),
  }
}
