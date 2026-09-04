// NOX-LIVING-20260831 — static regression guard for the SQL seed contract.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { THARSIS_HUB_POPULATION, THARSIS_HUB_BUILDINGS } from '../seeds/tharsisHubSeed'

// Run via the seed-contract script from the package root (compiled to CommonJS
// like the scanner-domain test), so the migration path is anchored to cwd.
const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260831103000_tharsis_active_population_seed.sql'), 'utf8')

if (THARSIS_HUB_POPULATION !== 497) throw new Error('canonical Tharsis aggregate population changed')
if (!/FOR (v_)?g IN 1\.\.36 LOOP/.test(migration)) throw new Error('active cohort must contain exactly 36 generated people')
if (!migration.includes("person_key IS NULL")) throw new Error('active cohort must remain unnamed')
if (!migration.includes("assignment_type='home'")) throw new Error('home assignment acceptance guard missing')
if (!migration.includes("assignment_type='work'")) throw new Error('work assignment acceptance guard missing')
if (!migration.includes('population FROM locations') || !migration.includes('<> 497')) throw new Error('aggregate population invariant missing')

const requiredWorkObjects = [
  'medical_core', 'eclss_hub_1', 'water_isru_1', 'reactor_module_1',
  'logistics_hub', 'workshop_heavy', 'material_complex_1', 'command_node_1',
]
const seedIds = new Set(THARSIS_HUB_BUILDINGS.map((building) => building.id))
for (const id of requiredWorkObjects) {
  if (!seedIds.has(id)) throw new Error(`active population work target is not canonical: ${id}`)
  if (!migration.includes(`v_work_seed := '${id}'`)) throw new Error(`migration does not bind role to ${id}`)
}

for (let i = 1; i <= 6; i += 1) {
  if (!seedIds.has(`habitat_cluster_${i}`)) throw new Error(`canonical habitat_cluster_${i} missing`)
}

console.log('✔ Tharsis active population seed contract: 36 active people within aggregate 497')
