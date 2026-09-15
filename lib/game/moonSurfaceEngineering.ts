import type { SurfaceVehicleProfileEntry } from './vehicles/surfaceProfileResolution'
import { resolveSurfaceVehicleProfile } from './vehicles/surfaceProfileResolution'

/**
 * Moon-specific registry of Engineering-approved surface vehicle frames.
 *
 * The shared Core resolver owns frame/profile validation. Moon only owns which
 * exact Engineering frames are accepted for lunar surface routing.
 *
 * EXT-NOXIA-ENG-20260911-LUNAR-SURFACE-LOGISTICS is still open, so the registry
 * intentionally contains no productive frame values yet. In particular,
 * `cargo-rover-reference` may exist as a Core bootstrap frame, but it is not
 * silently promoted to a canonical Moon mobility/energy profile here.
 */
export const MOON_SURFACE_ENGINEERING_PROFILES: readonly SurfaceVehicleProfileEntry[] = []

export function resolveMoonSurfaceEngineeringProfile(frameId: string) {
  return resolveSurfaceVehicleProfile(frameId, MOON_SURFACE_ENGINEERING_PROFILES)
}
