import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readiness = readFileSync(resolve(process.cwd(), 'lib/game/core/ascentReadiness.ts'), 'utf8')
const article = readFileSync(resolve(process.cwd(), 'lib/game/core/ascentFlightArticle.ts'), 'utf8')
const lunar = readFileSync(resolve(process.cwd(), 'lib/game/core/lunarAscentEngineeringAuthority.ts'), 'utf8')
const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260927194500_lunar_flight_article_state.sql'), 'utf8')
const targets = readFileSync(resolve(process.cwd(), 'lib/game/ascentTargets.ts'), 'utf8')

assert.ok(targets.includes("'moon-llo-100'"))
assert.ok(lunar.includes("authorityId: 'ENG-LUNAR-ASCENT-r1'"))
assert.ok(lunar.includes("engineeringFrameId: 'ENG-SCV-0002'"))
assert.ok(lunar.includes('maxLiftoffMassKg: 14_000'))
assert.ok(lunar.includes('maxCrewCargoMissionEquipmentKg: 2_000'))
assert.ok(lunar.includes('referenceUsableAscentPropellantKg: 5_500'))
assert.ok(lunar.includes("input.engineeringAuthorityRef !== a.authorityId"))
assert.ok(lunar.includes("'flight-article-not-mapped-to-eng-scv-0002'"))

assert.ok(migration.includes('crew_cargo_mission_equipment_kg numeric null'))
assert.ok(migration.includes('usable_ascent_propellant_kg numeric null'))
assert.ok(article.includes('flightArticleLunarPhysicalState'))
assert.ok(article.includes('engineeringFrameId: article.engineering_frame_id'))
assert.ok(article.includes('crew_cargo_mission_equipment_kg'))
assert.ok(article.includes('usable_ascent_propellant_kg'))

assert.ok(readiness.includes("normalizedDeparture === 'earth' || normalizedDeparture === 'moon'"))
assert.ok(readiness.includes('resolveLunarAscentEngineeringAuthority({'))
assert.ok(readiness.includes('flightArticleLunarPhysicalState(flightArticle)'))
assert.ok(readiness.includes('LUNAR_ASCENT_AUTHORITY_R1.authorityId'))

// The integration must remain fail-closed: no ship type/name fallback and no
// synthetic lunar quantities may appear in the readiness resolver.
for (const forbidden of [
  "ship_type_id === 'lunar'",
  'ENG-SCV-0002 as',
  'crewCargoMissionEquipmentKg: 0',
  'usableAscentPropellantKg: 5500',
]) {
  assert.equal(readiness.includes(forbidden), false, `unexpected lunar fallback: ${forbidden}`)
}

console.log('lunar ascent readiness contract tests passed')
