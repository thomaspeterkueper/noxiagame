import { derivePopulationEncounters } from './encounters'
import { memoryFromPopulationEvent, projectRelationship } from '../personSocialMemory'
import type { Person } from './types'

let failures = 0
function check(ok: boolean, label: string) { if (!ok) { failures++; console.error(`FAIL: ${label}`) } }
function person(id: string, location: string, activity: Person['activityState'] = 'idle'): Person {
  return { id, displayName: id, birthYear: null, currentLocationId: location, simulationTier: 'active', activityState: activity, lastAction: null, lastDecisionFactors: {}, lastTick: 1 }
}

const encounters = derivePopulationEncounters({ tick: 12, candidates: [
  { person: person('amara', 'tharsis-medical'), tileEntityId: 'medical-1' },
  { person: person('tech-7', 'tharsis-medical'), tileEntityId: 'medical-1' },
  { person: person('remote', 'tharsis-hab'), tileEntityId: 'hab-1' },
] })
check(encounters.length === 1, 'only co-located people meet')
check(encounters[0]?.personAId === 'amara' && encounters[0]?.personBId === 'tech-7', 'pair ordering is deterministic')
check(encounters[0]?.eventA.relatedPersonId === 'tech-7', 'encounter emits reciprocal person event')
const memory = encounters[0] ? memoryFromPopulationEvent(encounters[0].eventA) : null
check(memory?.kind === 'interaction', 'encounter projects into existing social memory')
const relationship = memory ? projectRelationship(null, memory) : null
check(Boolean(relationship && relationship.familiarity > 0 && relationship.lastInteractionTick === 12), 'encounter can update existing relationship model')

const passing = derivePopulationEncounters({ tick: 13, candidates: [
  { person: person('traveller', 'tharsis-medical', 'travelling'), tileEntityId: 'medical-1' },
  { person: person('amara', 'tharsis-medical'), tileEntityId: 'medical-1' },
] })
check(passing.length === 0, 'travelling people are not treated as locally available')

const differentRooms = derivePopulationEncounters({ tick: 14, candidates: [
  { person: person('a', 'tharsis-medical'), tileEntityId: 'medical-1' },
  { person: person('b', 'tharsis-medical'), tileEntityId: 'medical-2' },
] })
check(differentRooms.length === 0, 'known different tiles do not create an encounter')

if (failures) throw new Error(`${failures} encounter test(s) failed`)
console.log('Population encounters: tests passed')
