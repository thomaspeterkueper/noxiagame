import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const resolver = readFileSync(resolve(process.cwd(), 'lib/game/core/ascentReadiness.ts'), 'utf8')
const targets = readFileSync(resolve(process.cwd(), 'lib/game/ascentTargets.ts'), 'utf8')
const api = readFileSync(resolve(process.cwd(), 'app/api/game/ascent/readiness/route.ts'), 'utf8')

// Server-side facts must come from canonical persisted state.
assert.ok(resolver.includes(".from('ships')"))
assert.ok(resolver.includes(".from('docking_connections')"))
assert.ok(resolver.includes(".from('ascent_missions')"))
assert.ok(resolver.includes("ship.status !== 'transit'"))

// Surface and orbit must be distinguishable for the Earth vertical slice.
assert.ok(targets.includes("'earth-leo-400'"))
assert.ok(targets.includes("bodySlug: 'earth'"))
assert.ok(targets.includes('altitudeKm: 400'))
assert.ok(resolver.includes('resolveAscentOrbitNode(normalizedTarget)'))

// Earth has its own Engineering request; lunar work remains separately owned.
assert.ok(resolver.includes('EXT-NOXIA-ENG-20260919-EARTH-LEO-ASCENT-AUTHORITY'))
assert.ok(resolver.includes('EXT-NOXIA-ENG-20260918-LUNAR-SURFACE-TO-ORBIT-ASCENT'))

// Unknown crew/cargo/Engineering truth must fail closed.
assert.ok(resolver.includes("crew: options.crewReady == null ? 'unresolved'"))
assert.ok(resolver.includes("cargo: options.cargoReady == null ? 'unresolved'"))
assert.ok(resolver.includes("engineering: engineering ? 'ready' : 'unresolved'"))
assert.ok(resolver.includes('crewReady = options.crewReady === true'))
assert.ok(resolver.includes('cargoReady = options.cargoReady === true'))

// Public clients may request an assessment but may not assert trusted readiness dimensions.
assert.equal(api.includes('body.crewReady'), false)
assert.equal(api.includes('body.cargoReady'), false)
assert.equal(api.includes('body.engineering'), false)
assert.ok(api.includes('resolveAscentReadiness('))

// No flight physics/tuning defaults belong in the readiness resolver.
for (const forbidden of ['delta_v', 'delta-v', 'specific_impulse', 'fuel_required', 'flight_duration']) {
  assert.equal(resolver.toLowerCase().includes(forbidden), false, `unexpected physics default: ${forbidden}`)
}

console.log('ascent readiness contract tests passed')
