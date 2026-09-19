// lib/game/population/engineIntegration.test.ts
// Regression guard: persistence engine must use the state-based decision core
// and project precise co-location encounters into durable social state.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(here, 'engine.ts'), 'utf8')

if (!source.includes("from './decision'")) throw new Error('population engine does not import decision.ts')
if (!source.includes('decideFromState(context)')) throw new Error('background population bypasses deterministic decision context')
if (!source.includes("person_knowledge")) throw new Error('personal knowledge is not loaded for background decisions')
if (!source.includes("person_relationships")) throw new Error('relationships are not loaded for background decisions')
if (!source.includes('if (person.person_key)')) throw new Error('named-person decision ownership is not preserved')
if (!source.includes('resolvedPresenceCandidates')) throw new Error('engine does not resolve precise local presence')
if (!source.includes('derivePopulationEncounters')) throw new Error('engine does not derive co-location encounters')
if (!source.includes('persistEncounterDirection')) throw new Error('engine does not persist encounter directions')
if (!source.includes("event_type: event.eventType")) throw new Error('encounter event is not persisted')
if (!source.includes("onConflict: 'person_id,other_person_id'")) throw new Error('relationship projection is not idempotent by direction')
if (!source.includes('(current?.lastInteractionTick ?? -1) >= event.tick')) throw new Error('relationship replay guard is missing')

console.log('✔ Population engine integration: decision, presence, encounters and relationships are wired')
