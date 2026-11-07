import type { PersonObservation } from '../../game/population/observation'
import type { ProvenanceAssertion, ProvenanceLayer } from './historicalProvenance'

const confidenceByStatus: Record<NonNullable<ProvenanceAssertion['confidence']>, number> = {
  documented: 0.95,
  provisional: 0.6,
  contested: 0.45,
}

export type ProvenanceObservationInput = {
  assertion: ProvenanceAssertion
  observerPersonId: string
  observedTick: number
  communicationSourceRef: string
}

/**
 * Bridges source-side provenance into the existing actor epistemic pipeline.
 * It deliberately emits a communication observation rather than PersonKnowledge:
 * actors still have to receive information before they can know it.
 */
export function observationFromProvenance(input: ProvenanceObservationInput): PersonObservation {
  const { assertion } = input
  return {
    id: `prov-observation:${input.observerPersonId}:${assertion.id}:${input.observedTick}`,
    observerPersonId: input.observerPersonId,
    observedTick: input.observedTick,
    subjectType: 'historical-provenance',
    subjectRef: assertion.subjectId,
    observationType: `provenance:${assertion.layer}`,
    sourceType: 'communication',
    sourceRef: input.communicationSourceRef,
    confidence: assertion.confidence ? confidenceByStatus[assertion.confidence] : 0.7,
    payload: {
      provenanceAssertionId: assertion.id,
      provenanceLayer: assertion.layer,
      sourceRef: assertion.sourceRef,
      summary: assertion.summary,
    },
    evidenceRefs: [assertion.id, assertion.sourceRef],
  }
}

export function isFictionCanonKnowledgeType(knowledgeType: string): boolean {
  return knowledgeType === 'provenance:fiction-canon'
}

export function provenanceKnowledgeType(layer: ProvenanceLayer): string {
  return `provenance:${layer}`
}
