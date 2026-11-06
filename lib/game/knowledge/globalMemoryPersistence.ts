import type { Observation } from '../cognition/observation'
import { persistEpistemicObservations } from '../cognition/personEpistemicPersistence'
import { learnFromHistoricalSource, type HistoricalEvent, type HistoricalExposure, type HistoricalSource } from './globalMemory'

/**
 * A historical source encounter becomes an epistemic observation in the
 * EXISTING person_epistemic_traces pipeline. No second NPC memory store.
 *
 * Caller obligations:
 *  - confirm encounter in the authoritative runtime, rather than trusting
 *    an arbitrary client-supplied exposure;
 *  - authorize the source before loading it, and apply deletion/retention
 *    policy to source bodies and resulting derived person-memory traces;
 *  - supply a stable UUID from the encounter pipeline for idempotent writes.
 *
 * This function never persists the canonical event as omniscient actor truth.
 */
export function prepareHistoricalObservation(input: {
  actorId: string
  event: HistoricalEvent
  source: HistoricalSource
  exposure: HistoricalExposure
  encounterId: string
  observationId: string
  salience?: number
}): Observation<string> {
  if (!input.encounterId.trim()) throw new Error('Historical encounter ID required')
  if (!input.observationId.trim()) throw new Error('Historical observation ID required')
  if (input.actorId !== input.exposure.actorId) throw new Error('Observation actor mismatch')
  const knowledge = learnFromHistoricalSource({
    event: input.event, source: input.source, exposure: input.exposure,
  })
  const salience = input.salience ?? 0.5
  if (!Number.isFinite(salience) || salience < 0 || salience > 1) throw new Error('Invalid salience')
  return {
    id: input.observationId,
    observerId: input.actorId,
    subjectRef: knowledge.eventId,
    attribute: 'historical_claim',
    value: knowledge.claimText,
    source: {
      type: 'record',
      id: knowledge.sourceId,
      provenanceRefs: ['historical-event:' + knowledge.eventId, 'historical-encounter:' + input.encounterId],
    },
    modality: knowledge.epistemicStatus === 'direct-observation' ? 'visual' : 'reported',
    observedAtTick: knowledge.learnedAtTick,
    confidence: knowledge.epistemicStatus === 'direct-observation' ? 0.8 : 0.55,
    salience,
  }
}

export async function persistConfirmedHistoricalEncounter(
  supabase: any,
  input: Parameters<typeof prepareHistoricalObservation>[0],
) {
  const observation = prepareHistoricalObservation(input)
  return persistEpistemicObservations(supabase, [observation])
}
