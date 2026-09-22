// Turns gaps in a bounded hypothesis into explicit research questions/intents.
// It never asks for the historical event itself; only declared observable evidence.

import type { EpistemicHypothesisDefinition, HypothesisEvidenceRule } from './hypothesis'
import type { InformationGatheringIntent, InformationGatheringMethod } from './informationGatheringIntent'
import type { PersonKnowledge } from './types'

export interface HypothesisResearchQuestion {
  id: string
  hypothesisId: string
  kind: 'seek_support' | 'test_contradiction'
  rule: HypothesisEvidenceRule
  priority: number
}

function hasEvidence(knowledge: PersonKnowledge[], rule: HypothesisEvidenceRule) {
  return knowledge.some(k => k.subjectType === rule.subjectType && k.subjectRef === rule.subjectRef &&
    k.knowledgeType === rule.knowledgeType && k.confidence >= (rule.minConfidence ?? 0))
}

function methodFor(type: string): InformationGatheringMethod {
  const t=type.toLowerCase()
  if (t.includes('scan')||t.includes('spectr')||t.includes('measure')||t.includes('pattern')||t.includes('signature')) return 'measure'
  if (t.includes('report')||t.includes('testimony')) return 'communicate'
  if (t.includes('route')||t.includes('terrain')||t.includes('location')) return 'explore'
  return 'observe'
}

export function researchQuestionsForHypothesis(definition: EpistemicHypothesisDefinition, knowledge: PersonKnowledge[]): HypothesisResearchQuestion[] {
  const questions: HypothesisResearchQuestion[]=[]
  for (const rule of definition.supporting) if (!hasEvidence(knowledge,rule)) questions.push({
    id:'question:'+definition.id+':support:'+rule.knowledgeType,
    hypothesisId:definition.id, kind:'seek_support', rule, priority:Math.max(0,rule.weight),
  })
  for (const rule of definition.contradicting ?? []) if (!hasEvidence(knowledge,rule)) questions.push({
    id:'question:'+definition.id+':contradict:'+rule.knowledgeType,
    hypothesisId:definition.id, kind:'test_contradiction', rule, priority:Math.max(0,rule.weight)*0.9,
  })
  return questions.sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id))
}

export function informationIntentForResearchQuestion(personId:string, question:HypothesisResearchQuestion): InformationGatheringIntent {
  return {
    kind:'gather_information', personId,
    subjectType:question.rule.subjectType, subjectRef:question.rule.subjectRef,
    knowledgeType:question.rule.knowledgeType, method:methodFor(question.rule.knowledgeType),
    reason:'missing',
  }
}
