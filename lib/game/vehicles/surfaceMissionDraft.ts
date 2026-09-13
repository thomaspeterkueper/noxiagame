import {
  buildSurfaceRouteSnapshot,
  estimateSurfaceMission,
  type SurfaceMissionEstimate,
  type SurfaceMissionPlan,
  type SurfaceOperationProfile,
  type SurfaceRouteSnapshot,
} from './surfaceMission'
import type {
  VehicleCargoLoad,
  VehicleFrame,
  VehicleInstance,
} from './types'

export interface ProspectiveSurfaceMissionInput {
  frame: VehicleFrame
  instance: VehicleInstance
  operationProfile: SurfaceOperationProfile
  plan: SurfaceMissionPlan
  /** Cargo state expected after loading, before the vehicle starts the mission. */
  projectedCargo: readonly VehicleCargoLoad[]
}

export interface ProspectiveSurfaceMissionDraft {
  projectedVehicle: VehicleInstance
  estimate: SurfaceMissionEstimate
  routeSnapshot: SurfaceRouteSnapshot | null
}

/**
 * Project the authoritative vehicle instance into its planned post-loading cargo
 * state without mutating the live instance. This keeps transport preparation
 * separate from the actual Core loading command/state transition.
 */
export function projectVehicleCargoForSurfaceMission(
  instance: VehicleInstance,
  projectedCargo: readonly VehicleCargoLoad[],
): VehicleInstance {
  return {
    ...instance,
    cargo: projectedCargo.map((item) => ({ ...item })),
  }
}

/**
 * Estimate a surface mission against the cargo that will actually be on board
 * after loading. The shared SurfaceMission estimator remains the single owner of
 * capacity, ETA, energy and wear calculations.
 */
export function estimateProspectiveSurfaceMission(
  input: ProspectiveSurfaceMissionInput,
): SurfaceMissionEstimate {
  const projectedVehicle = projectVehicleCargoForSurfaceMission(
    input.instance,
    input.projectedCargo,
  )
  return estimateSurfaceMission(
    input.frame,
    projectedVehicle,
    input.operationProfile,
    input.plan,
  )
}

/**
 * Prepare the validated RouteSnapshot that can later be persisted on a
 * TransportJob. A blocked draft deliberately returns no snapshot so callers
 * cannot accidentally persist a route budget for an infeasible load state.
 */
export function prepareProspectiveSurfaceMission(
  input: ProspectiveSurfaceMissionInput,
): ProspectiveSurfaceMissionDraft {
  const projectedVehicle = projectVehicleCargoForSurfaceMission(
    input.instance,
    input.projectedCargo,
  )
  const estimate = estimateSurfaceMission(
    input.frame,
    projectedVehicle,
    input.operationProfile,
    input.plan,
  )

  return {
    projectedVehicle,
    estimate,
    routeSnapshot: estimate.feasible
      ? buildSurfaceRouteSnapshot(
          input.frame,
          projectedVehicle,
          input.operationProfile,
          input.plan,
        )
      : null,
  }
}
