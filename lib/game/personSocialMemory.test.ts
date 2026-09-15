import { memoryFromPopulationEvent, projectRelationship } from './personSocialMemory.ts'
import type { PopulationEvent } from './population/types.ts'

let fails = 0
function check(ok: boolean, label: string) { if (!ok) { fails++; console.log(`FAIL: ${label}`) } }

const assistance: PopulationEvent = {
  id: 'event-42', tick: 42, eventType: 'person_assistance', actorPersonId: 'a', relatedPersonId: 'b',
  locationId: 'mars-alpha', subjectType: 'person', subjectRef: 'b', payload: {},
}

const m1 = memoryFromPopulationEvent(assistance)
const m2 = memoryFromPopulationEvent(assistance)
check(Boolean(m1), 'known assistance event creates memory')
check(JSON.stringify(m1) === JSON.stringify(m2), 'same event projects identically')
check(m1?.id === 'memory:event-42:a', 'memory identity derives from source event')
check(m1?.sourceEventId === 'event-42', 'source event remains auditable')

const relation = m1 ? projectRelationship(null, m1) : null
check(relation?.personId === 'a' && relation?.otherPersonId === 'b', 'relationship direction is preserved')
check((relation?.trust ?? 0) > 0.5, 'assistance raises initial trust')
check((relation?.affinity ?? 0) > 0.5, 'positive assistance raises affinity')

const unknown = memoryFromPopulationEvent({ ...assistance, id: 'event-43', eventType: 'npc_work' })
check(unknown === null, 'unknown events do not invent memories')
const incomplete = memoryFromPopulationEvent({ ...assistance, id: 'event-44', eventType: 'npc_social_interaction', relatedPersonId: null })
check(incomplete === null, 'social memory requires an explicit related person')

const overridden = memoryFromPopulationEvent({ ...assistance, id: 'event-45', payload: { salience: 5, valence: -5, trustDelta: 5, summary: 'konkrete Erfahrung' } })
check(overridden?.salience === 1 && overridden?.valence === -1 && overridden?.trustDelta === 1, 'payload values are clamped')
check(overridden?.summary === 'konkrete Erfahrung', 'explicit summary is retained')

if (fails) throw new Error(`${fails} social-memory test(s) failed`)
console.log('Social Memory v1: deterministic projection tests passed')
