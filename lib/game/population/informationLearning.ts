// Closes the first NOXIA epistemic learning loop without exposing ground truth.
// Domain adapters execute/validate the information action and hand only this result back.

import type { InformationGatheringIntent } from './informationGatheringIntent'
import { knowledgeFromObservation, type PersonObservation } from './observation'
import type { PersonKnowledge } from './types'

export interface InformationActionResult {
  actionResultId: string
  intent: InformationGatheringIntent
  observedTick: number
  ok: boolean
  confidence: number
  observedPayload: Record<string, unknown>
  evidenceRefs: string[]
  validUntilTick?: number | null
  spatialScope?: Record<string, unknown> | null
}

export interface InformationLearningResult {
  observation: PersonObservation
  knowledge: PersonKnowledge
}

function sourceType(method: InformationGatheringIntent['method']): PersonObservation['sourceType'] {
  if (method === 'measure') return 'measurement'
  if (method === 'communicate') return 'communication'
  return 'sense'
}

// Pure projection of an already-authorized domain result. Callers must pass only
// the information exposed by the action, never a canonical entity/world snapshot.
export function learnFromInformationActionResult(result: InformationActionResult): InformationLearningResult | null {
  if (!result.ok) return null
  const observation: PersonObservation = {
    id: 'observation:' + result.actionResultId,
    observerPersonId: result.intent.personId,
    observedTick: result.observedTick,
    subjectType: result.intent.subjectType,
    subjectRef: result.intent.subjectRef,
    observationType: result.intent.knowledgeType ?? (result.intent.method + '_observation'),
    sourceType: sourceType(result.intent.method),
    sourceRef: result.actionResultId,
    confidence: result.confidence,
    payload: { ...result.observedPayload },
    evidenceRefs: [...result.evidenceRefs],
    validUntilTick: result.validUntilTick ?? null,
    spatialScope: result.spatialScope ?? null,
  }
  return { observation, knowledge: knowledgeFromObservation(observation) }
}
