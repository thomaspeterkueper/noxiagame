import type { EarthSurfaceRouteAssessment } from '../earthSurfaceLogistics'
import type { MoonRouteAssessment } from '../moonSurfaceLogistics'
import type {
  VehicleCargoLoad,
  VehicleEnergyState,
  VehicleFrame,
  VehicleInstance,
} from './types'

export interface SurfaceTraversalAssessment {
  passable: boolean
  speedMultiplier: number
  energyMultiplier: number
  wearMultiplier: number
  reason?: string
}

export interface SurfaceRouteSegment {
  id: string
  distanceKm: number
  traversal: SurfaceTraversalAssessment
}

/**
 * Engineering-owned operating values. World routing only applies relative multipliers.
 * This remains separate from VehicleFrame until concrete canonical vehicle data exists.
 */
export interface SurfaceOperationProfile {
  energyStoreId: string
  nominalConsumptionPerKm: number
  wearPerOperatingHour: number
}

export interface SurfaceMissionPlan {
  routeId: string
  originInventoryId: string
  destinationInventoryId: string
  segments: readonly SurfaceRouteSegment[]
}

export type SurfaceMissionBlockReason =
  | 'vehicle-not-ready'
  | 'surface-domain-unsupported'
  | 'surface-mobility-missing'
  | 'invalid-route'
  | 'route-blocked'
  | 'cargo-mass-unresolved'
  | 'cargo-capacity-exceeded'
  | 'energy-store-missing'
  | 'energy-profile-invalid'
  | 'insufficient-energy'

export interface SurfaceMissionEstimate {
  feasible: boolean
  blockReasons: SurfaceMissionBlockReason[]
  distanceKm: number
  etaSeconds: number | null
  energyStoreId: string
  energyRequired: number | null
  energyUnit: 'kWh' | 'kg' | 't' | 'game-unit' | null
  cargoMassKg: number | null
  cargoCapacityKg: number
  wearIncrement: number | null
}

export interface SurfaceRouteSnapshot extends Record<string, unknown> {
  kind: 'surface-vehicle-route-v1'
  routeId: string
  passable: true
  distanceKm: number
  etaSeconds: number
  energyStoreId: string
  energyRequired: number
  energyUnit: 'kWh' | 'kg' | 't' | 'game-unit'
  wearIncrement: number
  segmentCount: number
}

export function traversalFromEarthAssessment(assessment: EarthSurfaceRouteAssessment): SurfaceTraversalAssessment {
  return {
    passable: assessment.passable,
    speedMultiplier: assessment.speedMultiplier,
    energyMultiplier: assessment.energyMultiplier,
    wearMultiplier: assessment.wearMultiplier,
    reason: assessment.reason,
  }
}

export function traversalFromMoonAssessment(assessment: MoonRouteAssessment): SurfaceTraversalAssessment {
  return {
    passable: assessment.passable,
    speedMultiplier: assessment.speedMultiplier,
    energyMultiplier: assessment.energyMultiplier,
    // Moon routing does not yet claim an engineering wear model.
    wearMultiplier: 1,
    reason: assessment.reason,
  }
}

function cargoMassKg(cargo: readonly VehicleCargoLoad[]): number | null {
  let total = 0
  for (const item of cargo) {
    if (!Number.isFinite(item.amount) || item.amount < 0) return null
    if (item.unit === 'kg') total += item.amount
    else if (item.unit === 't') total += item.amount * 1000
    else return null
  }
  return total
}

function storeSpec(frame: VehicleFrame, storeId: string) {
  return frame.energyStores.find((store) => store.id === storeId) ?? null
}

function availableEnergy(instance: VehicleInstance, storeId: string): number | null {
  const state = instance.energy.find((entry: VehicleEnergyState) => entry.storeId === storeId)
  return state && Number.isFinite(state.amount) && state.amount >= 0 ? state.amount : null
}

export function estimateSurfaceMission(
  frame: VehicleFrame,
  instance: VehicleInstance,
  profile: SurfaceOperationProfile,
  plan: SurfaceMissionPlan,
): SurfaceMissionEstimate {
  const blockReasons: SurfaceMissionBlockReason[] = []

  if (instance.status !== 'ready') blockReasons.push('vehicle-not-ready')
  if (!frame.domains.includes('surface')) blockReasons.push('surface-domain-unsupported')
  if (!frame.surfaceMobility) blockReasons.push('surface-mobility-missing')

  const profileValid = Number.isFinite(profile.nominalConsumptionPerKm)
    && profile.nominalConsumptionPerKm >= 0
    && Number.isFinite(profile.wearPerOperatingHour)
    && profile.wearPerOperatingHour >= 0
  if (!profileValid) blockReasons.push('energy-profile-invalid')

  let routeValid = plan.segments.length > 0
  let routeBlocked = false
  let distanceKm = 0
  let durationHours = 0
  let energyRequired = 0
  let wearIncrement = 0

  for (const segment of plan.segments) {
    if (!Number.isFinite(segment.distanceKm) || segment.distanceKm <= 0) {
      routeValid = false
      continue
    }
    distanceKm += segment.distanceKm

    const traversal = segment.traversal
    if (!traversal.passable
      || !Number.isFinite(traversal.speedMultiplier) || traversal.speedMultiplier <= 0
      || !Number.isFinite(traversal.energyMultiplier) || traversal.energyMultiplier <= 0
      || !Number.isFinite(traversal.wearMultiplier) || traversal.wearMultiplier < 0) {
      routeBlocked = true
      continue
    }

    if (frame.surfaceMobility) {
      const segmentHours = segment.distanceKm
        / (frame.surfaceMobility.referenceSpeedKph * traversal.speedMultiplier)
      durationHours += segmentHours
      wearIncrement += segmentHours * profile.wearPerOperatingHour * traversal.wearMultiplier
    }
    if (profileValid) {
      energyRequired += segment.distanceKm * profile.nominalConsumptionPerKm * traversal.energyMultiplier
    }
  }

  if (!routeValid) blockReasons.push('invalid-route')
  if (routeBlocked) blockReasons.push('route-blocked')

  const cargoMass = cargoMassKg(instance.cargo)
  if (instance.cargo.length > 0 && cargoMass == null) blockReasons.push('cargo-mass-unresolved')
  if (cargoMass != null && cargoMass > frame.cargo.massCapacityKg) blockReasons.push('cargo-capacity-exceeded')

  const energySpec = storeSpec(frame, profile.energyStoreId)
  if (!energySpec) blockReasons.push('energy-store-missing')
  const energyAvailable = availableEnergy(instance, profile.energyStoreId)
  if (!energySpec || energyAvailable == null) blockReasons.push('energy-store-missing')
  else if (profileValid && energyAvailable + Number.EPSILON < energyRequired) blockReasons.push('insufficient-energy')

  const computable = routeValid && !routeBlocked && frame.surfaceMobility != null && profileValid && energySpec != null

  return {
    feasible: blockReasons.length === 0,
    blockReasons: [...new Set(blockReasons)],
    distanceKm,
    etaSeconds: computable ? Math.max(1, Math.round(durationHours * 3600)) : null,
    energyStoreId: profile.energyStoreId,
    energyRequired: computable ? energyRequired : null,
    energyUnit: energySpec?.unit ?? null,
    cargoMassKg: cargoMass,
    cargoCapacityKg: frame.cargo.massCapacityKg,
    wearIncrement: computable ? wearIncrement : null,
  }
}

export function buildSurfaceRouteSnapshot(
  frame: VehicleFrame,
  instance: VehicleInstance,
  profile: SurfaceOperationProfile,
  plan: SurfaceMissionPlan,
): SurfaceRouteSnapshot {
  const estimate = estimateSurfaceMission(frame, instance, profile, plan)
  if (!estimate.feasible || estimate.etaSeconds == null || estimate.energyRequired == null
    || estimate.energyUnit == null || estimate.wearIncrement == null) {
    throw new Error(`Surface mission is not feasible: ${estimate.blockReasons.join(', ')}`)
  }

  return {
    kind: 'surface-vehicle-route-v1',
    routeId: plan.routeId,
    passable: true,
    distanceKm: estimate.distanceKm,
    etaSeconds: estimate.etaSeconds,
    energyStoreId: estimate.energyStoreId,
    energyRequired: estimate.energyRequired,
    energyUnit: estimate.energyUnit,
    wearIncrement: estimate.wearIncrement,
    segmentCount: plan.segments.length,
  }
}
