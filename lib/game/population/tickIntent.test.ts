import { runPopulationTick } from './tick'
import type { Person, PersonAssignment, PersonNeed } from './types'

let failures = 0
function check(ok: boolean, label: string) { if (!ok) { failures++; console.error(`FAIL: ${label}`) } }

const person: Person = { id: 'p1', displayName: 'Test', birthYear: null, currentLocationId: 'home', simulationTier: 'active', activityState: 'idle', lastAction: null, lastDecisionFactors: {}, lastTick: null }
const assignments: PersonAssignment[] = [
  { id: 'home-a', personId: 'p1', assignmentType: 'home', locationId: 'home', tileEntityId: 'hab-1', employerActorId: null, roleCode: null, startsTick: null, endsTick: null, isActive: true },
  { id: 'work-a', personId: 'p1', assignmentType: 'work', locationId: 'work', tileEntityId: 'lab-1', employerActorId: 'ssf', roleCode: 'scientist', startsTick: null, endsTick: null, isActive: true },
]
const needs: PersonNeed[] = [
  { personId: 'p1', needCode: 'sustenance', satisfaction: 0.9, updatedTick: 0 },
  { personId: 'p1', needCode: 'rest', satisfaction: 0.9, updatedTick: 0 },
  { personId: 'p1', needCode: 'safety', satisfaction: 0.9, updatedTick: 0 },
  { personId: 'p1', needCode: 'social', satisfaction: 0.9, updatedTick: 0 },
  { personId: 'p1', needCode: 'purpose', satisfaction: 0.1, updatedTick: 0 },
]

const result = runPopulationTick({ tick: 10, person, assignments, needs, skills: [], relationships: [], nearbyProblems: [] })
check(result.decision.action === 'travel_work', 'low purpose with remote work chooses travel_work')
check(result.intent.ok && result.intent.intent.kind === 'travel', 'travel decision yields a travel intent')
check(result.person.currentLocationId === 'home', 'travel decision does not teleport the person')
check(result.person.activityState === 'travelling', 'accepted travel intent marks activity as travelling')
check(result.events[0]?.eventType === 'npc_started_travel', 'event records travel start rather than completed travel')
check(result.events[0]?.locationId === 'home', 'travel-start event remains at origin')
check(result.needs.every((need, index) => need.satisfaction === needs[index]?.satisfaction), 'travel costs wait for authoritative execution/completion')

if (failures) throw new Error(`${failures} population tick intent test(s) failed`)
console.log('Population tick intent boundary: tests passed')
