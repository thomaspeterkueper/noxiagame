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

function pairKey(a: string, b: string): string {
  const [first, second] = pair(a, b)
  return `${first}\u0000${second}`
}

function available(person: Person): boolean {
  return person.activityState !== 'travelling'
}

function normalizedCandidates(candidates: readonly EncounterCandidate[]): EncounterCandidate[] {
  const seen = new Set<string>()
  const result = [...candidates]
    .filter(candidate => available(candidate.person))
    .sort((a, b) => a.person.id.localeCompare(b.person.id))

  for (const candidate of result) {
    if (seen.has(candidate.person.id)) {
      throw new Error(`duplicate encounter candidate person id: ${candidate.person.id}`)
    }
    seen.add(candidate.person.id)
  }
  return result
}

function areCoLocated(a: EncounterCandidate, b: EncounterCandidate): boolean {
  if (a.person.id === b.person.id) return false
  if (a.person.currentLocationId !== b.person.currentLocationId) return false
  if (a.tileEntityId && b.tileEntityId && a.tileEntityId !== b.tileEntityId) return false
  return true
}

function coLocatedPairKeys(candidates: readonly EncounterCandidate[]): Set<string> {
  const sorted = normalizedCandidates(candidates)
  const keys = new Set<string>()
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      if (areCoLocated(sorted[i], sorted[j])) {
        keys.add(pairKey(sorted[i].person.id, sorted[j].person.id))
      }
    }
  }
  return keys
}

/**
 * Emits an encounter only when a pair enters co-location in this tick.
 * A pair that remains together across ticks does not create a fresh social
 * memory on every simulation step. The authoritative orchestrator therefore
 * supplies both the current and previous persisted presence snapshots.
 *
 * A tile is required only when both candidates expose one. This preserves
 * compatibility with location-only population state while allowing later
 * interior/building precision.
 */
export function derivePopulationEncounters(input: {
  tick: number
  candidates: readonly EncounterCandidate[]
  previousCandidates: readonly EncounterCandidate[]
}): PopulationEncounter[] {
  const sorted = normalizedCandidates(input.candidates)
  const previousPairs = coLocatedPairKeys(input.previousCandidates)

  const encounters: PopulationEncounter[] = []
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      const a = sorted[i], b = sorted[j]
      if (!areCoLocated(a, b)) continue

      const [personAId, personBId] = pair(a.person.id, b.person.id)
      if (previousPairs.has(pairKey(personAId, personBId))) continue

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
