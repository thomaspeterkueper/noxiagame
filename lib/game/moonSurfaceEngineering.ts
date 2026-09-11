import type { MoonSurfaceRouteClass, MoonVehicleMobilityEnvelope } from './moonSurfaceLogistics'
import type { SurfaceOperationProfile } from './vehicles/surfaceMission'

/**
 * Engineering-owned runtime values required to turn a Shackleton terrain route
 * into a Core-valid surface routeSnapshot. NOXIA must not invent these values.
 */
export interface MoonSurfaceEngineeringProfile {
  frameId: string
  role: 'cargo-rover' | 'heavy-hauler'
  cargoCapacityT: number
  mobility: MoonVehicleMobilityEnvelope
  operations: SurfaceOperationProfile
  allowedRouteClasses: readonly MoonSurfaceRouteClass[]
  source: {
    repository: 'kueper-engineering'
    reference: string
  }
}

/**
 * Canonical Engineering profiles are intentionally empty until
 * EXT-NOXIA-ENG-20260911-LUNAR-SURFACE-LOGISTICS is completed.
 *
 * Keeping this registry fail-closed makes the future integration explicit:
 * Engineering publishes a stable frame -> it is registered here -> the Moon
 * route/job API can use it without changing the planner UI or Core contract.
 */
const PROFILES = new Map<string, MoonSurfaceEngineeringProfile>()

export function getMoonSurfaceEngineeringProfile(frameId: string) {
  return PROFILES.get(frameId) ?? null
}

export function hasMoonSurfaceEngineeringProfile(frameId: string) {
  return PROFILES.has(frameId)
}
