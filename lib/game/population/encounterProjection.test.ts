import { derivePopulationEncounters } from './encounters'
import { projectEncounterRelationships } from './encounterProjection'
import type { Person, PersonRelationship } from './types'

let failures = 0
function check(ok: boolean, label: string) { if (!ok) { failures += 1; console.error(`FAIL: ${label}`) } }
function person(id: string): Person {
  return { id, displayName: id, birthYear: null, currentLocationId: 'mars', simulationTier: 'active', activityState: 'working', lastAction: null, lastDecisionFactors: {}, lastTick: 4 }
}

const encounter = derivePopulationEncounters({
  tick: 5,
  previousCandidates: [],
  candidates: [
    { person: person('a'), tileEntityId: 'lab-1' },
    { person: person('b'), tileEntityId: 'lab-1' },
  ],
})[0]
if (!encounter) throw new Error('expected encounter fixture')

const initial = projectEncounterRelationships(encounter, new Map())
check(initial.length === 2, 'encounter projects both directed relationships')
check(initial.every(p => p.relationship.relationshipType === 'acquaintance'), 'new relationships start as acquaintances')
check(initial.every(p => p.relationship.familiarity > 0), 'encounter raises familiarity')
check(initial.every(p => p.relationship.lastInteractionTick === 5), 'interaction tick is projected')

const current = new Map<string, PersonRelationship>()
for (const projection of initial) {
  const r = projection.relationship
  current.set(`${r.personId}\u0000${r.otherPersonId}`, { ...r, id: `db:${r.personId}:${r.otherPersonId}` })
}
const repeated = projectEncounterRelationships(encounter, current)
check(repeated.every(p => p.relationship.familiarity > (current.get(`${p.relationship.personId}\u0000${p.relationship.otherPersonId}`)?.familiarity ?? 0)), 'existing relationship accumulates memory projection')
check(repeated.every(p => p.relationship.id.startsWith('db:')), 'existing database relationship identity is preserved')

if (failures) throw new Error(`${failures} encounter projection test(s) failed`)
console.log('Encounter relationship projection: tests passed')
