import type { InteriorFunctionId } from './functions'

export type InteriorDomainObjectKind =
  | 'sample'
  | 'instrument'
  | 'measurement'
  | 'raw-data'
  | 'interpretation'
  | 'discovery'
  | 'equipment'
  | 'inventory'
  | 'vehicle'
  | 'person'
  | 'habitation'
  | 'station-service'

export interface InteriorDomainObjectRef {
  kind: InteriorDomainObjectKind
  id: string
}

export interface InteriorFunctionDomainBinding {
  functionId: InteriorFunctionId
  requiredInputs: readonly InteriorDomainObjectKind[]
  optionalInputs?: readonly InteriorDomainObjectKind[]
  expectedOutputs?: readonly InteriorDomainObjectKind[]
  authoritativeDomains: readonly string[]
  notes?: string
}

/**
 * This registry describes which authoritative gameplay objects an interior
 * function needs or may expose. It intentionally does not define or persist
 * those objects. The owning domain remains responsible for validation,
 * persistence, lifecycle and ground truth.
 */
export const INTERIOR_FUNCTION_DOMAIN_BINDINGS: Record<
  InteriorFunctionId,
  InteriorFunctionDomainBinding
> = {
  'sample.register': {
    functionId: 'sample.register',
    requiredInputs: ['sample'],
    expectedOutputs: ['sample'],
    authoritativeDomains: ['research.samples'],
    notes: 'Registration changes sample metadata/state, not physical ground truth.',
  },
  'sample.basic-analysis': {
    functionId: 'sample.basic-analysis',
    requiredInputs: ['sample', 'instrument'],
    expectedOutputs: ['measurement', 'raw-data'],
    authoritativeDomains: ['research.samples', 'research.measurements', 'research.instruments'],
  },
  'sample.geoscience-analysis': {
    functionId: 'sample.geoscience-analysis',
    requiredInputs: ['sample', 'instrument'],
    optionalInputs: ['raw-data'],
    expectedOutputs: ['measurement', 'raw-data'],
    authoritativeDomains: ['research.samples', 'research.measurements', 'research.instruments'],
  },
  'sample.raman-ir-analysis': {
    functionId: 'sample.raman-ir-analysis',
    requiredInputs: ['sample', 'instrument'],
    expectedOutputs: ['measurement', 'raw-data'],
    authoritativeDomains: ['research.samples', 'research.measurements', 'research.instruments'],
    notes: 'The measurement result is distinct from later knowledge-driven interpretation.',
  },
  'sensor.calibrate': {
    functionId: 'sensor.calibrate',
    requiredInputs: ['instrument'],
    expectedOutputs: ['measurement', 'raw-data'],
    authoritativeDomains: ['research.instruments', 'research.measurements'],
  },
  'data.reanalyse': {
    functionId: 'data.reanalyse',
    requiredInputs: ['raw-data'],
    optionalInputs: ['measurement', 'sample'],
    expectedOutputs: ['interpretation', 'discovery'],
    authoritativeDomains: ['research.measurements', 'knowledge', 'discoveries'],
    notes: 'Reanalysis may change interpretation/discovery state but never ground truth or stored raw measurements.',
  },
  'equipment.maintain': {
    functionId: 'equipment.maintain',
    requiredInputs: ['equipment'],
    authoritativeDomains: ['condition', 'maintenance'],
  },
  'inventory.open': {
    functionId: 'inventory.open',
    requiredInputs: ['inventory'],
    authoritativeDomains: ['inventory'],
  },
  'cargo.transfer': {
    functionId: 'cargo.transfer',
    requiredInputs: ['inventory'],
    optionalInputs: ['vehicle', 'station-service'],
    expectedOutputs: ['inventory'],
    authoritativeDomains: ['logistics', 'inventory', 'vehicles'],
  },
  'station.dock': {
    functionId: 'station.dock',
    requiredInputs: ['vehicle', 'station-service'],
    authoritativeDomains: ['orbit', 'travel', 'vehicles'],
  },
  'station.depot.open': {
    functionId: 'station.depot.open',
    requiredInputs: ['inventory', 'station-service'],
    authoritativeDomains: ['inventory', 'station-services'],
  },
  'medical.treat': {
    functionId: 'medical.treat',
    requiredInputs: ['person'],
    authoritativeDomains: ['people'],
  },
  'crew.habitation.inspect': {
    functionId: 'crew.habitation.inspect',
    requiredInputs: ['habitation'],
    authoritativeDomains: ['population', 'habitation'],
  },
  'station.operations.open': {
    functionId: 'station.operations.open',
    requiredInputs: ['station-service'],
    authoritativeDomains: ['station-services'],
  },
}

export function getInteriorFunctionDomainBinding(
  functionId: InteriorFunctionId,
): InteriorFunctionDomainBinding {
  return INTERIOR_FUNCTION_DOMAIN_BINDINGS[functionId]
}

export function hasRequiredDomainObjects(
  binding: InteriorFunctionDomainBinding,
  refs: readonly InteriorDomainObjectRef[],
): boolean {
  return binding.requiredInputs.every(
    requiredKind => refs.some(ref => ref.kind === requiredKind && ref.id.length > 0),
  )
}
