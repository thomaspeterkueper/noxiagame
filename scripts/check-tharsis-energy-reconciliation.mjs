import fs from 'node:fs'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const seed = read('lib/game/seeds/tharsisHubSeed.ts')
const migration = read('supabase/migrations/20260915164500_tharsis_energy_reconciliation.sql')
const executableSql = migration
  .split('\n')
  .filter(line => !line.trimStart().startsWith('--'))
  .join('\n')

const canonical = new Set(
  [...seed.matchAll(/entityId:\s*'(reactor_module|black_start)',\s*row:\s*(\d+),\s*col:\s*(\d+)/g)]
    .map(([, entity, row, col]) => `${entity}:${Number(row)}:${Number(col)}`),
)

const reconciled = new Set(
  [...migration.matchAll(/\((\d+)::smallint,\s*(\d+)::smallint,\s*'(reactor_module|black_start)'::text\)/g)]
    .map(([, row, col, entity]) => `${entity}:${Number(row)}:${Number(col)}`),
)

assert(canonical.size === 9, `canonical Tharsis seed must expose 9 energy assets, got ${canonical.size}`)
assert(reconciled.size === 9, `reconciliation must cover 9 unique energy targets, got ${reconciled.size}`)

for (const target of canonical) {
  assert(reconciled.has(target), `reconciliation is missing canonical target ${target}`)
}
for (const target of reconciled) {
  assert(canonical.has(target), `reconciliation invents non-canonical target ${target}`)
}

assert(!/DELETE\s+FROM\s+tile_entities/i.test(executableSql), 'reconciliation must never delete existing tile entities')
assert(!/UPDATE\s+tile_entities/i.test(executableSql), 'reconciliation must never update existing tile entities')
assert(!/INSERT\s+INTO\s+location_utilities/i.test(executableSql), 'E0 must not synthesize a utility graph before its schema exists')
assert(/ON\s+CONFLICT\s*\(key\)\s+DO\s+NOTHING/i.test(executableSql), 'building definitions must be additive and non-overwriting')
assert(/target cell .* occupied by incompatible asset/i.test(migration), 'target-cell collisions must fail closed')
assert(/reactor_count\s*<>\s*6\s+OR\s+black_start_count\s*<>\s*3/i.test(migration), 'migration must verify the complete 6+3 canonical energy set')

console.log('Tharsis energy reconciliation contract passed (6 reactors + 3 black-start nodes, additive/fail-closed)')
