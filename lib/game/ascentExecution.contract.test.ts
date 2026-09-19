import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const executor = readFileSync(resolve(process.cwd(), 'lib/game/core/ascentExecution.ts'), 'utf8')
const api = readFileSync(resolve(process.cwd(), 'app/api/game/ascent/route.ts'), 'utf8')

// The trusted executor derives the next low-level action from persisted phase.
assert.ok(executor.includes("case 'ascent-authorized':"))
assert.ok(executor.includes("return 'start'"))
assert.ok(executor.includes("case 'ascending':"))
assert.ok(executor.includes("return 'mark_insertion'"))
assert.ok(executor.includes("case 'orbital-insertion':"))
assert.ok(executor.includes("return 'mark_arrival'"))
assert.ok(executor.includes('getAscentMissionForShip('))
assert.ok(executor.includes('transitionAscentCommand({'))
assert.ok(executor.includes('missionId: mission.id'))

// Public clients request only an abstract advance; they cannot choose the phase transition.
assert.ok(api.includes("if (action === 'advance')"))
assert.ok(api.includes('advanceAscentCommand({'))
assert.equal(api.includes('transitionAscentCommand('), false)
assert.equal(api.includes('body.missionId'), false)
assert.equal(api.includes('body.phase'), false)
assert.equal(api.includes('body.transition'), false)

// Manual low-level transition names remain explicitly rejected at the API boundary.
for (const forbiddenAction of ['start', 'mark-insertion', 'mark-arrival']) {
  assert.ok(api.includes(`'${forbiddenAction}'`))
}
assert.ok(api.includes('ASCENT_EXECUTION_UNAVAILABLE'))

// Presentation progress is phase-derived and is not presented as physical telemetry.
assert.ok(executor.includes("label: 'Aufstieg'"))
assert.ok(executor.includes("label: 'Orbitale Insertion'"))
assert.ok(executor.includes("label: 'Orbit erreicht'"))

console.log('ascent execution contract tests passed')
