import { knowledgeFromObservation, observationIsFresh, type PersonObservation } from './observation'

let failures = 0
function check(ok: boolean, label: string) { if (!ok) { failures++; console.error(`FAIL: ${label}`) } }

const observation: PersonObservation = {
  id: 'obs-1',
  observerPersonId: 'p1',
  observedTick: 42,
  subjectType: 'deposit',
  subjectRef: 'deposit-a',
  observationType: 'survey_estimate',
  sourceType: 'measurement',
  sourceRef: 'survey-run-7',
  confidence: 0.72,
  payload: { estimatedGrade: 0.31 },
  evidenceRefs: ['event:survey-7', 'instrument:scanner-2'],
  validUntilTick: 60,
}

const first = knowledgeFromObservation(observation)
const second = knowledgeFromObservation(observation)
check(JSON.stringify(first) === JSON.stringify(second), 'same observation projects deterministically')
check(first.confidence === 0.72 && first.learnedTick === 42, 'confidence and observed tick survive projection')
const epistemic = first.details.epistemic as Record<string, unknown>
check(epistemic.sourceRef === 'survey-run-7', 'provenance survives projection')
check(Array.isArray(epistemic.evidenceRefs) && epistemic.evidenceRefs.length === 2, 'evidence refs survive projection')
check(observationIsFresh(observation, 60), 'observation remains fresh through validUntilTick')
check(!observationIsFresh(observation, 61), 'observation becomes stale after validUntilTick')

// Anti-cheat contract: projection has no ground-truth parameter. Hidden truth cannot enter
// knowledge unless a sensor/event/action result explicitly places it in an observation payload.
check(!('groundTruth' in first.details), 'projection does not manufacture hidden ground truth')

if (failures) throw new Error(`${failures} epistemic observation test(s) failed`)
console.log('Epistemic observations: tests passed')
