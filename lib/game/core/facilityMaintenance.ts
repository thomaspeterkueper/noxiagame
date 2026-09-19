export interface FacilityMaintenanceState {
  tileEntityId: string
  condition: number
  wear: number
  maintenanceDue: boolean
  lastMaintainedTick: number | null
  updatedTick: number | null
}

export interface FacilityOperation {
  wearRate: number
  load: number
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

/** Pure deterministic wear projection from actual operation. */
export function projectFacilityOperation(
  current: FacilityMaintenanceState,
  operation: FacilityOperation,
  tick: number,
): FacilityMaintenanceState {
  const addedWear = Math.max(0, operation.wearRate) * clamp01(operation.load)
  const wear = clamp01(current.wear + addedWear)
  const condition = clamp01(1 - wear)
  return {
    ...current,
    wear,
    condition,
    maintenanceDue: wear >= 0.6,
    updatedTick: tick,
  }
}

export function projectFacilityMaintenance(
  current: FacilityMaintenanceState,
  tick: number,
  restoredCondition = 1,
): FacilityMaintenanceState {
  const condition = clamp01(restoredCondition)
  return {
    ...current,
    condition,
    wear: 1 - condition,
    maintenanceDue: condition <= 0.4,
    lastMaintainedTick: tick,
    updatedTick: tick,
  }
}

export type MaintenanceIncidentPressure = 'none' | 'degraded' | 'critical'

export function maintenanceIncidentPressure(state: FacilityMaintenanceState): MaintenanceIncidentPressure {
  if (state.condition <= 0.15) return 'critical'
  if (state.condition <= 0.4) return 'degraded'
  return 'none'
}
