// NOXIA Core decision-sufficiency gate (#214).
// Sufficiency is deliberately distinct from observation confidence: an actor can have
// high-confidence evidence that is still incomplete for a particular decision.

import { clampUnit, type PersonKnowledge } from './types'

export type DecisionSufficiencyDisposition =
  | 'act'
  | 'gather_information'
  | 'escalate'
  | 'abstain'

export interface DecisionEvidenceRequirement {
  subjectType: string
  subjectRef: string
  knowledgeType?: string | null
  minConfidence?: number
  maxAgeTicks?: number | null
}

export interface DecisionSufficiencyPolicy {
  requirements: DecisionEvidenceRequirement[]
  minCoverage?: number
  minAggregateConfidence?: number
  risk: 'low' | 'medium' | 'high' | 'critical'
  reversible: boolean
  escalationAvailable?: boolean
}

export interface DecisionSufficiencyAssessment {
  sufficient: boolean
  disposition: DecisionSufficiencyDisposition
  coverage: number
  aggregateConfidence: number
  missingRequirements: DecisionEvidenceRequirement[]
  staleRequirements: DecisionEvidenceRequirement[]
  lowConfidenceRequirements: DecisionEvidenceRequirement[]
  reasons: string[]
}

function ageOf(entry: PersonKnowledge, atTick: number): number {
  return Math.max(0, atTick - entry.learnedTick)
}

function matches(entry: PersonKnowledge, requirement: DecisionEvidenceRequirement): boolean {
  return entry.subjectType === requirement.subjectType &&
    entry.subjectRef === requirement.subjectRef &&
    (!requirement.knowledgeType || entry.knowledgeType === requirement.knowledgeType)
}

export function assessDecisionSufficiency(input: {
  knowledge: PersonKnowledge[]
  atTick: number
  policy: DecisionSufficiencyPolicy
}): DecisionSufficiencyAssessment {
  const { knowledge, atTick, policy } = input
  const minCoverage = clampUnit(policy.minCoverage ?? 1)
  const minAggregateConfidence = clampUnit(policy.minAggregateConfidence ?? 0.5)
  const missingRequirements: DecisionEvidenceRequirement[] = []
  const staleRequirements: DecisionEvidenceRequirement[] = []
  const lowConfidenceRequirements: DecisionEvidenceRequirement[] = []
  const acceptedConfidences: number[] = []

  for (const requirement of policy.requirements) {
    const candidates = knowledge.filter((entry) => matches(entry, requirement))
    if (candidates.length === 0) {
      missingRequirements.push(requirement)
      continue
    }
    const fresh = candidates.filter((entry) =>
      requirement.maxAgeTicks == null || ageOf(entry, atTick) <= requirement.maxAgeTicks,
    )
    if (fresh.length === 0) {
      staleRequirements.push(requirement)
      continue
    }
    const best = fresh.slice().sort((a, b) => b.confidence - a.confidence || b.learnedTick - a.learnedTick)[0]
    if (best.confidence < clampUnit(requirement.minConfidence ?? 0)) {
      lowConfidenceRequirements.push(requirement)
      continue
    }
    acceptedConfidences.push(clampUnit(best.confidence))
  }

  const total = policy.requirements.length
  const coverage = total === 0 ? 1 : acceptedConfidences.length / total
  const aggregateConfidence = acceptedConfidences.length === 0
    ? 0
    : acceptedConfidences.reduce((sum, value) => sum + value, 0) / acceptedConfidences.length
  const evidenceSufficient = coverage >= minCoverage && aggregateConfidence >= minAggregateConfidence
  const authorityRequiresEscalation = policy.risk === 'critical' || (policy.risk === 'high' && !policy.reversible)
  const sufficient = evidenceSufficient && !authorityRequiresEscalation

  const reasons: string[] = []
  if (missingRequirements.length) reasons.push('missing_evidence')
  if (staleRequirements.length) reasons.push('stale_evidence')
  if (lowConfidenceRequirements.length) reasons.push('low_confidence_evidence')
  if (coverage < minCoverage) reasons.push('insufficient_coverage')
  if (aggregateConfidence < minAggregateConfidence) reasons.push('insufficient_aggregate_confidence')
  if (authorityRequiresEscalation) reasons.push('risk_requires_escalation')

  let disposition: DecisionSufficiencyDisposition = 'act'
  if (authorityRequiresEscalation && policy.escalationAvailable !== false) disposition = 'escalate'
  else if (!evidenceSufficient && (missingRequirements.length || staleRequirements.length || lowConfidenceRequirements.length)) disposition = 'gather_information'
  else if (!sufficient && policy.escalationAvailable) disposition = 'escalate'
  else if (!sufficient) disposition = 'abstain'

  return {
    sufficient,
    disposition,
    coverage,
    aggregateConfidence,
    missingRequirements,
    staleRequirements,
    lowConfidenceRequirements,
    reasons,
  }
}
