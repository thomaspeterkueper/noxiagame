export type RobotFleetRole = 'prospector' | 'excavator' | 'hauler' | 'maintenance'

export type RobotRetrofitProfile = {
  role: RobotFleetRole
  label: string
  modules: string[]
  capabilities: string[]
  dryMassKg: number
  peakPowerKw: number
  batteryKWh: number
  cargoCapacityT: number
  energyCost: number
  componentCost: number
}

export type RobotModuleDefinition = {
  key: string
  label: string
  equipmentClass: 'robot_module'
  massKg: number
  repairEnergyCost: number
  repairComponentCost: number
  manufactureEnergyCost: number
  manufactureComponentCost: number
}

export const ROBOT_COMMON_MODULES = ['microgravity-anchor-spikes', 'tether-reel', 'autonomy-pack'] as const

export const ROBOT_MODULE_DEFINITIONS: Record<string, RobotModuleDefinition> = {
  'spectrometer-pack': { key: 'spectrometer-pack', label: 'Spektrometerpaket', equipmentClass: 'robot_module', massKg: 32, repairEnergyCost: 3, repairComponentCost: 1, manufactureEnergyCost: 18, manufactureComponentCost: 4 },
  'ground-imaging-radar': { key: 'ground-imaging-radar', label: 'Bodenradar', equipmentClass: 'robot_module', massKg: 38, repairEnergyCost: 3, repairComponentCost: 1, manufactureEnergyCost: 20, manufactureComponentCost: 5 },
  'regolith-bucket': { key: 'regolith-bucket', label: 'Regolithschaufel', equipmentClass: 'robot_module', massKg: 66, repairEnergyCost: 4, repairComponentCost: 1, manufactureEnergyCost: 20, manufactureComponentCost: 5 },
  'reaction-canceling-auger': { key: 'reaction-canceling-auger', label: 'Reaktionskompensierter Bohrer', equipmentClass: 'robot_module', massKg: 94, repairEnergyCost: 5, repairComponentCost: 2, manufactureEnergyCost: 28, manufactureComponentCost: 7 },
  'sealed-sample-hopper': { key: 'sealed-sample-hopper', label: 'Geschlossener Materialhopper', equipmentClass: 'robot_module', massKg: 74, repairEnergyCost: 3, repairComponentCost: 1, manufactureEnergyCost: 18, manufactureComponentCost: 5 },
  'mass-balance-cell': { key: 'mass-balance-cell', label: 'Massenmesszelle', equipmentClass: 'robot_module', massKg: 22, repairEnergyCost: 2, repairComponentCost: 1, manufactureEnergyCost: 14, manufactureComponentCost: 4 },
  'tool-changer': { key: 'tool-changer', label: 'Werkzeugwechsler', equipmentClass: 'robot_module', massKg: 52, repairEnergyCost: 4, repairComponentCost: 1, manufactureEnergyCost: 22, manufactureComponentCost: 6 },
  'inspection-camera': { key: 'inspection-camera', label: 'Inspektionskamera', equipmentClass: 'robot_module', massKg: 18, repairEnergyCost: 2, repairComponentCost: 1, manufactureEnergyCost: 12, manufactureComponentCost: 3 },
  'spares-rack': { key: 'spares-rack', label: 'Ersatzteilrack', equipmentClass: 'robot_module', massKg: 46, repairEnergyCost: 2, repairComponentCost: 1, manufactureEnergyCost: 16, manufactureComponentCost: 5 },
}

export const ROBOT_REPLACEABLE_MODULE_KEYS = Object.keys(ROBOT_MODULE_DEFINITIONS)

export const ROBOT_RETROFIT_PROFILES: Record<RobotFleetRole, RobotRetrofitProfile> = {
  prospector: {
    role: 'prospector',
    label: 'Prospektion',
    modules: [...ROBOT_COMMON_MODULES, 'spectrometer-pack', 'ground-imaging-radar'],
    capabilities: ['surface-spectrometry', 'subsurface-radar', 'target-characterization'],
    dryMassKg: 265,
    peakPowerKw: 3.2,
    batteryKWh: 14,
    cargoCapacityT: 0.1,
    energyCost: 10,
    componentCost: 2,
  },
  excavator: {
    role: 'excavator',
    label: 'Aushub',
    modules: [...ROBOT_COMMON_MODULES, 'regolith-bucket', 'reaction-canceling-auger'],
    capabilities: ['anchored-excavation', 'regolith-cutting', 'pilot-extraction'],
    dryMassKg: 425,
    peakPowerKw: 8.5,
    batteryKWh: 24,
    cargoCapacityT: 0.3,
    energyCost: 16,
    componentCost: 3,
  },
  hauler: {
    role: 'hauler',
    label: 'Transport',
    modules: [...ROBOT_COMMON_MODULES, 'sealed-sample-hopper', 'mass-balance-cell'],
    capabilities: ['sealed-haulage', 'mass-accounting', 'sample-return'],
    dryMassKg: 350,
    peakPowerKw: 4.2,
    batteryKWh: 18,
    cargoCapacityT: 0.2,
    energyCost: 8,
    componentCost: 2,
  },
  maintenance: {
    role: 'maintenance',
    label: 'Wartung',
    modules: [...ROBOT_COMMON_MODULES, 'tool-changer', 'inspection-camera', 'spares-rack'],
    capabilities: ['field-inspection', 'tool-change', 'field-repair'],
    dryMassKg: 305,
    peakPowerKw: 3.8,
    batteryKWh: 16,
    cargoCapacityT: 0.2,
    energyCost: 10,
    componentCost: 2,
  },
}

export const ROBOT_FLEET_ROLES = Object.keys(ROBOT_RETROFIT_PROFILES) as RobotFleetRole[]

export function isRobotFleetRole(value: unknown): value is RobotFleetRole {
  return typeof value === 'string' && value in ROBOT_RETROFIT_PROFILES
}

export function robotRetrofitProfile(role: RobotFleetRole) {
  return ROBOT_RETROFIT_PROFILES[role]
}

export function replaceableRobotModules(modules: unknown): string[] {
  if (!Array.isArray(modules)) return []
  return modules.filter((value): value is string => typeof value === 'string' && value in ROBOT_MODULE_DEFINITIONS)
}

export function robotModuleDefinition(key: string) {
  return ROBOT_MODULE_DEFINITIONS[key] ?? null
}
