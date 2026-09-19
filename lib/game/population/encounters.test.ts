import { derivePopulationEncounters } from './encounters'
import { memoryFromPopulationEvent, projectRelationship } from '../personSocialMemory'
import type { Person } from './types'

let failures = 0
function check(ok: boolean, label: string) { if (!ok) { failures++; console.error(`FAIL: ${label}`) } }
function person(id: string, location: string, activity: Person['activityState'] = 'idle'): Person {
  return { id, displayName: id, birthYear: null, currentLocationId: location, simulationTier: 'active', activityState: activity, lastAction: null, lastDecisionFactors: {}, lastTick: 1 }
}

const amara = { person: person('amara', 'tharsis-medical'), tileEntityId: 'medical-1' }
const tech = { person: person('tech-7', 'tharsis-medical'), tileEntityId: 'medical-1' }
const remote = { person: person('remote', 'tharsis-hab'), tileEntityId: 'hab-1' }

const encounters = derivePopulationEncounters({
  tick: 12,
  previousCandidates: [
    { person: person('amara', 'tharsis-hab'), tileEntityId: 'hab-1' },
    tech,
    remote,
  ],
  candidates: [amara, tech, remote],
})
check(encounters.length === 1, 'only newly co-located people meet')
check(encounters[0]?.personAId === 'amara' && encounters[0]?.personBId === 'tech-7', 'pair ordering is deterministic')
check(encounters[0]?.eventA.relatedPersonId === 'tech-7', 'encounter emits reciprocal person event')
const memory = encounters[0] ? memoryFromPopulationEvent(encounters[0].eventA) : null
check(memory?.kind === 'interaction', 'encounter projects into existing social memory')
const relationship = memory ? projectRelationship(null, memory) : null
check(Boolean(relationship && relationship.familiarity > 0 && relationship.lastInteractionTick === 12), 'encounter can update existing relationship model')

const unchangedPresence = derivePopulationEncounters({
  tick: 13,
  previousCandidates: [amara, tech],
  candidates: [amara, tech],
})
check(unchangedPresence.length === 0, 'continued co-location does not create one memory per tick')

const passing = derivePopulationEncounters({
  tick: 14,
  previousCandidates: [],
  candidates: [
    { person: person('traveller', 'tharsis-medical', 'travelling'), tileEntityId: 'medical-1' },
    amara,
  ],
})
check(passing.length === 0, 'travelling people are not treated as locally available')

const differentRooms = derivePopulationEncounters({
  tick: 15,
  previousCandidates: [],
  candidates: [
    { person: person('a', 'tharsis-medical'), tileEntityId: 'medical-1' },
    { person: person('b', 'tharsis-medical'), tileEntityId: 'medical-2' },
  ],
})
check(differentRooms.length === 0, 'known different tiles do not create an encounter')

let duplicateRejected = false
try {
  derivePopulationEncounters({
    tick: 16,
    previousCandidates: [],
    candidates: [amara, amara],
  })
} catch {
  duplicateRejected = true
}
check(duplicateRejected, 'duplicate person presence is rejected instead of producing a self/duplicate encounter')

if (failures) throw new Error(`${failures} encounter test(s) failed`)
console.log('Population encounters: tests passed')
