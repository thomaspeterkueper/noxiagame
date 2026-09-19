import { resolvedPresenceCandidate, resolvedPresenceCandidates } from './presence'
import type { Person, PersonAssignment } from './types'

let failures = 0
function check(ok: boolean, label: string) { if (!ok) { failures += 1; console.error(`FAIL: ${label}`) } }

function person(id: string, activityState: Person['activityState']): Person {
  return { id, displayName: id, birthYear: null, currentLocationId: 'mars', simulationTier: 'active', activityState, lastAction: null, lastDecisionFactors: {}, lastTick: 1 }
}
function assignment(id: string, personId: string, assignmentType: PersonAssignment['assignmentType'], tileEntityId: string | null): PersonAssignment {
  return { id, personId, assignmentType, locationId: 'mars', tileEntityId, employerActorId: null, roleCode: null, startsTick: null, endsTick: null, isActive: true }
}

const worker = person('worker', 'working')
const workerPresence = resolvedPresenceCandidate(worker, [
  assignment('home', 'worker', 'home', 'hab-1'),
  assignment('work', 'worker', 'work', 'lab-1'),
])
check(workerPresence?.tileEntityId === 'lab-1', 'working person resolves to work tile')

const resting = resolvedPresenceCandidate(person('resting', 'resting'), [
  assignment('r-home', 'resting', 'home', 'hab-2'),
  assignment('r-work', 'resting', 'work', 'factory-1'),
])
check(resting?.tileEntityId === 'hab-2', 'resting person resolves to home tile')

const travelling = resolvedPresenceCandidate(person('traveller', 'travelling'), [
  assignment('t-work', 'traveller', 'work', 'lab-1'),
])
check(travelling === null, 'travelling person has no local presence')

const idle = resolvedPresenceCandidate(person('idle', 'idle'), [
  assignment('i-work', 'idle', 'work', 'lab-1'),
])
check(idle === null, 'idle work assignment is not treated as current presence')

const temporaryIdle = resolvedPresenceCandidate(person('temporary-idle', 'idle'), [
  assignment('tmp', 'temporary-idle', 'temporary', 'clinic-waiting'),
])
check(temporaryIdle?.tileEntityId === 'clinic-waiting', 'explicit temporary assignment resolves idle presence')

const unresolved = resolvedPresenceCandidates([
  person('a', 'working'), person('b', 'working'), person('c', 'idle'),
], [
  assignment('a-work', 'a', 'work', 'lab-1'),
  assignment('b-work', 'b', 'work', 'lab-1'),
  assignment('c-work', 'c', 'work', null),
])
check(unresolved.length === 2, 'only precise tile presence enters encounter candidates')

if (failures) throw new Error(`${failures} presence test(s) failed`)
console.log('Population presence: tests passed')
