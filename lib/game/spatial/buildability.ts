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
 * Thresholds belong to the selected build policy/world and are never invented
 * by the renderer. Missing terrain remains unresolved.
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
    return { ...base, buildability: 'unresolved', state: 'unresolved', buildabilityReason: 'terrain-unresolved' }
  }
  if (cell.isWater && !policy.waterIsBuildable) {
    return { ...base, buildability: 'invalid', state: 'invalid', buildabilityReason: 'water' }
  }
  if (cell.slopeDeg > policy.maxRestrictedSlopeDeg) {
    return { ...base, buildability: 'invalid', state: 'invalid', buildabilityReason: 'slope-too-steep' }
  }
  if (cell.slopeDeg > policy.maxBuildableSlopeDeg) {
    return { ...base, buildability: 'restricted', state: 'restricted', buildabilityReason: 'slope-requires-mitigation' }
  }
  return { ...base, buildability: 'buildable', state: 'buildable' }
}

export interface UsageRestriction {
  id: string
  state: Exclude<BuildabilityState, 'buildable' | 'unresolved'>
  reason: string
}

/**
 * Applies infrastructure/land-use constraints after the physical gate.
 * Physical invalid/unresolved always wins. A physical restriction also stays
 * restricted unless a later rule makes it fully invalid.
 */
export function applyUsageRestrictions(
  physical: PhysicalBuildabilityResult,
  restrictions: readonly UsageRestriction[],
): PhysicalBuildabilityResult {
  if (physical.state === 'invalid' || physical.state === 'unresolved' || restrictions.length === 0) return physical

  const invalid = restrictions.find(item => item.state === 'invalid')
  if (invalid) {
    return { ...physical, buildability: 'invalid', state: 'invalid', buildabilityReason: invalid.reason }
  }

  if (physical.state === 'restricted') return physical
  const restricted = restrictions.find(item => item.state === 'restricted')
  if (!restricted) return physical
  return { ...physical, buildability: 'restricted', state: 'restricted', buildabilityReason: restricted.reason }
}
