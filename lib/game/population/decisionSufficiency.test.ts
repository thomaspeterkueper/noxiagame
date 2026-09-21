import { assessDecisionSufficiency } from './decisionSufficiency'
import type { PersonKnowledge } from './types'

let failures = 0
function check(ok: boolean, label: string) { if (!ok) { failures++; console.error(`FAIL: ${label}`) } }

const knowledge = (overrides: Partial<PersonKnowledge> = {}): PersonKnowledge => ({
  id: 'k1', personId: 'p1', subjectType: 'route', subjectRef: 'r1',
  knowledgeType: 'hazard_scan', confidence: 0.9, learnedTick: 90,
  sourceEventId: null, details: {}, ...overrides,
})

const policy = {
  requirements: [{ subjectType: 'route', subjectRef: 'r1', knowledgeType: 'hazard_scan', minConfidence: 0.7, maxAgeTicks: 20 }],
  minCoverage: 1,
  minAggregateConfidence: 0.7,
  risk: 'medium' as const,
  reversible: true,
  escalationAvailable: true,
}

const ready = assessDecisionSufficiency({ knowledge: [knowledge()], atTick: 100, policy })
check(ready.sufficient && ready.disposition === 'act', 'fresh sufficient evidence permits action')

const stale = assessDecisionSufficiency({ knowledge: [knowledge({ learnedTick: 50 })], atTick: 100, policy })
check(!stale.sufficient && stale.disposition === 'gather_information' && stale.reasons.includes('stale_evidence'), 'stale evidence triggers information gathering')

const missing = assessDecisionSufficiency({ knowledge: [], atTick: 100, policy })
check(!missing.sufficient && missing.disposition === 'gather_information', 'missing evidence triggers information gathering')

const low = assessDecisionSufficiency({ knowledge: [knowledge({ confidence: 0.4 })], atTick: 100, policy })
check(!low.sufficient && low.reasons.includes('low_confidence_evidence'), 'confidence is evaluated per required evidence')

const critical = assessDecisionSufficiency({ knowledge: [knowledge()], atTick: 100, policy: { ...policy, risk: 'critical' as const } })
check(!critical.sufficient && critical.disposition === 'escalate' && critical.reasons.includes('risk_requires_escalation'), 'critical action escalates despite strong evidence')

const irreversible = assessDecisionSufficiency({ knowledge: [knowledge()], atTick: 100, policy: { ...policy, risk: 'high' as const, reversible: false } })
check(!irreversible.sufficient && irreversible.disposition === 'escalate', 'high-risk irreversible action escalates despite confidence')

if (failures) throw new Error(`${failures} decision-sufficiency test(s) failed`)
console.log('Decision sufficiency: tests passed')
