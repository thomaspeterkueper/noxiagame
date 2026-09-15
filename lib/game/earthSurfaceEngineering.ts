import type { SurfaceVehicleProfileEntry } from './vehicles/surfaceProfileResolution'
import { resolveSurfaceVehicleProfile } from './vehicles/surfaceProfileResolution'

/**
 * Earth-specific registry of Engineering-approved surface vehicle frames.
 *
 * OSM road classes and Earth route multipliers are routing policy, not evidence
 * for absolute vehicle speed, consumption, capacity or wear. Productive Earth
 * movement therefore remains fail-closed until an exact Engineering frame and
 * operation profile are registered here.
 */
export const EARTH_SURFACE_ENGINEERING_PROFILES: readonly SurfaceVehicleProfileEntry[] = []

export function resolveEarthSurfaceEngineeringProfile(frameId: string) {
  return resolveSurfaceVehicleProfile(frameId, EARTH_SURFACE_ENGINEERING_PROFILES)
}
