import { strict as assert } from 'node:assert'
import { advanceAbsence, initialAbsenceState } from './absenceAutopilot'
import { mayExecuteAbsenceTask, navigationFromAbsencePlan, planAbsenceHandoff } from './absenceHandoff'

const initial = initialAbsenceState(0)
assert.equal(planAbsenceHandoff({ actorId: 'p1', state: initial, destinations: [] }), null)
const away = advanceAbsence(initial, 300_000, 'logout').state
const plan = planAbsenceHandoff({
  actorId: 'p1',
  state: away,
  destinations: [
    { id: 'hotel', kind: 'hotel', available: true, reachable: true, distanceMeters: 10 },
    { id: 'home', kind: 'residence', available: true, reachable: true, distanceMeters: 100 },
  ],
  conversation: { id: 'conv1', context: 'conversation', isOpen: true },
})
assert.ok(plan)
assert.equal(plan.destination?.id, 'home')
assert.equal(plan.outcome, 'navigate')
assert.equal(plan.goodbye?.conversationId, 'conv1')
assert.equal(plan.eventKey, 'absence:p1:1')
assert.deepEqual(plan, planAbsenceHandoff({
  actorId: 'p1', state: away,
  destinations: [
    { id: 'hotel', kind: 'hotel', available: true, reachable: true, distanceMeters: 10 },
    { id: 'home', kind: 'residence', available: true, reachable: true, distanceMeters: 100 },
  ],
  conversation: { id: 'conv1', context: 'conversation', isOpen: true },
}))
assert.equal(navigationFromAbsencePlan(plan, away)?.destinationId, 'home')
assert.equal(mayExecuteAbsenceTask({ kind: 'navigate', actorId: 'p1', expectedRevision: 1 }, away), true)
assert.equal(mayExecuteAbsenceTask({ kind: 'buy', actorId: 'p1', expectedRevision: 1 }, away), false)
const resumed = advanceAbsence(away, 301_000, 'reconnect').state
assert.equal(navigationFromAbsencePlan(plan, resumed), null)
assert.equal(mayExecuteAbsenceTask({ kind: 'navigate', actorId: 'p1', expectedRevision: 1 }, resumed), false)
const noLocation = planAbsenceHandoff({ actorId: 'p1', state: away, destinations: [], conversation: { id: 'c', context: 'casual', isOpen: false } })
assert.equal(noLocation?.outcome, 'await-safe-destination')
assert.equal(noLocation?.goodbye, null)
assert.equal(navigationFromAbsencePlan(noLocation!, away), null)
console.log('absenceHandoff: all assertions passed')
