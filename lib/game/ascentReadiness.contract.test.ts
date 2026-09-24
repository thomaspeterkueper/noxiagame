import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const resolver = readFileSync(resolve(process.cwd(), 'lib/game/core/ascentReadiness.ts'), 'utf8')
const engineering = readFileSync(resolve(process.cwd(), 'lib/game/core/earthAscentEngineeringAuthority.ts'), 'utf8')
const flightArticle = readFileSync(resolve(process.cwd(), 'lib/game/core/ascentFlightArticle.ts'), 'utf8')
const targets = readFileSync(resolve(process.cwd(), 'lib/game/ascentTargets.ts'), 'utf8')
const api = readFileSync(resolve(process.cwd(), 'app/api/game/ascent/readiness/route.ts'), 'utf8')
const ascentApi = readFileSync(resolve(process.cwd(), 'app/api/game/ascent/route.ts'), 'utf8')
const crewApi = readFileSync(resolve(process.cwd(), 'app/api/game/ascent/crew/route.ts'), 'utf8')
const crewMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260919184500_ascent_player_crew_manifest.sql'), 'utf8')
const articleMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260925001000_spacecraft_flight_articles.sql'), 'utf8')
const vehicleBindingMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260925002500_asce_reference_vehicle_binding.sql'), 'utf8')

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

// Concrete Engineering identity must come from a trusted flight article, never a
// legacy ship name/type or client field.
assert.ok(articleMigration.includes('spacecraft_flight_articles'))
assert.ok(articleMigration.includes('engineering_frame_id text not null'))
assert.ok(articleMigration.includes('engineering_authority_ref text not null'))
assert.ok(articleMigration.includes('actual_start_mass_kg numeric null'))
assert.ok(articleMigration.includes('enable row level security'))
assert.ok(articleMigration.includes('revoke all on table public.spacecraft_flight_articles from public, anon, authenticated'))
assert.ok(flightArticle.includes(".from('spacecraft_flight_articles')"))
assert.ok(flightArticle.includes("row.owner_profile_id !== actorProfileId"))
assert.ok(engineering.includes("input.engineeringFrameId !== a.engineeringFrameId"))
assert.ok(engineering.includes("'flight-article-not-mapped-to-eng-scv-0003'"))
assert.equal(engineering.includes('noxiaShipTypeId'), false)
assert.equal(resolver.includes('physicalState: null'), false)
assert.ok(resolver.includes('getSpacecraftFlightArticle(actorProfileId, shipId)'))
assert.ok(resolver.includes('flightArticlePhysicalState(flightArticle)'))

// The shared vehicle model is the canonical concrete vehicle identity. Flight
// articles are 1:1-bound to it and the runtime rechecks owner + exact frame.
assert.ok(vehicleBindingMigration.includes('vehicle_instance_id uuid'))
assert.ok(vehicleBindingMigration.includes('references public.vehicle_instances(id)'))
assert.ok(vehicleBindingMigration.includes('spacecraft_flight_articles_vehicle_instance_uidx'))
assert.ok(vehicleBindingMigration.includes('alter column vehicle_instance_id set not null'))
assert.ok(flightArticle.includes(".from('vehicle_instances')"))
assert.ok(flightArticle.includes('vehicle.owner_profile_id !== actorProfileId'))
assert.ok(flightArticle.includes('vehicle.frame_id !== row.engineering_frame_id'))
assert.ok(flightArticle.includes("vehicle.status === 'lost'"))

// Seed only an inactive, unowned reference identity. It must not silently assert
// a launch site, owner, payload capability, energy or crew readiness.
assert.ok(vehicleBindingMigration.includes("'noxia:spacecraft:asce-p85-r1:reference-001'"))
assert.ok(vehicleBindingMigration.includes("'ENG-SCV-0003'"))
assert.ok(vehicleBindingMigration.includes("'inactive'"))
assert.ok(vehicleBindingMigration.includes("'reference-unassigned'"))
assert.ok(vehicleBindingMigration.includes("'physicalCapacityAuthority', 'unresolved'"))
assert.ok(vehicleBindingMigration.includes("'launchSiteStatus', 'unresolved'"))

// Crew is an explicit gameplay fact. The owner can board their own ship as
// commander/pilot, but cannot assert readiness directly from the browser.
assert.ok(crewMigration.includes('ship_crew_manifest'))
assert.ok(crewMigration.includes('noxia_board_player_crew'))
assert.ok(crewMigration.includes("v_ship.profile_id <> p_profile_id"))
assert.ok(crewMigration.includes("v_ship.status = 'transit'"))
assert.ok(resolver.includes("crewRow.role === 'commander' || crewRow.role === 'pilot'"))
assert.ok(crewApi.includes("body.action === 'board-self'"))
assert.equal(api.includes('body.crewReady'), false)

// Empty cargo is authoritatively zero gameplay payload. Physical launch mass is
// still independently fail-closed in the persisted flight article.
assert.ok(resolver.includes('const cargoEmpty = cargoRows.length === 0'))
assert.ok(resolver.includes('const canonicalCargoReady = cargoEmpty'))
assert.ok(resolver.includes("cargoEmpty ? 'ready' : 'unresolved'"))
assert.ok(resolver.includes('Legacy-Fracht bleibt gesperrt'))
assert.equal(api.includes('body.cargoReady'), false)

// Public clients cannot inject trusted Engineering facts. Authorization resolves
// persisted state and only then calls the persistent Core command.
for (const forbidden of [
  'body.engineering',
  'body.actualStartMassKg',
  'body.propellantStateRef',
  'body.departureSiteClass',
  'body.releaseSpeedMS',
  'body.targetPlaneResolved',
  'body.engineeringFrameId',
  'body.vehicleInstanceId',
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
