export type InteriorCapabilityDomain =
  | 'research'
  | 'maintenance'
  | 'inventory'
  | 'operations'
  | 'medical'
  | 'habitation'
  | 'utilities'
  | 'administration'
  | 'logistics'

export interface InteriorCapabilityDefinition {
  id: string
  domain: InteriorCapabilityDomain
  label: string
  description: string
  measurementCapability?: boolean
  interpretationCapability?: boolean
}

export const INTERIOR_CAPABILITY_REGISTRY = {
  'research.sample.register': {
    id: 'research.sample.register',
    domain: 'research',
    label: 'Sample registration',
    description: 'Register, identify and archive physical samples.',
  },
  'research.sample.basic-analysis': {
    id: 'research.sample.basic-analysis',
    domain: 'research',
    label: 'Basic sample analysis',
    description: 'Measure basic physical sample properties such as mass, density and visible characteristics.',
    measurementCapability: true,
  },
  'research.geoscience': {
    id: 'research.geoscience',
    domain: 'research',
    label: 'Geoscience analysis',
    description: 'Perform mineralogical and petrographic analysis and compare samples with geophysical observations.',
    measurementCapability: true,
  },
  'research.spectroscopy.raman-ir': {
    id: 'research.spectroscopy.raman-ir',
    domain: 'research',
    label: 'Raman / IR spectroscopy',
    description: 'Acquire spectroscopic material and mineral measurements using Raman or infrared instrumentation.',
    measurementCapability: true,
  },
  'research.sensor.calibration': {
    id: 'research.sensor.calibration',
    domain: 'research',
    label: 'Sensor calibration',
    description: 'Calibrate scanner and measurement modules and verify instrument response.',
    measurementCapability: true,
  },
  'research.data.reanalysis': {
    id: 'research.data.reanalysis',
    domain: 'research',
    label: 'Data reanalysis',
    description: 'Reanalyse stored measurements and combine data from multiple sensors without changing ground truth.',
    interpretationCapability: true,
  },
  'maintenance.general': {
    id: 'maintenance.general',
    domain: 'maintenance',
    label: 'Maintenance',
    description: 'Inspect, service and repair supported equipment.',
  },
  'fabrication.general': {
    id: 'fabrication.general',
    domain: 'maintenance',
    label: 'Fabrication',
    description: 'Fabricate supported parts and technical components.',
  },
  'inventory.storage': {
    id: 'inventory.storage',
    domain: 'inventory',
    label: 'Storage',
    description: 'Store and retrieve inventory assigned to this interior host.',
  },
  'station.docking': {
    id: 'station.docking',
    domain: 'logistics',
    label: 'Docking',
    description: 'Support docking and undocking operations at the station interface.',
  },
  'cargo.transfer': {
    id: 'cargo.transfer',
    domain: 'logistics',
    label: 'Cargo transfer',
    description: 'Transfer cargo between connected logistics nodes.',
  },
  'station.depot': {
    id: 'station.depot',
    domain: 'inventory',
    label: 'Station depot',
    description: 'Expose depot storage operations for an orbital station.',
  },
  'medical.general': {
    id: 'medical.general',
    domain: 'medical',
    label: 'Medical care',
    description: 'Provide general medical treatment and clinical support.',
  },
  'crew.habitation': {
    id: 'crew.habitation',
    domain: 'habitation',
    label: 'Crew habitation',
    description: 'Provide habitable crew space and associated life-support usage.',
  },
  'operations.station': {
    id: 'operations.station',
    domain: 'operations',
    label: 'Station operations',
    description: 'Coordinate station operations and local service orchestration.',
  },
  'utilities.local': {
    id: 'utilities.local',
    domain: 'utilities',
    label: 'Local utilities',
    description: 'Host local technical utility systems for the interior.',
  },
  'administration.general': {
    id: 'administration.general',
    domain: 'administration',
    label: 'Administration',
    description: 'Provide administrative workspace and related management functions.',
  },
} as const satisfies Record<string, InteriorCapabilityDefinition>

export type InteriorCapabilityId = keyof typeof INTERIOR_CAPABILITY_REGISTRY

export function isInteriorCapabilityId(value: string): value is InteriorCapabilityId {
  return value in INTERIOR_CAPABILITY_REGISTRY
}

export function getInteriorCapabilityDefinition(
  capabilityId: string,
): InteriorCapabilityDefinition | null {
  if (!isInteriorCapabilityId(capabilityId)) return null
  return INTERIOR_CAPABILITY_REGISTRY[capabilityId]
}
