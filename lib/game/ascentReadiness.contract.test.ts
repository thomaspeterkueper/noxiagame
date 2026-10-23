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
const r2Migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261023210000_earth_ascent_r2_authority.sql'), 'utf8')

// Server-side facts must come from canonical persisted state.
for (const source of [
  ".from('ships')",
  ".from('docking_connections')",
  ".from('ascent_missions')",
  ".from('ship_crew_manifest')",
  ".from('ship_cargo')",
]) assert.ok(resolver.includes(source), `missing persisted readiness source ${source}`)
assert.ok(resolver.includes("ship.status !== 'transit'"))

// Surface and orbit remain distinct, and the Earth target provenance follows the
// current Engineering authority rather than the superseded mission baseline.
assert.ok(targets.includes("'earth-leo-400'"))
assert.ok(targets.includes("bodySlug: 'earth'"))
assert.ok(targets.includes('altitudeKm: 400'))
assert.ok(targets.includes("systems/earth-leo-ascent-authority-r2.json"))
assert.ok(resolver.includes('resolveAscentOrbitNode(normalizedTarget)'))

// The closed Engineering handoff remains the traceable request, while runtime
// authorization consumes the current r2 authority delivered by Engineering.
assert.ok(resolver.includes('EXT-NOXIA-ENG-20260919-EARTH-LEO-ASCENT-AUTHORITY'))
assert.ok(resolver.includes('EXT-NOXIA-ENG-20260918-LUNAR-SURFACE-TO-ORBIT-ASCENT'))
assert.ok(engineering.includes("authorityId: 'ENG-EARTH-LEO-ASCENT-r2'"))
assert.ok(engineering.includes("engineeringFrameId: 'ENG-SCV-0004'"))
assert.ok(engineering.includes('maxStartMassKg: 748_340'))
assert.ok(engineering.includes('requiredReleaseSpeedMS: 170'))
assert.ok(engineering.includes('minCircularAltitudeKm: 395'))
assert.ok(engineering.includes('maxCircularAltitudeKm: 405'))
assert.ok(engineering.includes("sourceReference: 'systems/earth-leo-ascent-authority-r2.json'"))
assert.equal(engineering.includes("authorityId: 'ENG-EARTH-LEO-ASCENT-r1'"), false)
assert.equal(resolver.includes('EARTH_LEO_ASCENT_AUTHORITY_R1'), false)

// Concrete Engineering identity must come from a trusted flight article, never a
// legacy ship name/type or browser field.
assert.ok(articleMigration.includes('spacecraft_flight_articles'))
assert.ok(articleMigration.includes('engineering_frame_id text not null'))
assert.ok(articleMigration.includes('engineering_authority_ref text not null'))
assert.ok(articleMigration.includes('actual_start_mass_kg numeric null'))
assert.ok(articleMigration.includes('enable row level security'))
assert.ok(flightArticle.includes(".from('spacecraft_flight_articles')"))
assert.ok(flightArticle.includes("row.owner_profile_id !== actorProfileId"))
assert.ok(engineering.includes("input.engineeringFrameId !== a.engineeringFrameId"))
assert.ok(engineering.includes("'flight-article-not-mapped-to-eng-scv-0004'"))
assert.ok(engineering.includes("'flight-article-authority-not-eng-earth-leo-ascent-r2'"))
assert.equal(engineering.includes('noxiaShipTypeId'), false)
assert.equal(resolver.includes('physicalState: null'), false)
assert.ok(resolver.includes('getSpacecraftFlightArticle(actorProfileId, shipId)'))
assert.ok(resolver.includes('flightArticlePhysicalState(flightArticle)'))

// r2 adds explicit trusted high-lift and target-inclination state. Missing values
// remain null and therefore fail closed.
assert.ok(r2Migration.includes('high_lift_state_ref text null'))
assert.ok(r2Migration.includes('target_inclination_deg numeric null'))
assert.ok(r2Migration.includes('target_inclination_deg >= 0'))
assert.ok(r2Migration.includes('target_inclination_deg <= 180'))
assert.ok(flightArticle.includes('high_lift_state_ref'))
assert.ok(flightArticle.includes('target_inclination_deg'))
assert.ok(engineering.includes('requiredHighLiftStateRef'))
assert.ok(engineering.includes('targetInclinationDeg: number | null'))
assert.ok(engineering.includes('r2-reference-high-lift-state-unresolved'))
assert.ok(engineering.includes('target-plane-or-inclination-unresolved'))

// The shared vehicle model remains the canonical concrete identity. Historical r1
// stays historical; r2 receives a distinct inactive reference vehicle.
assert.ok(vehicleBindingMigration.includes('vehicle_instance_id uuid'))
assert.ok(vehicleBindingMigration.includes('references public.vehicle_instances(id)'))
assert.ok(vehicleBindingMigration.includes('spacecraft_flight_articles_vehicle_instance_uidx'))
assert.ok(vehicleBindingMigration.includes('alter column vehicle_instance_id set not null'))
assert.ok(flightArticle.includes(".from('vehicle_instances')"))
assert.ok(flightArticle.includes('vehicle.owner_profile_id !== actorProfileId'))
assert.ok(flightArticle.includes('vehicle.frame_id !== row.engineering_frame_id'))
assert.ok(flightArticle.includes("vehicle.status === 'lost'"))
assert.ok(r2Migration.includes("'noxia:spacecraft:asce-p85-r1:reference-001'"))
assert.ok(r2Migration.includes("'engineeringAuthorityStatus', 'superseded'"))
assert.ok(r2Migration.includes("'noxia:spacecraft:asce-p85-r2:reference-001'"))
assert.ok(r2Migration.includes("'ENG-SCV-0004'"))
assert.ok(r2Migration.includes("'inactive'"))
assert.ok(r2Migration.includes("'reference-unassigned'"))
assert.ok(r2Migration.includes("'physicalCapacityAuthority', 'unresolved'"))
assert.ok(r2Migration.includes("'highLiftStateStatus', 'unresolved'"))

// Crew is an explicit gameplay fact. The owner can board their own ship as
// commander/pilot, but cannot assert readiness directly from the browser.
assert.ok(crewMigration.includes('ship_crew_manifest'))
assert.ok(crewMigration.includes('noxia_board_player_crew'))
assert.ok(crewMigration.includes("v_ship.profile_id <> p_profile_id"))
assert.ok(crewMigration.includes("v_ship.status = 'transit'"))
assert.ok(resolver.includes("crewRow.role === 'commander' || crewRow.role === 'pilot'"))
assert.ok(crewApi.includes("body.action === 'board-self'"))
assert.equal(api.includes('body.crewReady'), false)

// Empty cargo is authoritatively zero cargo; non-empty cargo is only ready when
// every resource resolves through the shared cargo-mass authority.
assert.ok(resolver.includes('const cargoEmpty = cargoRows.length === 0'))
assert.ok(resolver.includes('const canonicalCargoReady = cargoEmpty || unresolvedResources.length === 0'))
assert.ok(resolver.includes('resolveAuthoritativeLogisticsCargoMass'))
assert.equal(api.includes('body.cargoReady'), false)

// Public clients cannot inject trusted Engineering facts.
for (const forbidden of [
  'body.engineering',
  'body.actualStartMassKg',
  'body.propellantStateRef',
  'body.highLiftStateRef',
  'body.departureSiteClass',
  'body.releaseSpeedMS',
  'body.targetPlaneResolved',
  'body.targetInclinationDeg',
  'body.engineeringFrameId',
  'body.vehicleInstanceId',
]) {
  assert.equal(ascentApi.includes(forbidden), false, `client may not supply ${forbidden}`)
}
assert.ok(ascentApi.includes('resolveAscentReadiness('))
assert.ok(ascentApi.includes('authorizeAscentCommand({'))
assert.ok(ascentApi.includes('resolved.readiness.engineering.profileId'))
assert.ok(ascentApi.includes('ENG-SCV-0004'))

// No trajectory/propulsion solver is copied into NOXIA. Only approved authority
// gates may be projected; detailed physics stays in KUEPER Engineering.
for (const forbidden of ['delta_v', 'delta-v', 'specific_impulse', 'fuel_required', 'flight_duration']) {
  assert.equal(resolver.toLowerCase().includes(forbidden), false, `unexpected physics default: ${forbidden}`)
  assert.equal(engineering.toLowerCase().includes(forbidden), false, `unexpected physics model: ${forbidden}`)
}

console.log('ascent readiness contract tests passed')
