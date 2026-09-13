import type { EarthSurfaceRoutePlan } from './earthSurfaceRouting'
import type { SurfaceMissionPlan } from './vehicles/surfaceMission'

export interface EarthSurfaceMissionPlanInput {
  routeId: string
  originInventoryId: string
  destinationInventoryId: string
  route: EarthSurfaceRoutePlan
}

/**
 * Adapt an already Earth-validated OSM/offroad route into the shared vehicle
 * SurfaceMissionPlan contract. Absolute speed, energy consumption and wear are
 * deliberately not computed here; those remain Vehicle/Engineering inputs.
 */
export function buildEarthSurfaceMissionPlan(
  input: EarthSurfaceMissionPlanInput,
): SurfaceMissionPlan {
  const routeId = input.routeId.trim()
  const originInventoryId = input.originInventoryId.trim()
  const destinationInventoryId = input.destinationInventoryId.trim()

  if (!routeId) throw new Error('Earth surface mission routeId is required')
  if (!originInventoryId || !destinationInventoryId) {
    throw new Error('Earth surface mission inventory ids are required')
  }
  if (originInventoryId === destinationInventoryId) {
    throw new Error('Earth surface mission requires different origin and destination inventories')
  }

  return {
    routeId,
    originInventoryId,
    destinationInventoryId,
    segments: input.route.segments.map((segment, index) => ({
      id: `earth:${index}:${segment.kind}:${segment.featureId ?? 'access'}:${segment.routeClass}`,
      distanceKm: segment.distanceM / 1000,
      traversal: {
        passable: true,
        speedMultiplier: segment.speedMultiplier,
        energyMultiplier: segment.energyMultiplier,
        wearMultiplier: segment.wearMultiplier,
      },
    })),
  }
}
