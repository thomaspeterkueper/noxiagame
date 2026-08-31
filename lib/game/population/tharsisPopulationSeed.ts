// NOX-LIVING-20260831 — controlled active Tharsis population cohort.
// Aggregate colony population remains 497; only this bounded slice is simulated.

export type TharsisPopulationSeed = {
  ordinal: number
  roleCode: string
  skillCode: string
  skillLevel: number
  workKind: 'building' | 'vehicle'
  workSeedId: string
}

const roleGroups: Array<Omit<TharsisPopulationSeed, 'ordinal'>> = [
  { roleCode: 'medical_clinician', skillCode: 'medicine', skillLevel: 0.72, workKind: 'building', workSeedId: 'medical_core' },
  { roleCode: 'medical_clinician', skillCode: 'medicine', skillLevel: 0.66, workKind: 'building', workSeedId: 'medical_core' },
  { roleCode: 'medical_technician', skillCode: 'emergency_medicine', skillLevel: 0.61, workKind: 'building', workSeedId: 'medical_core' },
  { roleCode: 'medical_technician', skillCode: 'emergency_medicine', skillLevel: 0.59, workKind: 'building', workSeedId: 'medical_annex' },

  { roleCode: 'eclss_operator', skillCode: 'eclss', skillLevel: 0.68, workKind: 'building', workSeedId: 'eclss_hub_1' },
  { roleCode: 'eclss_operator', skillCode: 'eclss', skillLevel: 0.63, workKind: 'building', workSeedId: 'eclss_hub_2' },
  { roleCode: 'eclss_operator', skillCode: 'eclss', skillLevel: 0.61, workKind: 'building', workSeedId: 'eclss_hub_3' },
  { roleCode: 'water_process_operator', skillCode: 'water_systems', skillLevel: 0.64, workKind: 'building', workSeedId: 'water_isru_1' },

  { roleCode: 'power_operator', skillCode: 'power_systems', skillLevel: 0.70, workKind: 'building', workSeedId: 'reactor_module_1' },
  { roleCode: 'power_operator', skillCode: 'power_systems', skillLevel: 0.65, workKind: 'building', workSeedId: 'reactor_module_3' },
  { roleCode: 'power_operator', skillCode: 'power_systems', skillLevel: 0.62, workKind: 'building', workSeedId: 'reactor_module_5' },
  { roleCode: 'black_start_technician', skillCode: 'power_systems', skillLevel: 0.67, workKind: 'building', workSeedId: 'black_start_1' },
  { roleCode: 'black_start_technician', skillCode: 'power_systems', skillLevel: 0.60, workKind: 'building', workSeedId: 'black_start_2' },

  { roleCode: 'logistics_operator', skillCode: 'logistics', skillLevel: 0.64, workKind: 'building', workSeedId: 'logistics_hub' },
  { roleCode: 'logistics_operator', skillCode: 'logistics', skillLevel: 0.58, workKind: 'building', workSeedId: 'logistics_hub' },
  { roleCode: 'landing_operations', skillCode: 'logistics', skillLevel: 0.66, workKind: 'building', workSeedId: 'landing_pad' },
  { roleCode: 'landing_operations', skillCode: 'logistics', skillLevel: 0.57, workKind: 'building', workSeedId: 'landing_pad' },

  { roleCode: 'precision_technician', skillCode: 'maintenance', skillLevel: 0.67, workKind: 'building', workSeedId: 'workshop_clean' },
  { roleCode: 'heavy_technician', skillCode: 'maintenance', skillLevel: 0.69, workKind: 'building', workSeedId: 'workshop_heavy' },
  { roleCode: 'materials_technician', skillCode: 'materials', skillLevel: 0.62, workKind: 'building', workSeedId: 'material_complex_1' },
  { roleCode: 'materials_technician', skillCode: 'materials', skillLevel: 0.59, workKind: 'building', workSeedId: 'material_complex_2' },

  { roleCode: 'field_geologist', skillCode: 'geology', skillLevel: 0.71, workKind: 'building', workSeedId: 'water_isru_1' },
  { roleCode: 'field_geologist', skillCode: 'geology', skillLevel: 0.64, workKind: 'building', workSeedId: 'water_isru_2' },
  { roleCode: 'field_geologist', skillCode: 'geology', skillLevel: 0.60, workKind: 'building', workSeedId: 'water_isru_3' },

  { roleCode: 'rescue_rover_operator', skillCode: 'rover_operations', skillLevel: 0.68, workKind: 'vehicle', workSeedId: 'rescue_rover_1' },
  { roleCode: 'cargo_rover_operator', skillCode: 'rover_operations', skillLevel: 0.63, workKind: 'vehicle', workSeedId: 'cargo_transporter_1' },
  { roleCode: 'maintenance_rover_operator', skillCode: 'rover_operations', skillLevel: 0.61, workKind: 'vehicle', workSeedId: 'maintenance_vehicle_1' },

  { roleCode: 'operations_administration', skillCode: 'administration', skillLevel: 0.65, workKind: 'building', workSeedId: 'command_node_1' },
  { roleCode: 'operations_administration', skillCode: 'administration', skillLevel: 0.60, workKind: 'building', workSeedId: 'command_node_1' },
  { roleCode: 'operations_administration', skillCode: 'administration', skillLevel: 0.63, workKind: 'building', workSeedId: 'command_node_2' },
]

export const THARSIS_ACTIVE_COHORT: TharsisPopulationSeed[] = roleGroups.map((seed, index) => ({
  ordinal: index + 1,
  ...seed,
}))

export function tharsisHomeSeedId(ordinal: number): string {
  return `habitat_cluster_${((ordinal - 1) % 6) + 1}`
}
