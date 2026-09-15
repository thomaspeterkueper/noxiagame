import type { EarthSurfaceRoutePlan } from './earthSurfaceRouting'
import type { GeoPoint } from '../world/spatial/earthSpatial'
import { geoToLocalMeters } from '../world/spatial/earthSpatial'
import type { SurfaceRouteGeometry } from './vehicles/surfaceRouteGeometry'

/**
 * Project an already Earth-validated geographic route into the shared local-world
 * metre frame used by persisted SurfaceRouteGeometry.
 *
 * The region origin is explicit: route geometry must be interpreted in the same
 * local frame as the spatial entities and must never infer or invent an anchor.
 */
export function buildEarthSurfaceRouteGeometry(
  route: EarthSurfaceRoutePlan,
  regionOrigin: GeoPoint,
): SurfaceRouteGeometry {
  if (route.polyline.length < 2) {
    throw new Error('Earth surface route geometry requires at least two polyline points')
  }

  const points = route.polyline.map(point => {
    const local = geoToLocalMeters(point, regionOrigin)
    return {
      xM: local.eastM,
      yM: local.northM,
      zM: point.elevationM ?? null,
    }
  })

  return { frame: 'local-world-meters', points }
}

/**
 * Add Earth route geometry to a shared route snapshot without changing the
 * authoritative mission/energy/wear fields computed by the vehicle domain.
 */
export function attachEarthSurfaceRouteGeometry<T extends Record<string, unknown>>(
  snapshot: T,
  route: EarthSurfaceRoutePlan,
  regionOrigin: GeoPoint,
): T & { geometry: SurfaceRouteGeometry } {
  return {
    ...snapshot,
    geometry: buildEarthSurfaceRouteGeometry(route, regionOrigin),
  }
}
