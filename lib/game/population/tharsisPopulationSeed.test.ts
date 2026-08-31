import assert from 'node:assert/strict'
import { THARSIS_ACTIVE_COHORT, tharsisHomeSeedId } from './tharsisPopulationSeed'

assert.equal(THARSIS_ACTIVE_COHORT.length, 30, 'controlled active cohort must contain exactly 30 people')
assert.equal(new Set(THARSIS_ACTIVE_COHORT.map((p) => p.ordinal)).size, 30, 'cohort ordinals must be unique')

const requiredSkills = [
  'medicine', 'eclss', 'water_systems', 'power_systems', 'logistics',
  'maintenance', 'materials', 'geology', 'rover_operations', 'administration',
]
for (const skill of requiredSkills) {
  assert.ok(THARSIS_ACTIVE_COHORT.some((p) => p.skillCode === skill), `missing required skill coverage: ${skill}`)
}

const allowedBuildingSeeds = new Set([
  'medical_core', 'medical_annex',
  'eclss_hub_1', 'eclss_hub_2', 'eclss_hub_3',
  'water_isru_1', 'water_isru_2', 'water_isru_3',
  'reactor_module_1', 'reactor_module_3', 'reactor_module_5',
  'black_start_1', 'black_start_2',
  'logistics_hub', 'landing_pad',
  'workshop_clean', 'workshop_heavy', 'material_complex_1', 'material_complex_2',
  'command_node_1', 'command_node_2',
])
const allowedVehicleSeeds = new Set(['rescue_rover_1', 'cargo_transporter_1', 'maintenance_vehicle_1'])

for (const person of THARSIS_ACTIVE_COHORT) {
  assert.match(tharsisHomeSeedId(person.ordinal), /^habitat_cluster_[1-6]$/)
  if (person.workKind === 'building') assert.ok(allowedBuildingSeeds.has(person.workSeedId), `unknown building seed ${person.workSeedId}`)
  else assert.ok(allowedVehicleSeeds.has(person.workSeedId), `unknown vehicle seed ${person.workSeedId}`)
}

assert.deepEqual(
  [...new Set(THARSIS_ACTIVE_COHORT.map((p) => tharsisHomeSeedId(p.ordinal)))].sort(),
  ['habitat_cluster_1', 'habitat_cluster_2', 'habitat_cluster_3', 'habitat_cluster_4', 'habitat_cluster_5', 'habitat_cluster_6'],
  'all six habitat clusters must be represented',
)

console.log('Tharsis active population cohort: OK')
