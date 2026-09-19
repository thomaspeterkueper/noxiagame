import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const resolver = readFileSync(resolve(process.cwd(), 'lib/game/core/ascentReadiness.ts'), 'utf8')
const engineering = readFileSync(resolve(process.cwd(), 'lib/game/core/earthAscentEngineeringAuthority.ts'), 'utf8')
const targets = readFileSync(resolve(process.cwd(), 'lib/game/ascentTargets.ts'), 'utf8')
const api = readFileSync(resolve(process.cwd(), 'app/api/game/ascent/readiness/route.ts'), 'utf8')
const ascentApi = readFileSync(resolve(process.cwd(), 'app/api/game/ascent/route.ts'), 'utf8')
const crewApi = readFileSync(resolve(process.cwd(), 'app/api/game/ascent/crew/route.ts'), 'utf8')
const crewMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260919184500_ascent_player_crew_manifest.sql'), 'utf8')

// Server-side facts must come from canonical persisted state.
assert.ok(resolver.includes(".from('ships')"))
assert.ok(resolver.includes(".from('docking_connections')"))
assert.ok(resolver.includes(".from('ascent_missions')"))
assert.ok(resolver.includes(".from('ship_crew_manifest')"))
assert.ok(resolver.includes(".from('ship_cargo')"))
assert.ok(resolver.includes("ship.status !== 'transit'"))

// Surface and orbit must be distinguishable for the Earth vertical slice.
assert.ok(targets.includes("'earth-leo-400'"))
assert.ok(targets.includes("bodySlug: 'earth'"))
assert.ok(targets.includes('altitudeKm: 400'))
assert.ok(resolver.includes('resolveAscentOrbitNode(normalizedTarget)'))

// The external Earth request is done and its stable authority is consumed locally.
assert.ok(resolver.includes('EXT-NOXIA-ENG-20260919-EARTH-LEO-ASCENT-AUTHORITY'))
assert.ok(resolver.includes('EXT-NOXIA-ENG-20260918-LUNAR-SURFACE-TO-ORBIT-ASCENT'))
assert.ok(engineering.includes("authorityId: 'ENG-EARTH-LEO-ASCENT-r1'"))
assert.ok(engineering.includes("engineeringFrameId: 'ENG-SCV-0003'"))
assert.ok(engineering.includes('maxStartMassKg: 674660'))
assert.ok(engineering.includes('requiredReleaseSpeedMS: 160'))
assert.ok(engineering.includes('minCircularAltitudeKm: 395'))
assert.ok(engineering.includes('maxCircularAltitudeKm: 405'))
assert.ok(engineering.includes("sourceReference: 'systems/earth-leo-ascent-authority-r1.json'"))

// NOXIA must not relabel legacy freighters as ASCE. Only an explicit gameplay
// ship type may map to ENG-SCV-0003, and unknown physical state fails closed.
assert.ok(engineering.includes("noxiaShipTypeId: 'asce_p85_r1'"))
assert.ok(engineering.includes("result: 'frame-unmapped'"))
assert.ok(engineering.includes("'physical-departure-state-unavailable'"))
assert.ok(engineering.includes("'target-plane-unresolved'"))
assert.ok(resolver.includes('physicalState: null'))

// Crew is an explicit gameplay fact. The owner can board their own ship as
// commander/pilot, but cannot assert readiness directly from the browser.
assert.ok(crewMigration.includes('ship_crew_manifest'))
assert.ok(crewMigration.includes('noxia_board_player_crew'))
assert.ok(crewMigration.includes("v_ship.profile_id <> p_profile_id"))
assert.ok(crewMigration.includes("v_ship.status = 'transit'"))
assert.ok(resolver.includes("crewRow.role === 'commander' || crewRow.role === 'pilot'"))
assert.ok(crewApi.includes("body.action === 'board-self'"))
assert.equal(api.includes('body.crewReady'), false)

// Empty cargo is authoritatively zero payload. Non-empty legacy cargo remains
// unresolved instead of treating resources.unit='t' as a physical mass claim.
assert.ok(resolver.includes('const cargoEmpty = cargoRows.length === 0'))
assert.ok(resolver.includes('const canonicalCargoReady = cargoEmpty'))
assert.ok(resolver.includes("cargoEmpty ? 'ready' : 'unresolved'"))
assert.ok(resolver.includes('Legacy-Fracht bleibt gesperrt'))
assert.equal(api.includes('body.cargoReady'), false)

// Public clients cannot inject trusted Engineering facts. Authorization now calls
// the trusted resolver and only then the persistent Core command.
for (const forbidden of [
  'body.engineering',
  'body.actualStartMassKg',
  'body.propellantStateRef',
  'body.departureSiteClass',
  'body.releaseSpeedMS',
  'body.targetPlaneResolved',
]) {
  assert.equal(ascentApi.includes(forbidden), false, `client may not supply ${forbidden}`)
}
assert.ok(ascentApi.includes('resolveAscentReadiness('))
assert.ok(ascentApi.includes('authorizeAscentCommand({'))
assert.ok(ascentApi.includes('resolved.readiness.engineering.profileId'))

// No trajectory/propulsion solver is copied into NOXIA. Only approved authority
// bounds may be projected; detailed physics stays in KUEPER Engineering.
for (const forbidden of ['delta_v', 'delta-v', 'specific_impulse', 'fuel_required', 'flight_duration']) {
  assert.equal(resolver.toLowerCase().includes(forbidden), false, `unexpected physics default: ${forbidden}`)
  assert.equal(engineering.toLowerCase().includes(forbidden), false, `unexpected physics model: ${forbidden}`)
}

console.log('ascent readiness contract tests passed')
