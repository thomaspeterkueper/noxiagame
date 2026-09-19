import { memoryFromPopulationEvent, projectRelationship } from '../personSocialMemory'
import type { PopulationEncounter } from './encounters'
import type { PersonRelationship, PopulationEvent } from './types'

export interface EncounterRelationshipProjection {
  event: PopulationEvent
  relationship: PersonRelationship
}

export function projectEncounterRelationship(
  event: PopulationEvent,
  current: PersonRelationship | null,
): EncounterRelationshipProjection | null {
  const memory = memoryFromPopulationEvent(event)
  if (!memory) return null
  const relationship = projectRelationship(current, memory)
  if (!relationship) return null
  return { event, relationship }
}

export function projectEncounterRelationships(
  encounter: PopulationEncounter,
  currentByDirection: ReadonlyMap<string, PersonRelationship>,
): EncounterRelationshipProjection[] {
  const events = [encounter.eventA, encounter.eventB]
  const projections: EncounterRelationshipProjection[] = []
  for (const event of events) {
    if (!event.actorPersonId || !event.relatedPersonId) continue
    const key = `${event.actorPersonId}\u0000${event.relatedPersonId}`
    const projection = projectEncounterRelationship(event, currentByDirection.get(key) ?? null)
    if (projection) projections.push(projection)
  }
  return projections
}
