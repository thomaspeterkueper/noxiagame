import {
  assessMoonSurfaceRoute,
  deriveMoonRouteMetrics,
  type MoonRouteAssessment,
  type MoonRouteMetrics,
  type MoonSurfaceRouteClass,
  type MoonVehicleMobilityEnvelope,
} from './moonSurfaceLogistics'
import type {
  TerrainSampleContext,
  TerrainSampleRequest,
  TerrainSampler,
} from './spatial/terrainSampling'
import { assertTerrainSamplingReady } from './spatial/terrainSampling'
import {
  traversalFromMoonAssessment,
  type SurfaceMissionPlan,
} from './vehicles/surfaceMission'
import type { SurfaceRouteGeometry } from './vehicles/surfaceRouteGeometry'

export interface ShackletonSurfaceRouteRequest {
  routeId: string
  originInventoryId: string
  destinationInventoryId: string
  routeClass: MoonSurfaceRouteClass
  vehicle: MoonVehicleMobilityEnvelope
  /** Ordered local-world polyline points in the verified Shackleton frame. */
  points: readonly TerrainSampleRequest[]
  roughness01?: number
}

export interface ShackletonSurfaceRouteResolution {
  plan: SurfaceMissionPlan
  metrics: MoonRouteMetrics
  assessment: MoonRouteAssessment
  /** Exact sampled local-world path that may be persisted in route_snapshot.geometry. */
  geometry: SurfaceRouteGeometry
}

function assertRouteRequest(request: ShackletonSurfaceRouteRequest) {
  if (!request.routeId.trim()) throw new Error('Shackleton surface route requires routeId')
  if (!request.originInventoryId.trim() || !request.destinationInventoryId.trim()) {
    throw new Error('Shackleton surface route requires origin and destination inventory ids')
  }
  if (request.points.length < 2) throw new Error('Shackleton surface route requires at least two points')
  for (const point of request.points) {
    if (!Number.isFinite(point.xM) || !Number.isFinite(point.yM)) {
      throw new Error('Shackleton surface route points must contain finite local coordinates')
    }
  }
}

/**
 * Resolve a candidate Shackleton surface route against authoritative terrain and
 * convert it into the shared SurfaceMissionPlan contract.
 *
 * Terrain comes exclusively from the injected TerrainSampler (normally the cached
 * LOLA pipeline). Missing/NoData coverage aborts resolution rather than inventing
 * elevations. Vehicle slope capability is supplied by Engineering/Core through the
 * MoonVehicleMobilityEnvelope; no rover limits, speeds or energy values live here.
 */
export async function resolveShackletonSurfaceMissionPlan(
  sampler: TerrainSampler,
  context: TerrainSampleContext,
  request: ShackletonSurfaceRouteRequest,
): Promise<ShackletonSurfaceRouteResolution> {
  assertRouteRequest(request)
  assertTerrainSamplingReady(context)

  let cumulativeDistanceM = 0
  const profile: Array<{ distanceM: number; elevationM: number }> = []
  const routePoints: SurfaceRouteGeometry['points'] = []

  for (let index = 0; index < request.points.length; index += 1) {
    const point = request.points[index]
    if (index > 0) {
      const previous = request.points[index - 1]
      cumulativeDistanceM += Math.hypot(point.xM - previous.xM, point.yM - previous.yM)
      if (!(cumulativeDistanceM > profile[index - 1].distanceM)) {
        throw new Error('Shackleton surface route contains duplicate consecutive points')
      }
    }

    const sample = await sampler.sampleTerrainHeight(context, point)
    if (!sample) {
      throw new Error(`Shackleton terrain unresolved at route point ${index}`)
    }
    if (!Number.isFinite(sample.zM)) {
      throw new Error(`Shackleton terrain returned non-finite elevation at route point ${index}`)
    }

    profile.push({ distanceM: cumulativeDistanceM, elevationM: sample.zM })
    routePoints.push({ xM: point.xM, yM: point.yM, zM: sample.zM })
  }

  const metrics = deriveMoonRouteMetrics(profile)
  const assessment = assessMoonSurfaceRoute({
    routeClass: request.routeClass,
    metrics,
    vehicle: request.vehicle,
    roughness01: request.roughness01,
  })

  const plan: SurfaceMissionPlan = {
    routeId: request.routeId,
    originInventoryId: request.originInventoryId,
    destinationInventoryId: request.destinationInventoryId,
    segments: [
      {
        id: `${request.routeId}:shackleton-terrain`,
        distanceKm: metrics.distanceM / 1000,
        traversal: traversalFromMoonAssessment(assessment),
      },
    ],
  }

  return {
    plan,
    metrics,
    assessment,
    geometry: { frame: 'local-world-meters', points: routePoints },
  }
}
