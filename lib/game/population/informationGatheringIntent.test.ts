import { informationGatheringIntentForAssessment } from './informationGatheringIntent'
import type { DecisionSufficiencyAssessment } from './decisionSufficiency'

let failures = 0
function check(ok: boolean, label: string) { if (!ok) { failures++; console.error(`FAIL: ${label}`) } }
const base: DecisionSufficiencyAssessment = { sufficient:false, disposition:'gather_information', coverage:0, aggregateConfidence:0, missingRequirements:[], staleRequirements:[], lowConfidenceRequirements:[], reasons:[] }

const scan = informationGatheringIntentForAssessment('p1', { ...base, missingRequirements:[{subjectType:'deposit',subjectRef:'d1',knowledgeType:'survey_scan'}] })
check(scan?.method === 'measure' && scan.reason === 'missing', 'missing survey evidence becomes measurement intent')

const route = informationGatheringIntentForAssessment('p1', { ...base, staleRequirements:[{subjectType:'route',subjectRef:'r1',knowledgeType:'route_state'}] })
check(route?.method === 'explore' && route.reason === 'stale', 'stale route knowledge becomes exploration intent')

const report = informationGatheringIntentForAssessment('p1', { ...base, lowConfidenceRequirements:[{subjectType:'facility',subjectRef:'f1',knowledgeType:'operator_report'}] })
check(report?.method === 'communicate' && report.reason === 'low_confidence', 'weak report evidence becomes communication intent')

check(informationGatheringIntentForAssessment('p1', { ...base, disposition:'escalate' }) === null, 'escalation is not silently converted into sensing')

if (failures) throw new Error(`${failures} information-gathering test(s) failed`)
console.log('Information gathering intents: tests passed')
