// lib/game/vehicles/types.ts
// Shared NOXIA vehicle-domain contract.
//
// This layer is intentionally world-body independent and persistence agnostic.
// Earth/Moon/Mars decide route/traversal policy; Core owns authoritative state.

export type VehicleDomain =
  | 'surface'
  | 'rail'
  | 'atmospheric'
  | 'surface-transfer'
  | 'orbital'
  | 'intersolar'

export type VehicleMobilityMode =
  | 'wheeled'
  | 'tracked'
  | 'rail'
  | 'flight'
  | 'rocket'
  | 'orbital'

export type VehicleRole =
  | 'cargo-rover'
  | 'heavy-hauler'
  | 'exploration-rover'
  | 'exploration-drone'
  | 'truck'
  | 'train'
  | 'aircraft'
  | 'transfer-shuttle'
  | 'cargo-spacecraft'
  | 'exploration-spacecraft'
  | 'construction-spacecraft'

export type VehicleOperationalStatus =
  | 'inactive'
  | 'ready'
  | 'reserved'
  | 'loading'
  | 'in_transit'
  | 'unloading'
  | 'maintenance'
  | 'damaged'
  | 'disabled'
  | 'lost'

export type EnergyCarrier =
  | 'electricity'
  | 'chemical-fuel'
  | 'hydrogen'
  | 'methane'
  | 'reaction-mass'
  | 'other'

export interface VehicleEnergyStoreSpec {
  id: string
  carrier: EnergyCarrier
  capacity: number
  unit: 'kWh' | 'kg' | 't' | 'game-unit'
}

export interface VehicleCargoSpec {
  massCapacityKg: number
  volumeCapacityM3?: number | null
  fluidCapacityKg?: number | null
}

export interface VehicleCrewSpec {
  minCrew: number
  maxCrew: number
  passengerCapacity?: number
}

export interface VehicleEnvironmentEnvelope {
  /** Minimum/maximum local gravity supported by the design. */
  gravityMs2?: { min: number; max: number } | null
  /** Vehicle can operate in hard vacuum. */
  vacuumCapable: boolean
  /** Vehicle requires a surrounding atmosphere for mobility/propulsion. */
  atmosphereRequired: boolean
  /** Pressurised occupied volume exists. */
  pressurized: boolean
  /** Generic dust mitigation capability; world policy may still reject terrain. */
  dustTolerant?: boolean
  temperatureC?: { min: number; max: number } | null
}

export interface SurfaceMobilityEnvelope {
  mode: Extract<VehicleMobilityMode, 'wheeled' | 'tracked'>
  /** Safe longitudinal slope supplied to world-specific traversal policy. */
  safeLongitudinalSlopeDeg: number
  /** Nominal reference speed. World routing applies terrain/road multipliers. */
  referenceSpeedKph: number
}

export interface VehicleFrame {
  id: string
  name: string
  role: VehicleRole
  domains: readonly VehicleDomain[]
  mobilityModes: readonly VehicleMobilityMode[]
  dryMassKg: number
  cargo: VehicleCargoSpec
  crew: VehicleCrewSpec
  energyStores: readonly VehicleEnergyStoreSpec[]
  environment: VehicleEnvironmentEnvelope
  surfaceMobility?: SurfaceMobilityEnvelope | null
  moduleSlots?: number | null
}

export interface VehicleModuleInstance {
  id: string
  moduleTypeId: string
  slot?: number | null
  condition: number
  status: 'active' | 'damaged' | 'disabled'
}

export interface VehicleEnergyState {
  storeId: string
  amount: number
}

export interface VehicleCargoLoad {
  commodityId: string
  amount: number
  unit: 'kg' | 't' | 'game-unit'
}

/**
 * Authoritative living vehicle state. Route geometry and world traversal policy
 * are deliberately not persisted here; transport jobs reference validated route
 * assessments separately.
 */
export interface VehicleInstance {
  id: string
  frameId: string
  ownerId: string | null
  locationId: string | null
  status: VehicleOperationalStatus
  condition: number
  wear: number
  energy: VehicleEnergyState[]
  cargo: VehicleCargoLoad[]
  crewIds: string[]
  modules: VehicleModuleInstance[]
  modifications: Record<string, unknown>
  emergentState: Record<string, unknown>
}

export interface VehicleAvailability {
  vehicleId: string
  available: boolean
  reasons: Array<
    | 'not-owned'
    | 'wrong-location'
    | 'already-reserved'
    | 'in-transit'
    | 'maintenance'
    | 'damaged'
    | 'disabled'
    | 'insufficient-capacity'
    | 'domain-incompatible'
    | 'environment-incompatible'
  >
}

export function isVehicleOperational(status: VehicleOperationalStatus): boolean {
  return status === 'ready' || status === 'reserved' || status === 'loading' || status === 'in_transit' || status === 'unloading'
}

export function validateVehicleFrame(frame: VehicleFrame): string[] {
  const errors: string[] = []
  if (!frame.id) errors.push('frame id is required')
  if (!frame.name) errors.push('frame name is required')
  if (!Number.isFinite(frame.dryMassKg) || frame.dryMassKg <= 0) errors.push('dryMassKg must be positive')
  if (!Number.isFinite(frame.cargo.massCapacityKg) || frame.cargo.massCapacityKg < 0) errors.push('cargo massCapacityKg must be non-negative')
  if (frame.crew.minCrew < 0 || frame.crew.maxCrew < frame.crew.minCrew) errors.push('crew limits are invalid')
  if (frame.surfaceMobility) {
    if (!frame.domains.includes('surface')) errors.push('surfaceMobility requires surface domain')
    if (!frame.mobilityModes.includes(frame.surfaceMobility.mode)) errors.push('surfaceMobility mode must be declared in mobilityModes')
    if (!Number.isFinite(frame.surfaceMobility.safeLongitudinalSlopeDeg) || frame.surfaceMobility.safeLongitudinalSlopeDeg <= 0) errors.push('safeLongitudinalSlopeDeg must be positive')
    if (!Number.isFinite(frame.surfaceMobility.referenceSpeedKph) || frame.surfaceMobility.referenceSpeedKph <= 0) errors.push('referenceSpeedKph must be positive')
  }
  return errors
}
