// lib/game/vehicles/operations.ts

import type {
  MobilityDomain,
  VehicleEnvironmentEnvelope,
  VehicleInstance,
  VehicleMaintenanceSpec,
  VehicleMaintenanceState,
  VehicleType,
} from './types'

export interface OperatingEnvironment {
  gravityMs2: number
  temperatureC?: number
  vacuum: boolean
  terrainSlopeDeg?: number
  dustSeverity?: 'low' | 'medium' | 'high' | 'extreme'
  radiationSeverity?: 'low' | 'medium' | 'high' | 'extreme'
}

const severityRank = { low: 0, medium: 1, high: 2, extreme: 3 } as const

function withinSeverityLimit(
  actual: keyof typeof severityRank | undefined,
  limit: keyof typeof severityRank | undefined,
): boolean {
  if (actual == null || limit == null) return true
  return severityRank[actual] <= severityRank[limit]
}

export function supportsMobilityDomain(type: VehicleType, domain: MobilityDomain): boolean {
  return type.mobilityDomains.includes(domain)
}

export function isEnvironmentCompatible(
  envelope: VehicleEnvironmentEnvelope,
  environment: OperatingEnvironment,
): boolean {
  if (environment.vacuum && !envelope.vacuumCapable) return false
  if (!environment.vacuum && envelope.atmosphereRequired === false) {
    // A vacuum-capable vehicle may still operate in atmosphere unless another rule forbids it.
  }
  if (envelope.atmosphereRequired && environment.vacuum) return false
  if (envelope.minGravityMs2 != null && environment.gravityMs2 < envelope.minGravityMs2) return false
  if (envelope.maxGravityMs2 != null && environment.gravityMs2 > envelope.maxGravityMs2) return false
  if (envelope.minTemperatureC != null && environment.temperatureC != null && environment.temperatureC < envelope.minTemperatureC) return false
  if (envelope.maxTemperatureC != null && environment.temperatureC != null && environment.temperatureC > envelope.maxTemperatureC) return false
  if (envelope.maxTerrainSlopeDeg != null && environment.terrainSlopeDeg != null && environment.terrainSlopeDeg > envelope.maxTerrainSlopeDeg) return false
  if (!withinSeverityLimit(environment.dustSeverity, envelope.dustTolerance)) return false
  if (!withinSeverityLimit(environment.radiationSeverity, envelope.radiationTolerance)) return false
  return true
}

export function isVehicleOperational(instance: VehicleInstance): boolean {
  if (instance.condition <= 0) return false
  return !['damaged', 'disabled', 'lost', 'maintenance'].includes(instance.status)
}

export function maintenanceDue(
  state: VehicleMaintenanceState,
  spec: VehicleMaintenanceSpec | undefined,
): boolean {
  if (state.serviceDue) return true
  if (!spec) return false
  if (spec.serviceIntervalHours != null && state.operatingHours >= spec.serviceIntervalHours) return true
  if (spec.serviceIntervalDistanceKm != null && state.distanceKm >= spec.serviceIntervalDistanceKm) return true
  if (spec.inspectionCycles != null && state.cycles >= spec.inspectionCycles) return true
  return false
}

export function applyOperatingWear(
  state: VehicleMaintenanceState,
  hours: number,
  distanceKm: number,
  cycles: number,
  spec?: VehicleMaintenanceSpec,
): VehicleMaintenanceState {
  const baseWear = Math.max(0, hours) * (spec?.baseWearPerOperatingHour ?? 0)
  const next: VehicleMaintenanceState = {
    ...state,
    operatingHours: state.operatingHours + Math.max(0, hours),
    distanceKm: state.distanceKm + Math.max(0, distanceKm),
    cycles: state.cycles + Math.max(0, cycles),
    wear: Math.max(0, state.wear + baseWear),
  }
  next.serviceDue = maintenanceDue(next, spec)
  return next
}

export function emptyMaintenanceState(): VehicleMaintenanceState {
  return {
    operatingHours: 0,
    distanceKm: 0,
    cycles: 0,
    wear: 0,
    serviceDue: false,
    faults: [],
  }
}
