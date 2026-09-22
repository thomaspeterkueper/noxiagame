import { assessDecisionSufficiency } from './decisionSufficiency'
import { informationGatheringIntentForAssessment } from './informationGatheringIntent'
import { learnFromInformationActionResult } from './informationLearning'

let failures = 0
function check(ok: boolean, label: string) { if (!ok) { failures++; console.error('FAIL: ' + label) } }

const policy = {
  requirements: [{ subjectType:'deposit', subjectRef:'d1', knowledgeType:'survey_scan', minConfidence:0.7, maxAgeTicks:20 }],
  minCoverage:1, minAggregateConfidence:0.7, risk:'medium' as const, reversible:true, escalationAvailable:true,
}

const before = assessDecisionSufficiency({ knowledge:[], atTick:100, policy })
const intent = informationGatheringIntentForAssessment('p1', before)
check(before.disposition === 'gather_information' && intent?.method === 'measure', 'insufficiency produces measurement intent')

const learned = intent ? learnFromInformationActionResult({
  actionResultId:'scan-1', intent, observedTick:101, ok:true, confidence:0.88,
  observedPayload:{ compositionClass:'metal-bearing' }, evidenceRefs:['sensor:spectrometer-7'],
  validUntilTick:121,
}) : null
check(learned?.observation.sourceType === 'measurement', 'validated measurement result becomes observation')
check(learned?.knowledge.details.compositionClass === 'metal-bearing', 'observation projects only exposed result payload into knowledge')
check(!('groundTruth' in (learned?.knowledge.details ?? {})), 'learning projection does not manufacture ground truth')

const after = assessDecisionSufficiency({ knowledge: learned ? [learned.knowledge] : [], atTick:102, policy })
check(after.sufficient && after.disposition === 'act', 'new evidence can satisfy the original decision')

const critical = assessDecisionSufficiency({ knowledge: learned ? [learned.knowledge] : [], atTick:102, policy:{...policy,risk:'critical' as const} })
check(!critical.sufficient && critical.disposition === 'escalate', 'evidence never bypasses critical action authority')

const failed = intent ? learnFromInformationActionResult({
  actionResultId:'scan-failed', intent, observedTick:103, ok:false, confidence:0,
  observedPayload:{}, evidenceRefs:[],
}) : null
check(failed === null, 'failed information action creates no factual knowledge')

if (failures) throw new Error(String(failures) + ' epistemic learning-cycle test(s) failed')
console.log('Epistemic learning cycle: tests passed')
