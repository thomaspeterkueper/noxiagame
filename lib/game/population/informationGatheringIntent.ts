// Converts an epistemic insufficiency into an auditable information-gathering intent.
// It does not perform sensing and never reads ground truth.

import type { DecisionEvidenceRequirement, DecisionSufficiencyAssessment } from './decisionSufficiency'

export type InformationGatheringMethod = 'observe' | 'measure' | 'communicate' | 'explore'

export interface InformationGatheringIntent {
  kind: 'gather_information'
  personId: string
  subjectType: string
  subjectRef: string
  knowledgeType: string | null
  method: InformationGatheringMethod
  reason: 'missing' | 'stale' | 'low_confidence'
}

function methodFor(requirement: DecisionEvidenceRequirement): InformationGatheringMethod {
  const type = (requirement.knowledgeType ?? '').toLowerCase()
  if (type.includes('measure') || type.includes('scan') || type.includes('survey')) return 'measure'
  if (type.includes('report') || type.includes('testimony') || type.includes('communication')) return 'communicate'
  if (type.includes('location') || type.includes('route') || type.includes('terrain')) return 'explore'
  return 'observe'
}

function intent(personId: string, requirement: DecisionEvidenceRequirement, reason: InformationGatheringIntent['reason']): InformationGatheringIntent {
  return {
    kind: 'gather_information',
    personId,
    subjectType: requirement.subjectType,
    subjectRef: requirement.subjectRef,
    knowledgeType: requirement.knowledgeType ?? null,
    method: methodFor(requirement),
    reason,
  }
}

export function informationGatheringIntentForAssessment(
  personId: string,
  assessment: DecisionSufficiencyAssessment,
): InformationGatheringIntent | null {
  if (assessment.disposition !== 'gather_information') return null
  if (assessment.missingRequirements[0]) return intent(personId, assessment.missingRequirements[0], 'missing')
  if (assessment.staleRequirements[0]) return intent(personId, assessment.staleRequirements[0], 'stale')
  if (assessment.lowConfidenceRequirements[0]) return intent(personId, assessment.lowConfidenceRequirements[0], 'low_confidence')
  return null
}
