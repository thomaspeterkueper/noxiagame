// NOXIA Core epistemic observation layer (#214).
// Pure types/projection only: this module never reads or mutates ground truth.

import { clampUnit, type PersonKnowledge } from './types'

export interface PersonObservation {
  id: string
  observerPersonId: string
  observedTick: number
  subjectType: string
  subjectRef: string
  observationType: string
  sourceType: 'sense' | 'measurement' | 'action_result' | 'communication' | 'event'
  sourceRef: string | null
  confidence: number
  payload: Record<string, unknown>
  evidenceRefs: string[]
  validUntilTick?: number | null
  spatialScope?: Record<string, unknown> | null
}

export function knowledgeFromObservation(observation: PersonObservation): PersonKnowledge {
  return {
    id: `knowledge:${observation.id}`,
    personId: observation.observerPersonId,
    subjectType: observation.subjectType,
    subjectRef: observation.subjectRef,
    knowledgeType: observation.observationType,
    confidence: clampUnit(observation.confidence),
    learnedTick: observation.observedTick,
    sourceEventId: observation.sourceType === 'event' ? observation.sourceRef : null,
    details: {
      ...observation.payload,
      epistemic: {
        observationId: observation.id,
        observedAtTick: observation.observedTick,
        sourceType: observation.sourceType,
        sourceRef: observation.sourceRef,
        evidenceRefs: [...observation.evidenceRefs],
        validUntilTick: observation.validUntilTick ?? null,
        spatialScope: observation.spatialScope ?? null,
      },
    },
  }
}

export function observationIsFresh(observation: PersonObservation, atTick: number): boolean {
  return observation.validUntilTick == null || atTick <= observation.validUntilTick
}
