import type { PlanetaryCoordinate, WorldBody } from './types'

/**
 * A point addressed relative to the physical surface at the same latitude/longitude.
 *
 * depthBelowSurfaceM is always >= 0. A surface point therefore has depth 0.
 * The local vertical follows the body's planetary reference, not a global cartesian z axis.
 */
export interface SurfaceRelativePoint {
  body: WorldBody
  latDeg: number
  lonDeg: number
  surfaceElevationM: number
  depthBelowSurfaceM: number
}

export type SubsurfaceZone = 'surface' | 'shallow' | 'deep'

export interface SubsurfaceZoneThresholds {
  shallowMaxDepthM: number
}

export const DEFAULT_SUBSURFACE_THRESHOLDS: SubsurfaceZoneThresholds = {
  shallowMaxDepthM: 500,
}

export interface DepthInterval {
  minDepthM: number
  maxDepthM: number
}

export type VolumeConfidence = 'hypothesized' | 'inferred' | 'measured' | 'confirmed'

/**
 * Minimal spatial contract for resource bodies, voids, regolith units, lava tubes,
 * ice lenses and other volumetric features. Detailed geometry can be attached later
 * without changing the surface-relative vertical semantics.
 */
export interface GeologicalVolumeEstimate {
  id: string
  body: WorldBody
  kind: string
  depth: DepthInterval
  confidence: VolumeConfidence
  provenance?: Record<string, unknown>
}

function finite(value: number, label: string) {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`)
}

export function validateSurfaceRelativePoint(point: SurfaceRelativePoint) {
  finite(point.latDeg, 'latDeg')
  finite(point.lonDeg, 'lonDeg')
  finite(point.surfaceElevationM, 'surfaceElevationM')
  finite(point.depthBelowSurfaceM, 'depthBelowSurfaceM')
  if (point.latDeg < -90 || point.latDeg > 90) throw new Error('latDeg must be between -90 and 90')
  if (point.depthBelowSurfaceM < 0) throw new Error('depthBelowSurfaceM must be >= 0')
  return point
}

export function validateDepthInterval(interval: DepthInterval) {
  finite(interval.minDepthM, 'minDepthM')
  finite(interval.maxDepthM, 'maxDepthM')
  if (interval.minDepthM < 0) throw new Error('minDepthM must be >= 0')
  if (interval.maxDepthM < interval.minDepthM) throw new Error('maxDepthM must be >= minDepthM')
  return interval
}

/** Convert surface-relative depth into the existing planetary datum elevation model. */
export function surfaceRelativeToPlanetary(point: SurfaceRelativePoint): PlanetaryCoordinate {
  validateSurfaceRelativePoint(point)
  return {
    latDeg: point.latDeg,
    lonDeg: point.lonDeg,
    elevationM: point.surfaceElevationM - point.depthBelowSurfaceM,
  }
}

/** Address an existing planetary point by depth below a known terrain surface sample. */
export function planetaryToSurfaceRelative(
  body: WorldBody,
  point: PlanetaryCoordinate,
  surfaceElevationM: number,
): SurfaceRelativePoint {
  finite(surfaceElevationM, 'surfaceElevationM')
  const elevationM = point.elevationM ?? 0
  const depthBelowSurfaceM = surfaceElevationM - elevationM
  if (depthBelowSurfaceM < -1e-6) {
    throw new Error('Planetary point lies above the supplied surface elevation')
  }
  return {
    body,
    latDeg: point.latDeg,
    lonDeg: point.lonDeg,
    surfaceElevationM,
    depthBelowSurfaceM: Math.max(0, depthBelowSurfaceM),
  }
}

export function classifySubsurfaceZone(
  depthBelowSurfaceM: number,
  thresholds: SubsurfaceZoneThresholds = DEFAULT_SUBSURFACE_THRESHOLDS,
): SubsurfaceZone {
  finite(depthBelowSurfaceM, 'depthBelowSurfaceM')
  finite(thresholds.shallowMaxDepthM, 'shallowMaxDepthM')
  if (depthBelowSurfaceM < 0) throw new Error('depthBelowSurfaceM must be >= 0')
  if (thresholds.shallowMaxDepthM <= 0) throw new Error('shallowMaxDepthM must be > 0')
  if (depthBelowSurfaceM === 0) return 'surface'
  return depthBelowSurfaceM <= thresholds.shallowMaxDepthM ? 'shallow' : 'deep'
}
