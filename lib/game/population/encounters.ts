// NOXIA-LIVING — deterministic co-location encounters.
// Encounters are derived from persisted simulation state; dialogue never creates them.

import type { Person, PopulationEvent } from './types'

export interface EncounterCandidate {
  person: Person
  tileEntityId?: string | null
}

export interface PopulationEncounter {
  id: string
  tick: number
  locationId: string
  tileEntityId: string | null
  personAId: string
  personBId: string
  eventA: PopulationEvent
  eventB: PopulationEvent
}

function pair(a: string, b: string): [string, string] {
  return a.localeCompare(b) <= 0 ? [a, b] : [b, a]
}

function available(person: Person): boolean {
  return person.activityState !== 'travelling'
}

/**
 * Produces at most one encounter for each co-located pair in this tick.
 * A tile is required only when both candidates expose one; this keeps the
 * model compatible with location-only population state while allowing later
 * interior/building precision.
 */
export function derivePopulationEncounters(input: {
  tick: number
  candidates: readonly EncounterCandidate[]
}): PopulationEncounter[] {
  const sorted = [...input.candidates]
    .filter(candidate => available(candidate.person))
    .sort((a, b) => a.person.id.localeCompare(b.person.id))

  const encounters: PopulationEncounter[] = []
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      const a = sorted[i], b = sorted[j]
      if (a.person.currentLocationId !== b.person.currentLocationId) continue
      if (a.tileEntityId && b.tileEntityId && a.tileEntityId !== b.tileEntityId) continue

      const [personAId, personBId] = pair(a.person.id, b.person.id)
      const tileEntityId = a.tileEntityId && b.tileEntityId && a.tileEntityId === b.tileEntityId
        ? a.tileEntityId
        : null
      const id = `encounter:${input.tick}:${personAId}:${personBId}`
      const payload = { encounterId: id, coLocated: true, tileEntityId }

      const event = (actorPersonId: string, relatedPersonId: string): PopulationEvent => ({
        id: `${id}:${actorPersonId}`,
        tick: input.tick,
        eventType: 'social_interaction',
        actorPersonId,
        relatedPersonId,
        locationId: a.person.currentLocationId,
        subjectType: 'person',
        subjectRef: relatedPersonId,
        payload,
      })

      encounters.push({
        id,
        tick: input.tick,
        locationId: a.person.currentLocationId,
        tileEntityId,
        personAId,
        personBId,
        eventA: event(personAId, personBId),
        eventB: event(personBId, personAId),
      })
    }
  }
  return encounters
}
