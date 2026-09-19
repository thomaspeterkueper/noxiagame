export interface FacilityMaintenanceState {
  tileEntityId: string
  condition: number
  wear: number
  maintenanceDue: boolean
  lastServiceTick: number | null
  updatedTick: number | null
}

export interface FacilityOperationLoad {
  utilization: number
  environmentStress: number
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

/** Deterministic wear only. Incident creation remains a separate authoritative decision. */
export function advanceFacilityMaintenance(
  current: FacilityMaintenanceState,
  load: FacilityOperationLoad,
  tick: number,
): FacilityMaintenanceState {
  const utilization = clamp01(load.utilization)
  const environmentStress = clamp01(load.environmentStress)
  const wearDelta = 0.002 + utilization * 0.006 + environmentStress * 0.004
  const wear = clamp01(current.wear + wearDelta)
  return {
    ...current,
    wear,
    condition: clamp01(1 - wear),
    maintenanceDue: wear >= 0.65,
    updatedTick: tick,
  }
}

export function serviceFacility(
  current: FacilityMaintenanceState,
  tick: number,
): FacilityMaintenanceState {
  return { ...current, wear: 0.08, condition: 0.92, maintenanceDue: false, lastServiceTick: tick, updatedTick: tick }
}

export function incidentPressure(state: FacilityMaintenanceState): number {
  if (state.wear < 0.65) return 0
  return Math.round(clamp01((state.wear - 0.65) / 0.35) * 1_000_000) / 1_000_000
}
