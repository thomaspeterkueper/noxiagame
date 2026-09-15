import fs from 'node:fs'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const seed = read('lib/game/seeds/tharsisHubSeed.ts')
const migration = read('supabase/migrations/20260915173000_tharsis_power_grid_topology_e1.sql')
const executableSql = migration
  .split('\n')
  .filter(line => !line.trimStart().startsWith('--'))
  .join('\n')

assert(!/DELETE\s+FROM\s+location_utilit/i.test(executableSql), 'E1 must never delete persisted utility topology')
assert(!/UPDATE\s+location_utilit/i.test(executableSql), 'E1 must never rewrite persisted utility topology')
assert(/CREATE TABLE IF NOT EXISTS location_utilities/i.test(migration), 'E1 must materialize the compatible location_utilities schema')
assert(/CREATE TABLE IF NOT EXISTS location_utility_edges/i.test(migration), 'E1 must materialize structural utility edges')
assert(/CREATE TABLE IF NOT EXISTS location_utility_feeders/i.test(migration), 'E1 must materialize structural utility feeders')
assert(/ARRAY\['power'\]::text\[\]/i.test(migration), 'E1 must be scoped explicitly to the power medium')
assert(!/available_power|firm_energy|state_of_charge|transmission_capacity_mw\s+(numeric|integer|real|double)/i.test(executableSql), 'E1 must not invent operational power state or MW capacity columns')

const ringSection = seed
  .split('export const THARSIS_HUB_UTILITY_RINGS')[1]
  ?.split('export const THARSIS_HUB_UTILITY_LINKS')[0]
assert(Boolean(ringSection), 'canonical utility-ring section must exist')

const canonicalNodes = new Set()
for (const match of ringSection.matchAll(/ring:\s*'([AB])',[\s\S]*?nodes:\s*\[([\s\S]*?)\]\s*,?\n\s*\}/g)) {
  const [, ring, body] = match
  for (const node of body.matchAll(/\[(\d+),\s*(\d+)\]/g)) {
    canonicalNodes.add(`${ring}:${Number(node[1])}:${Number(node[2])}`)
  }
}

assert(canonicalNodes.size === 100, `canonical power topology must contain 100 A/B nodes, got ${canonicalNodes.size}`)
assert([...canonicalNodes].filter(node => node.startsWith('A:')).length === 59, 'canonical ring A must contain 59 nodes')
assert([...canonicalNodes].filter(node => node.startsWith('B:')).length === 41, 'canonical ring B must contain 41 nodes')

const migrationNodeSection = migration
  .split('-- E1 backbone nodes.')[1]
  ?.split('CREATE TABLE IF NOT EXISTS location_utility_edges')[0]
assert(Boolean(migrationNodeSection), 'E1 backbone-node section must exist')

const migrationNodes = new Set(
  [...migrationNodeSection.matchAll(/\('([AB])',\s*(\d+),\s*(\d+)\)/g)]
    .map(([, ring, row, col]) => `${ring}:${Number(row)}:${Number(col)}`),
)
assert(migrationNodes.size === 100, `E1 migration must contain 100 unique backbone nodes, got ${migrationNodes.size}`)
for (const node of canonicalNodes) assert(migrationNodes.has(node), `E1 migration is missing canonical power node ${node}`)
for (const node of migrationNodes) assert(canonicalNodes.has(node), `E1 migration invents non-canonical power node ${node}`)

const utilityLinkSection = seed.split('export const THARSIS_HUB_UTILITY_LINKS')[1]
assert(Boolean(utilityLinkSection), 'canonical utility-link section must exist')
const canonicalFeeders = new Set(
  [...utilityLinkSection.matchAll(/objectId:\s*'(reactor_module_[1-6]|black_start_[1-3])',\s*ring:\s*'([AB])',\s*node:\s*\[(\d+),\s*(\d+)\]/g)]
    .map(([, objectId, ring, row, col]) => `${objectId}:${ring}:${Number(row)}:${Number(col)}`),
)
assert(canonicalFeeders.size === 18, `canonical energy topology must expose 18 A/B feeders, got ${canonicalFeeders.size}`)

const feederSection = migration
  .split('-- E1 energy feeders.')[1]
  ?.split('-- Fail closed:')[0]
assert(Boolean(feederSection), 'E1 feeder section must exist')
const migrationFeeders = new Set(
  [...feederSection.matchAll(/\('(reactor_module_[1-6]|black_start_[1-3])','[^']+',\d+,\d+,'([AB])',(\d+),(\d+)\)/g)]
    .map(([, objectId, ring, row, col]) => `${objectId}:${ring}:${Number(row)}:${Number(col)}`),
)
assert(migrationFeeders.size === 18, `E1 migration must contain 18 unique energy feeders, got ${migrationFeeders.size}`)
for (const feeder of canonicalFeeders) assert(migrationFeeders.has(feeder), `E1 migration is missing canonical energy feeder ${feeder}`)
for (const feeder of migrationFeeders) assert(canonicalFeeders.has(feeder), `E1 migration invents non-canonical energy feeder ${feeder}`)

assert(/a_nodes\s*<>\s*59\s+OR\s+b_nodes\s*<>\s*41/i.test(migration), 'E1 migration must verify the 59+41 backbone-node invariant')
assert(/a_edges\s*<>\s*58\s+OR\s+b_edges\s*<>\s*40/i.test(migration), 'E1 migration must verify connected-tree edge counts')
assert(/matching_feeders\s*<>\s*18\s+OR\s+dual_fed_assets\s*<>\s*9/i.test(migration), 'E1 migration must verify 18 feeders and 9 dual-fed energy assets')

console.log('Tharsis E1 power-grid contract passed (100 backbone nodes, 98 structural edges, 18 canonical energy feeders)')
