import type { InteriorCapabilityId } from './registry'

export type InteriorFunctionKind =
  | 'inspect'
  | 'operate'
  | 'analyze'
  | 'transfer'
  | 'maintain'
  | 'treat'
  | 'administer'
  | 'inhabit'

export interface InteriorFunctionDefinition {
  id: string
  capabilityId: InteriorCapabilityId
  kind: InteriorFunctionKind
  label: string
  description: string
  mutatesWorldState: boolean
}

export const INTERIOR_FUNCTION_REGISTRY = {
  'sample.register': {
    id: 'sample.register',
    capabilityId: 'research.sample.register',
    kind: 'operate',
    label: 'Register sample',
    description: 'Create or update the gameplay-facing registration state of a physical sample.',
    mutatesWorldState: true,
  },
  'sample.basic-analysis': {
    id: 'sample.basic-analysis',
    capabilityId: 'research.sample.basic-analysis',
    kind: 'analyze',
    label: 'Run basic sample analysis',
    description: 'Acquire basic physical measurements from a sample.',
    mutatesWorldState: true,
  },
  'sample.geoscience-analysis': {
    id: 'sample.geoscience-analysis',
    capabilityId: 'research.geoscience',
    kind: 'analyze',
    label: 'Run geoscience analysis',
    description: 'Acquire mineralogical or petrographic measurements from a sample.',
    mutatesWorldState: true,
  },
  'sample.raman-ir-analysis': {
    id: 'sample.raman-ir-analysis',
    capabilityId: 'research.spectroscopy.raman-ir',
    kind: 'analyze',
    label: 'Run Raman / IR analysis',
    description: 'Acquire spectroscopic measurements without embedding interpretation truth in the room function.',
    mutatesWorldState: true,
  },
  'sensor.calibrate': {
    id: 'sensor.calibrate',
    capabilityId: 'research.sensor.calibration',
    kind: 'maintain',
    label: 'Calibrate sensor',
    description: 'Perform a supported sensor calibration workflow.',
    mutatesWorldState: true,
  },
  'data.reanalyse': {
    id: 'data.reanalyse',
    capabilityId: 'research.data.reanalysis',
    kind: 'analyze',
    label: 'Reanalyse measurement data',
    description: 'Reprocess stored measurements against current player knowledge without changing ground truth.',
    mutatesWorldState: true,
  },
  'equipment.maintain': {
    id: 'equipment.maintain',
    capabilityId: 'maintenance.general',
    kind: 'maintain',
    label: 'Maintain equipment',
    description: 'Perform a maintenance action against supported equipment.',
    mutatesWorldState: true,
  },
  'inventory.open': {
    id: 'inventory.open',
    capabilityId: 'inventory.storage',
    kind: 'inspect',
    label: 'Open storage',
    description: 'Inspect inventory available through this room.',
    mutatesWorldState: false,
  },
  'cargo.transfer': {
    id: 'cargo.transfer',
    capabilityId: 'cargo.transfer',
    kind: 'transfer',
    label: 'Transfer cargo',
    description: 'Request cargo transfer through the shared logistics domain.',
    mutatesWorldState: true,
  },
  'station.dock': {
    id: 'station.dock',
    capabilityId: 'station.docking',
    kind: 'operate',
    label: 'Dock / undock',
    description: 'Expose docking operations without owning the authoritative travel or vehicle state.',
    mutatesWorldState: true,
  },
  'station.depot.open': {
    id: 'station.depot.open',
    capabilityId: 'station.depot',
    kind: 'inspect',
    label: 'Open station depot',
    description: 'Inspect the depot node exposed by the station service layer.',
    mutatesWorldState: false,
  },
  'medical.treat': {
    id: 'medical.treat',
    capabilityId: 'medical.general',
    kind: 'treat',
    label: 'Provide treatment',
    description: 'Expose a medical action surface; authoritative person state remains in the people domain.',
    mutatesWorldState: true,
  },
  'crew.habitation.inspect': {
    id: 'crew.habitation.inspect',
    capabilityId: 'crew.habitation',
    kind: 'inhabit',
    label: 'Inspect habitation',
    description: 'Expose habitation state associated with this interior host.',
    mutatesWorldState: false,
  },
  'station.operations.open': {
    id: 'station.operations.open',
    capabilityId: 'operations.station',
    kind: 'administer',
    label: 'Open station operations',
    description: 'Expose station service coordination without duplicating station service truth.',
    mutatesWorldState: false,
  },
} as const satisfies Record<string, InteriorFunctionDefinition>

export type InteriorFunctionId = keyof typeof INTERIOR_FUNCTION_REGISTRY

export function getInteriorFunctionsForCapability(
  capabilityId: InteriorCapabilityId,
): InteriorFunctionDefinition[] {
  return Object.values(INTERIOR_FUNCTION_REGISTRY).filter(
    definition => definition.capabilityId === capabilityId,
  )
}
