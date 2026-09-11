// lib/game/vehicles/types.ts
// Canonical, transport-mode agnostic vehicle model for NOXIA.
//
// Design rules:
// - type/spec data and living instance state stay separate;
// - environment compatibility is capability-driven, not planet-name-driven;
// - movement physics are delegated to domain-specific solvers;
// - cargo, crew, energy and maintenance share one vocabulary across all craft.

export type VehicleCategory =
  | 'road_vehicle'
  | 'surface_rover'
  | 'rail_vehicle'
  | 'aircraft'
  | 'surface_transfer_craft'
  | 'spacecraft'
  | 'exploration_drone'

export type MobilityDomain =
  | 'surface-wheeled'
  | 'surface-tracked'
  | 'rail'
  | 'atmospheric-flight'
  | 'ballistic-suborbital'
  | 'orbital'
  | 'interplanetary'

export type EnergyCarrier =
  | 'electricity'
  | 'hydrogen'
  | 'methane'
  | 'chemical-propellant'
  | 'nuclear'
  | 'solar'
  | 'external-grid'

export type VehicleStatus =
  | 'inactive'
  | 'ready'
  | 'operating'
  | 'maintenance'
  | 'damaged'
  | 'disabled'
  | 'lost'

export type VehicleCapability =
  | 'cargo'
  | 'crew_transport'
  | 'passenger_transport'
  | 'exploration'
  | 'construction'
  | 'towing'
  | 'autonomous'
  | 'pressurized'
  | 'docking'
  | 'surface_landing'
  | 'orbital_transfer'
  | 'intersolar_transfer'

export interface VehicleEnvironmentEnvelope {
  vacuumCapable: boolean
  atmosphereRequired: boolean
  pressurizedCabin: boolean
  minGravityMs2?: number
  maxGravityMs2?: number
  minTemperatureC?: number
  maxTemperatureC?: number
  maxTerrainSlopeDeg?: number
  dustTolerance?: 'low' | 'medium' | 'high' | 'extreme'
  radiationTolerance?: 'low' | 'medium' | 'high' | 'extreme'
}

export interface VehicleCapacitySpec {
  cargoTonnes?: number
  fluidTonnes?: number
  crew?: number
  passengers?: number
  towingTonnes?: number
}

export interface VehicleEnergySpec {
  carriers: EnergyCarrier[]
  storageCapacity?: number
  storageUnit?: 'kWh' | 'MWh' | 'kg' | 't'
  nominalConsumption?: number
  consumptionUnit?: 'kWh/km' | 'kg/km' | 'kg/h' | 't/mission' | 'abstract'
}

export interface VehicleMaintenanceSpec {
  serviceIntervalHours?: number
  serviceIntervalDistanceKm?: number
  inspectionCycles?: number
  baseWearPerOperatingHour?: number
}

export interface VehicleModuleSpec {
  id: string
  name: string
  massTonnes?: number
  capabilities?: VehicleCapability[]
  capacity?: VehicleCapacitySpec
  energy?: Partial<VehicleEnergySpec>
}

export interface VehicleType {
  id: string
  name: string
  category: VehicleCategory
  mobilityDomains: MobilityDomain[]
  capabilities: VehicleCapability[]
  dryMassTonnes?: number
  nominalSpeed?: number
  nominalSpeedUnit?: 'km/h' | 'm/s' | 'relative'
  environment: VehicleEnvironmentEnvelope
  capacity?: VehicleCapacitySpec
  energy?: VehicleEnergySpec
  maintenance?: VehicleMaintenanceSpec
  moduleSlots?: number
  provenance?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface VehicleModuleInstance {
  instanceId: string
  moduleTypeId: string
  slot?: number
  condition: number
  status: 'active' | 'damaged' | 'disabled'
  modifications?: Record<string, unknown>
}

export interface VehicleEnergyState {
  carrier: EnergyCarrier
  amount: number
  capacity?: number
  unit: 'kWh' | 'MWh' | 'kg' | 't' | 'abstract'
}

export interface VehicleCargoState {
  resourceId: string
  amount: number
  unit: 'kg' | 't' | 'm3' | 'unit'
}

export interface VehicleCrewState {
  crewIds: string[]
  passengerIds?: string[]
}

export interface VehicleMovementState {
  domain: MobilityDomain
  state: 'parked' | 'loading' | 'en-route' | 'arrived' | 'stranded'
  routeId?: string | null
  missionId?: string | null
  originId?: string | null
  destinationId?: string | null
  progress?: number
}

export interface VehicleMaintenanceState {
  operatingHours: number
  distanceKm: number
  cycles: number
  wear: number
  serviceDue: boolean
  faults: string[]
}

export interface VehicleInstance {
  id: string
  typeId: string
  ownerId: string | null
  locationId: string | null
  status: VehicleStatus
  condition: number
  movement: VehicleMovementState | null
  energy: VehicleEnergyState[]
  cargo: VehicleCargoState[]
  crew: VehicleCrewState
  maintenance: VehicleMaintenanceState
  modules: VehicleModuleInstance[]
  modifications: Record<string, unknown>
  emergentState: Record<string, unknown>
  instanceCanonicalId?: string | null
}

export interface VehicleAssemblyMember {
  vehicleId: string
  role: 'lead' | 'powered' | 'trailer' | 'car' | 'payload' | 'stage' | 'towed'
}

export interface VehicleAssembly {
  id: string
  members: VehicleAssemblyMember[]
  active: boolean
}
