import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260919170000_orbital_presence_from_ascent.sql'),
  'utf8',
)
const facade = readFileSync(resolve(process.cwd(), 'lib/game/core/orbitalPresence.ts'), 'utf8')
const executor = readFileSync(resolve(process.cwd(), 'lib/game/core/ascentExecution.ts'), 'utf8')

// Orbital presence is its own authoritative state, not fake docking or legacy ship transit.
assert.ok(migration.includes('create table if not exists public.orbital_presence'))
assert.ok(migration.includes('orbit_node_slug'))
assert.ok(migration.includes('body_slug'))
assert.ok(migration.includes('source_ascent_mission_id'))
assert.equal(/insert\s+into\s+public\.docking_connections/i.test(migration), false)
assert.equal(/update\s+public\.ships/i.test(migration), false)

// Settlement is permitted only after a genuinely completed orbital arrival.
assert.ok(migration.includes("v_mission.phase <> 'orbital-arrival'"))
assert.ok(migration.includes("v_mission.status <> 'completed'"))
assert.ok(migration.includes('NOXIA_ASCENT_NOT_AT_ORBITAL_ARRIVAL'))

// Repeated settlement for the same ascent mission is idempotent.
assert.ok(migration.includes('where source_ascent_mission_id = p_mission_id'))
assert.ok(migration.includes("'idempotent', true"))

// The target body is resolved from the Core's known ascent target, never asserted by the client.
assert.ok(facade.includes('resolveAscentOrbitNode(input.targetOrbitNodeSlug)'))
assert.ok(facade.includes('p_body_slug: target.bodySlug'))

// A successful final ascent transition immediately establishes orbital presence.
assert.ok(executor.includes("action === 'mark_arrival'"))
assert.ok(executor.includes('settleAscentOrbitalPresence({'))
assert.ok(executor.includes('targetOrbitNodeSlug: mission.target_orbit_node_slug'))

console.log('orbital presence contract tests passed')
