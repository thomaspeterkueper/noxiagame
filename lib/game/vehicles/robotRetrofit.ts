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

const COMMON_MODULES = ['microgravity-anchor-spikes', 'tether-reel', 'autonomy-pack']

export const ROBOT_RETROFIT_PROFILES: Record<RobotFleetRole, RobotRetrofitProfile> = {
  prospector: {
    role: 'prospector',
    label: 'Prospektion',
    modules: [...COMMON_MODULES, 'spectrometer-pack', 'ground-imaging-radar'],
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
    modules: [...COMMON_MODULES, 'regolith-bucket', 'reaction-canceling-auger'],
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
    modules: [...COMMON_MODULES, 'sealed-sample-hopper', 'mass-balance-cell'],
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
    modules: [...COMMON_MODULES, 'tool-changer', 'inspection-camera', 'spares-rack'],
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
