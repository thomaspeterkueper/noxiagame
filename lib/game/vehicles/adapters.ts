// lib/game/vehicles/adapters.ts
// Narrow adapters between the new shared vehicle contract and existing NOXIA domains.
// Existing systems remain source-compatible; these helpers allow gradual adoption.

import type { EarthSurfaceVehicleRole, EarthVehicleMobilityEnvelope } from '../earthSurfaceLogistics'
import type { ExplorationAssetKind, ExplorationAssetInstance } from '../explorationAssets'
import type { ShipInstance } from '../ships'
import type { VehicleFrame, VehicleInstance, VehicleRole } from './types'

export function earthSurfaceRoleForFrame(frame: VehicleFrame): EarthSurfaceVehicleRole | null {
  if (frame.role === 'cargo-rover') return 'cargo-rover'
  if (frame.role === 'heavy-hauler' || frame.role === 'truck') return 'heavy-hauler'
  return null
}

/** Supplies Earth with engineering limits without moving Earth routing policy into Core. */
export function toEarthSurfaceMobilityEnvelope(frame: VehicleFrame): EarthVehicleMobilityEnvelope | null {
  const role = earthSurfaceRoleForFrame(frame)
  if (!role || !frame.surfaceMobility) return null
  return {
    role,
    safeLongitudinalSlopeDeg: frame.surfaceMobility.safeLongitudinalSlopeDeg,
  }
}

export function vehicleRoleForExplorationAsset(kind: ExplorationAssetKind): VehicleRole {
  return kind === 'surface_rover' ? 'exploration-rover' : 'exploration-drone'
}

/**
 * Compatibility projection only. Exploration assets keep their current persistence
 * and richer provenance; no state is written back through this adapter.
 */
export function projectExplorationAssetInstance(asset: ExplorationAssetInstance): Pick<VehicleInstance,
  'id' | 'ownerId' | 'locationId' | 'condition' | 'modifications' | 'emergentState'
> {
  return {
    id: asset.id,
    ownerId: asset.ownerId,
    locationId: asset.locationId,
    condition: asset.condition,
    modifications: asset.modifications,
    emergentState: asset.emergentState,
  }
}

/**
 * Compatibility projection for the existing modular spacecraft runtime. It avoids
 * pretending that current ShipInstance already implements the full VehicleInstance.
 */
export function projectShipInstance(ship: ShipInstance): Pick<VehicleInstance,
  'id' | 'ownerId' | 'condition' | 'modules'
> {
  return {
    id: ship.entityId,
    ownerId: ship.ownerId,
    condition: ship.condition,
    modules: ship.modules.map(module => ({
      id: module.entityId,
      moduleTypeId: module.moduleId,
      slot: module.slot,
      condition: module.condition,
      status: module.status,
    })),
  }
}
