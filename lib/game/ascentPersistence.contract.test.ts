import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260919152000_persistent_ascent_core.sql'),
  'utf8',
)
const api = readFileSync(resolve(process.cwd(), 'app/api/game/ascent/route.ts'), 'utf8')

// Persistence follows the already-accepted ascent-control phases.
for (const phase of ['surface', 'ascent-authorized', 'ascending', 'orbital-insertion', 'orbital-arrival']) {
  assert.ok(migration.includes(`'${phase}'`), `missing persistent phase ${phase}`)
}

// One ship may not run two concurrent ascents.
assert.ok(migration.includes('ascent_missions_active_ship_uidx'))
assert.ok(migration.includes("where status = 'active'"))

// Commands are idempotent and command reuse with different semantics must fail.
assert.ok(migration.includes('ascent_commands'))
assert.ok(migration.includes('NOXIA_ASCENT_COMMAND_CONFLICT'))
assert.ok(migration.includes("jsonb_build_object('idempotent', true)"))

// Core must reject obvious physical/state conflicts before authorization.
assert.ok(migration.includes('NOXIA_ASCENT_NOT_ON_DEPARTURE_SURFACE'))
assert.ok(migration.includes('NOXIA_ASCENT_ACTIVE_DOCKING_CONNECTION'))
assert.ok(migration.includes('NOXIA_ASCENT_CONFLICTING_MISSION'))

// The persistence layer stores authority provenance, not invented flight constants.
assert.ok(migration.includes('engineering_authority_ref'))
for (const forbidden of ['delta_v', 'delta-v', 'isp', 'specific_impulse', 'fuel_required', 'flight_duration']) {
  assert.equal(migration.toLowerCase().includes(forbidden), false, `unexpected physics default: ${forbidden}`)
}

// Reaching orbital arrival hands off to Arrival Control; it must not dock or teleport the ship.
assert.ok(migration.includes("'arrival-rendezvous'"))
assert.equal(/update\s+public\.ships/i.test(migration), false, 'ascent persistence must not mutate ship location directly')
assert.equal(/insert\s+into\s+public\.docking_connections/i.test(migration), false, 'ascent persistence must not dock')

// Engineering authority now exists. The public route may invoke the trusted
// authorization command only after server-side readiness/Engineering resolution.
assert.ok(api.includes('resolveAscentReadiness('))
assert.ok(api.includes('authorizeAscentCommand({'))
assert.ok(api.includes('ASCENT_READINESS_BLOCKED'))
assert.ok(api.includes('ASCENT_EXECUTION_UNAVAILABLE'))
assert.equal(api.includes('body.engineering'), false, 'client must not supply Engineering authority')
assert.equal(api.includes('transitionAscentCommand('), false, 'public route must not expose manual low-level transitions')

console.log('ascent persistence contract tests passed')
