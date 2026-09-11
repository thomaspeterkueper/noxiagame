// lib/game/vehicles/surfaceMission.ts
// Shared surface-transport vertical slice for NOXIA.
//
// Planet/domain modules own route interpretation (road, terrain, slope, roughness).
// This module owns vehicle-side feasibility, ETA, energy, cargo and wear accounting.

import type { EarthSurfaceRouteAssessment } from '../earthSurfaceLogistics'
import type { MoonRouteAssessment } from '../moonSurfaceLogistics'
import { isVehicleOperational, supportsMobilityDomain } from './operations'
import type {
  MobilityDomain,
  VehicleCargoState,
  VehicleEnergyState,
  VehicleInstance,
  VehicleType,
} from './types'

export type SurfaceMobilityDomain = Extract<MobilityDomain, 'surface-wheeled' | 'surface-tracked'>

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

export interface SurfaceMissionPlan {
  routeId: string
  originId: string
  destinationId: string
  domain: SurfaceMobilityDomain
  segments: readonly SurfaceRouteSegment[]
}

export type SurfaceMissionBlockReason =
  | 'vehicle-not-operational'
  | 'mobility-domain-unsupported'
  | 'invalid-route'
  | 'route-blocked'
  | 'missing-speed-spec'
  | 'unsupported-speed-unit'
  | 'missing-energy-spec'
  | 'unsupported-consumption-unit'
  | 'insufficient-energy'
  | 'cargo-capacity-exceeded'
  | 'cargo-mass-unresolved'

export interface SurfaceMissionEstimate {
  feasible: boolean
  blockReasons: SurfaceMissionBlockReason[]
  distanceKm: number
  durationHours: number | null
  energyRequired: number | null
  energyUnit: VehicleEnergyState['unit'] | null
  energyCarrier: VehicleEnergyState['carrier'] | null
  cargoTonnes: number | null
  cargoCapacityTonnes: number | null
  wearIncrement: number
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
    // The lunar policy currently does not define component wear. Keep wear neutral
    // instead of inventing a physical penalty; Engineering/Core may add it later.
    wearMultiplier: 1,
    reason: assessment.reason,
  }
}

function cargoMassTonnes(cargo: readonly VehicleCargoState[]): number | null {
  let total = 0
  for (const item of cargo) {
    if (!Number.isFinite(item.amount) || item.amount < 0) return null
    if (item.unit === 't') total += item.amount
    else if (item.unit === 'kg') total += item.amount / 1000
    else return null
  }
  return total
}

function requiredEnergyUnit(consumptionUnit: NonNullable<VehicleType['energy']>['consumptionUnit']): VehicleEnergyState['unit'] | null {
  if (consumptionUnit === 'kWh/km') return 'kWh'
  if (consumptionUnit === 'kg/km') return 'kg'
  return null
}

function availableEnergy(
  instance: VehicleInstance,
  carrier: VehicleEnergyState['carrier'],
  unit: VehicleEnergyState['unit'],
): number {
  return instance.energy
    .filter((entry) => entry.carrier === carrier && entry.unit === unit)
    .reduce((sum, entry) => sum + Math.max(0, entry.amount), 0)
}

export function estimateSurfaceMission(
  type: VehicleType,
  instance: VehicleInstance,
  plan: SurfaceMissionPlan,
): SurfaceMissionEstimate {
  const blockReasons: SurfaceMissionBlockReason[] = []

  if (!isVehicleOperational(instance)) blockReasons.push('vehicle-not-operational')
  if (!supportsMobilityDomain(type, plan.domain)) blockReasons.push('mobility-domain-unsupported')

  let distanceKm = 0
  let durationHours = 0
  let energyRequired = 0
  let wearIncrement = 0
  let routeValid = plan.segments.length > 0
  let routeBlocked = false

  const speedValid = type.nominalSpeed != null && Number.isFinite(type.nominalSpeed) && type.nominalSpeed > 0
  if (!speedValid) blockReasons.push('missing-speed-spec')
  else if (type.nominalSpeedUnit !== 'km/h') blockReasons.push('unsupported-speed-unit')

  const energySpec = type.energy
  const consumptionValid = energySpec?.nominalConsumption != null
    && Number.isFinite(energySpec.nominalConsumption)
    && energySpec.nominalConsumption >= 0
  if (!energySpec || !consumptionValid || energySpec.carriers.length === 0) {
    blockReasons.push('missing-energy-spec')
  }

  const energyUnit = energySpec?.consumptionUnit ? requiredEnergyUnit(energySpec.consumptionUnit) : null
  if (energySpec && consumptionValid && !energyUnit) blockReasons.push('unsupported-consumption-unit')
  const energyCarrier = energySpec?.carriers[0] ?? null

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

    if (speedValid && type.nominalSpeedUnit === 'km/h') {
      const segmentHours = segment.distanceKm / (type.nominalSpeed! * traversal.speedMultiplier)
      durationHours += segmentHours
      wearIncrement += segmentHours
        * (type.maintenance?.baseWearPerOperatingHour ?? 0)
        * traversal.wearMultiplier
    }

    if (energySpec && consumptionValid && energyUnit) {
      energyRequired += segment.distanceKm * energySpec.nominalConsumption! * traversal.energyMultiplier
    }
  }

  if (!routeValid) blockReasons.push('invalid-route')
  if (routeBlocked) blockReasons.push('route-blocked')

  const cargoTonnes = cargoMassTonnes(instance.cargo)
  const cargoCapacityTonnes = type.capacity?.cargoTonnes ?? null
  if (instance.cargo.length > 0 && cargoTonnes == null) blockReasons.push('cargo-mass-unresolved')
  if (cargoTonnes != null && cargoCapacityTonnes != null && cargoTonnes > cargoCapacityTonnes) {
    blockReasons.push('cargo-capacity-exceeded')
  }

  if (energyCarrier && energyUnit && consumptionValid) {
    if (availableEnergy(instance, energyCarrier, energyUnit) + Number.EPSILON < energyRequired) {
      blockReasons.push('insufficient-energy')
    }
  }

  return {
    feasible: blockReasons.length === 0,
    blockReasons: [...new Set(blockReasons)],
    distanceKm,
    durationHours: speedValid && type.nominalSpeedUnit === 'km/h' && routeValid && !routeBlocked ? durationHours : null,
    energyRequired: energyCarrier && energyUnit && consumptionValid && routeValid && !routeBlocked ? energyRequired : null,
    energyUnit,
    energyCarrier,
    cargoTonnes,
    cargoCapacityTonnes,
    wearIncrement,
  }
}

function consumeEnergy(
  states: readonly VehicleEnergyState[],
  carrier: VehicleEnergyState['carrier'],
  unit: VehicleEnergyState['unit'],
  amount: number,
): VehicleEnergyState[] {
  let remaining = Math.max(0, amount)
  return states.map((state) => {
    if (remaining <= 0 || state.carrier !== carrier || state.unit !== unit) return { ...state }
    const consumed = Math.min(Math.max(0, state.amount), remaining)
    remaining -= consumed
    return { ...state, amount: state.amount - consumed }
  })
}

export function startSurfaceMission(
  type: VehicleType,
  instance: VehicleInstance,
  plan: SurfaceMissionPlan,
): VehicleInstance {
  const estimate = estimateSurfaceMission(type, instance, plan)
  if (!estimate.feasible) {
    throw new Error(`Surface mission is not feasible: ${estimate.blockReasons.join(', ')}`)
  }
  return {
    ...instance,
    status: 'operating',
    movement: {
      domain: plan.domain,
      state: 'en-route',
      routeId: plan.routeId,
      originId: plan.originId,
      destinationId: plan.destinationId,
      progress: 0,
    },
  }
}

export function completeSurfaceMission(
  type: VehicleType,
  instance: VehicleInstance,
  plan: SurfaceMissionPlan,
): VehicleInstance {
  const estimate = estimateSurfaceMission(type, instance, plan)
  if (!estimate.feasible || estimate.durationHours == null || estimate.energyRequired == null
    || estimate.energyCarrier == null || estimate.energyUnit == null) {
    throw new Error(`Surface mission cannot be completed: ${estimate.blockReasons.join(', ')}`)
  }

  const maintenance = {
    ...instance.maintenance,
    operatingHours: instance.maintenance.operatingHours + estimate.durationHours,
    distanceKm: instance.maintenance.distanceKm + estimate.distanceKm,
    cycles: instance.maintenance.cycles + 1,
    wear: instance.maintenance.wear + estimate.wearIncrement,
  }
  const serviceDue = Boolean(
    maintenance.serviceDue
      || (type.maintenance?.serviceIntervalHours != null && maintenance.operatingHours >= type.maintenance.serviceIntervalHours)
      || (type.maintenance?.serviceIntervalDistanceKm != null && maintenance.distanceKm >= type.maintenance.serviceIntervalDistanceKm)
      || (type.maintenance?.inspectionCycles != null && maintenance.cycles >= type.maintenance.inspectionCycles),
  )

  return {
    ...instance,
    locationId: plan.destinationId,
    status: 'ready',
    energy: consumeEnergy(instance.energy, estimate.energyCarrier, estimate.energyUnit, estimate.energyRequired),
    maintenance: { ...maintenance, serviceDue },
    movement: {
      domain: plan.domain,
      state: 'arrived',
      routeId: plan.routeId,
      originId: plan.originId,
      destinationId: plan.destinationId,
      progress: 1,
    },
  }
}
