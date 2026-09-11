// lib/game/vehicles/adapters.ts
// Compatibility bridges. Existing gameplay models remain authoritative while the
// unified vehicle domain is introduced incrementally.

import type { ExplorationAssetInstance, ExplorationAssetType } from '../explorationAssets'
import type { ShipFrame, ShipInstance } from '../ships'
import { shipFunctions } from '../ships'
import type { TransferCraftSemantics } from '../transportDomains'
import { emptyMaintenanceState } from './operations'
import type { VehicleCapability, VehicleInstance, VehicleType } from './types'

function explorationCapabilities(type: ExplorationAssetType): VehicleCapability[] {
  return type.kind === 'surface_rover'
    ? ['exploration']
    : ['exploration', 'autonomous']
}

export function vehicleTypeFromExplorationAsset(type: ExplorationAssetType): VehicleType {
  return {
    id: type.id,
    name: type.name,
    category: type.kind,
    mobilityDomains: type.kind === 'surface_rover' ? ['surface-wheeled'] : ['atmospheric-flight'],
    capabilities: explorationCapabilities(type),
    environment: {
      // Legacy exploration assets do not yet encode engineering envelopes.
      // Keep these deliberately conservative until OTA/NOXIA specs provide them.
      vacuumCapable: type.kind === 'surface_rover',
      atmosphereRequired: type.kind === 'exploration_drone',
      pressurizedCabin: false,
    },
    provenance: { ...type.provenance },
    metadata: { legacyModel: 'explorationAssets' },
  }
}

export function vehicleInstanceFromExplorationAsset(instance: ExplorationAssetInstance): VehicleInstance {
  return {
    id: instance.id,
    typeId: instance.typeId,
    ownerId: instance.ownerId,
    locationId: instance.locationId,
    status: instance.status === 'deployed' ? 'operating' : instance.status,
    condition: instance.condition,
    movement: null,
    energy: [],
    cargo: [],
    crew: { crewIds: [] },
    maintenance: emptyMaintenanceState(),
    modules: [],
    modifications: { ...instance.modifications },
    emergentState: { ...instance.emergentState },
    instanceCanonicalId: instance.instanceCanonicalId,
  }
}

export function vehicleTypeFromShipFrame(frame: ShipFrame): VehicleType {
  return {
    id: frame.id,
    name: frame.name,
    category: 'spacecraft',
    mobilityDomains: ['orbital', 'interplanetary'],
    capabilities: ['cargo', 'docking', 'orbital_transfer', 'intersolar_transfer'],
    dryMassTonnes: frame.hullMass,
    nominalSpeed: frame.baseSpeed,
    nominalSpeedUnit: 'relative',
    environment: {
      vacuumCapable: true,
      atmosphereRequired: false,
      pressurizedCabin: true,
      radiationTolerance: 'high',
    },
    moduleSlots: frame.slots,
    metadata: {
      legacyModel: 'ships',
      shipyard: frame.shipyard,
      cost: frame.cost,
      unlocked: frame.unlocked,
    },
  }
}

export function legacyShipCapabilities(instance: ShipInstance): VehicleCapability[] {
  const capabilities = new Set<VehicleCapability>([
    'cargo',
    'docking',
    'orbital_transfer',
    'intersolar_transfer',
  ])
  for (const fn of shipFunctions(instance)) {
    if (fn === 'construction') capabilities.add('construction')
    if (fn === 'long_range_scan' || fn === 'deep_scan') capabilities.add('exploration')
    if (fn === 'colony_supplies') capabilities.add('crew_transport')
  }
  return [...capabilities]
}

export function vehicleTypeFromTransferCraft(craft: TransferCraftSemantics): VehicleType {
  return {
    id: craft.id,
    name: craft.name,
    category: 'surface_transfer_craft',
    mobilityDomains: ['ballistic-suborbital', 'orbital'],
    capabilities: ['crew_transport', 'cargo', 'surface_landing', 'orbital_transfer'],
    environment: {
      vacuumCapable: true,
      atmosphereRequired: false,
      pressurizedCabin: true,
      radiationTolerance: 'medium',
    },
    metadata: {
      legacyModel: 'transportDomains',
      operatingDomain: craft.operatingDomain,
      mayUsePlanetarySurfacePort: craft.mayUsePlanetarySurfacePort,
      mayPerformIntersolarLeg: craft.mayPerformIntersolarLeg,
      note: craft.note,
    },
  }
}
