import { strict as assert } from 'node:assert'
import { advanceAbsence, absenceGoodbye, chooseAbsenceDestination, initialAbsenceState, isAbsenceActionAllowed, ownsAbsenceLease } from './absenceAutopilot'

const minute = 60_000
const initial = initialAbsenceState(0)
let warning = advanceAbsence(initial, 15 * minute)
assert.equal(warning.action, 'warn')
assert.equal(warning.remainingMs, 5 * minute)
assert.equal(advanceAbsence(warning.state, 16 * minute).action, 'none')
assert.equal(advanceAbsence(warning.state, 16 * minute, 'interaction').state.mode, 'online')
const idle = advanceAbsence(warning.state, 20 * minute)
assert.equal(idle.action, 'handoff')
assert.equal(idle.state.reason, 'idle')
assert.equal(advanceAbsence(idle.state, 21 * minute).action, 'none')
assert.equal(ownsAbsenceLease(idle.state, 1), true)
const resumed = advanceAbsence(idle.state, 21 * minute, 'reconnect')
assert.equal(resumed.action, 'resume')
assert.equal(ownsAbsenceLease(resumed.state, 1), false)
assert.equal(resumed.state.revision, 2)
assert.equal(advanceAbsence(initial, 0, 'logout').action, 'handoff')
const dc = advanceAbsence(initial, 0, 'disconnect')
assert.equal(advanceAbsence(dc.state, 89_000).action, 'none')
assert.equal(advanceAbsence(dc.state, 90_000).state.reason, 'disconnect')
assert.equal(advanceAbsence(dc.state, 50_000, 'reconnect').state.mode, 'online')
assert.equal(chooseAbsenceDestination([
  { id: 'near-hotel', kind: 'hotel', distanceMeters: 1, reachable: true, available: true },
  { id: 'home', kind: 'residence', distanceMeters: 300, reachable: true, available: true },
])?.id, 'home')
assert.equal(chooseAbsenceDestination([
  { id: 'full', kind: 'hotel', distanceMeters: 1, reachable: true, available: false },
  { id: 'hub', kind: 'safe-hub', distanceMeters: 20, reachable: true, available: true },
])?.id, 'hub')
assert.equal(chooseAbsenceDestination([]), null)
assert.match(absenceGoodbye('conversation'), /Bis bald/)
assert.equal(isAbsenceActionAllowed('navigate'), true)
assert.equal(isAbsenceActionAllowed('buy'), false)
assert.equal(isAbsenceActionAllowed('start-relationship'), false)
console.log('absenceAutopilot: all assertions passed')
