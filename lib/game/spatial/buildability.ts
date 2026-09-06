import type { BuildabilityState, TerrainInspection } from './mapLayers'

export interface PhysicalBuildabilityPolicy {
  maxBuildableSlopeDeg: number
  maxRestrictedSlopeDeg: number
  waterIsBuildable?: boolean
}

export interface PhysicalTerrainCell {
  xM: number
  yM: number
  elevationM?: number
  slopeDeg?: number
  aspectDeg?: number
  isWater?: boolean
  substrateClass?: string
  terrainResolved: boolean
  gridSizeM: number
}

export interface PhysicalBuildabilityResult extends TerrainInspection {
  state: BuildabilityState
}

function assertPolicy(policy: PhysicalBuildabilityPolicy) {
  if (!Number.isFinite(policy.maxBuildableSlopeDeg) || policy.maxBuildableSlopeDeg < 0) {
    throw new Error('maxBuildableSlopeDeg must be non-negative')
  }
  if (!Number.isFinite(policy.maxRestrictedSlopeDeg) || policy.maxRestrictedSlopeDeg < policy.maxBuildableSlopeDeg) {
    throw new Error('maxRestrictedSlopeDeg must be >= maxBuildableSlopeDeg')
  }
}

/**
 * Physical terrain gate for one metric planning cell.
 *
 * This function deliberately contains no project-specific magic thresholds. The
 * caller supplies the canonical build policy for the selected build type/world.
 * Missing terrain is unresolved, water is invalid unless explicitly supported,
 * and slope only classifies a cell once a real terrain sample exists.
 */
export function evaluatePhysicalBuildability(
  cell: PhysicalTerrainCell,
  policy: PhysicalBuildabilityPolicy,
): PhysicalBuildabilityResult {
  assertPolicy(policy)

  const base = {
    xM: cell.xM,
    yM: cell.yM,
    elevationM: cell.elevationM,
    slopeDeg: cell.slopeDeg,
    aspectDeg: cell.aspectDeg,
    substrateClass: cell.substrateClass,
    gridSizeM: cell.gridSizeM,
  }

  if (!cell.terrainResolved || cell.elevationM == null || cell.slopeDeg == null) {
    return {
      ...base,
      buildability: 'unresolved',
      state: 'unresolved',
      buildabilityReason: 'terrain-unresolved',
    }
  }

  if (cell.isWater && !policy.waterIsBuildable) {
    return {
      ...base,
      buildability: 'invalid',
      state: 'invalid',
      buildabilityReason: 'water',
    }
  }

  if (cell.slopeDeg > policy.maxRestrictedSlopeDeg) {
    return {
      ...base,
      buildability: 'invalid',
      state: 'invalid',
      buildabilityReason: 'slope-too-steep',
    }
  }

  if (cell.slopeDeg > policy.maxBuildableSlopeDeg) {
    return {
      ...base,
      buildability: 'restricted',
      state: 'restricted',
      buildabilityReason: 'slope-requires-mitigation',
    }
  }

  return {
    ...base,
    buildability: 'buildable',
    state: 'buildable',
  }
}

export interface UsageRestriction {
  id: string
  state: Exclude<BuildabilityState, 'buildable' | 'unresolved'>
  reason: string
}

/**
 * Adds non-terrain restrictions after the physical gate. Physical invalid or
 * unresolved states always win; usage/infrastructure rules may only downgrade a
 * physically buildable cell.
 */
export function applyUsageRestrictions(
  physical: PhysicalBuildabilityResult,
  restrictions: readonly UsageRestriction[],
): PhysicalBuildabilityResult {
  if (physical.state === 'invalid' || physical.state === 'unresolved') return physical
  if (restrictions.length === 0) return physical

  const invalid = restrictions.find(item => item.state === 'invalid')
  const chosen = invalid ?? restrictions[0]
  return {
    ...physical,
    buildability: chosen.state,
    state: chosen.state,
    buildabilityReason: chosen.reason,
  }
}
