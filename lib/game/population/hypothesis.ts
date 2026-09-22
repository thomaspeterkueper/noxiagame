// NOXIA Core evidence/hypothesis layer (#214).
// Deterministic, bounded inference: hypotheses are declared by a domain catalogue.
// This module never invents causes and never reads canonical historical events.

import { clampUnit, type PersonKnowledge } from './types'

export interface HypothesisEvidenceRule {
  subjectType: string
  subjectRef: string
  knowledgeType: string
  weight: number
  minConfidence?: number
}

export interface EpistemicHypothesisDefinition {
  id: string
  hypothesisType: string
  subjectType: string
  subjectRef: string
  prior: number
  supporting: HypothesisEvidenceRule[]
  contradicting?: HypothesisEvidenceRule[]
}

export interface HypothesisAssessment {
  hypothesisId: string
  hypothesisType: string
  subjectType: string
  subjectRef: string
  confidence: number
  support: number
  contradiction: number
  evidenceKnowledgeIds: string[]
  missingSupportingRules: number
  status: 'unsupported' | 'plausible' | 'supported' | 'contested'
}

function matches(k: PersonKnowledge, r: HypothesisEvidenceRule) {
  return k.subjectType === r.subjectType && k.subjectRef === r.subjectRef &&
    k.knowledgeType === r.knowledgeType && k.confidence >= clampUnit(r.minConfidence ?? 0)
}

function contribution(k: PersonKnowledge, r: HypothesisEvidenceRule) {
  return clampUnit(k.confidence) * Math.max(0, r.weight)
}

export function assessHypothesis(definition: EpistemicHypothesisDefinition, knowledge: PersonKnowledge[]): HypothesisAssessment {
  let support = 0
  let contradiction = 0
  let missingSupportingRules = 0
  const ids = new Set<string>()

  for (const rule of definition.supporting) {
    const candidates = knowledge.filter(k => matches(k, rule)).sort((a,b) => b.confidence - a.confidence)
    if (!candidates[0]) { missingSupportingRules++; continue }
    support += contribution(candidates[0], rule)
    ids.add(candidates[0].id)
  }
  for (const rule of definition.contradicting ?? []) {
    const candidates = knowledge.filter(k => matches(k, rule)).sort((a,b) => b.confidence - a.confidence)
    if (!candidates[0]) continue
    contradiction += contribution(candidates[0], rule)
    ids.add(candidates[0].id)
  }

  const prior = clampUnit(definition.prior)
  const supportWeight = definition.supporting.reduce((sum, rule) => sum + Math.max(0, rule.weight), 0)
  const contradictionWeight = (definition.contradicting ?? []).reduce((sum, rule) => sum + Math.max(0, rule.weight), 0)
  const supportRatio = supportWeight > 0 ? clampUnit(support / supportWeight) : 0
  const contradictionRatio = contradictionWeight > 0 ? clampUnit(contradiction / contradictionWeight) : 0
  // Evidence updates a bounded prior instead of dividing by accumulated evidence.
  // This lets independent supporting observations increase confidence while
  // contradictory observations reduce it without ever exposing ground truth.
  const confidence = clampUnit(prior + (1 - prior) * supportRatio * (1 - contradictionRatio))
  let status: HypothesisAssessment['status'] = 'unsupported'
  if (support > 0 && contradiction > 0) status = 'contested'
  else if (confidence >= 0.75 && missingSupportingRules === 0) status = 'supported'
  else if (support > 0) status = 'plausible'

  return {
    hypothesisId: definition.id, hypothesisType: definition.hypothesisType,
    subjectType: definition.subjectType, subjectRef: definition.subjectRef,
    confidence, support, contradiction, evidenceKnowledgeIds:[...ids].sort(),
    missingSupportingRules, status,
  }
}
