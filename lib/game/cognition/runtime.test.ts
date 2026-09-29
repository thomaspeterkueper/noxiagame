import { knowledgeFromObservation } from '../population/observation'
import { assessChronobiologyKnowledge, assessResearchEvidence, createChronobiologyExperiment, createMagnetobiologyExperiment, createResearchFinding, lightingObservation, planTemporalResponse, reviseProtocol, type TemporalProtocol, type WorldEvent } from './runtime'

let failures = 0
function check(ok: boolean, label: string) { if (!ok) { failures++; console.error('FAIL: ' + label) } }

const protocol: TemporalProtocol = { id:'tp-greenhouse', version:1, subjectRef:'station-a:greenhouse', phaseOffsetMinutes:0, evidenceRefs:['study:baseline'] }
const event = (minutes:number): WorldEvent => ({ id:'lighting-'+minutes, type:'HabitatLightingPhaseShift', occurredAtTick:100, scopeRef:protocol.subjectRef, sourceSystem:'habitat-lighting', payload:{ actualPhaseOffsetMinutes:minutes } })

const normal = planTemporalResponse(lightingObservation(event(5),'chrono-1',5), protocol)
check(normal.action === 'none', 'normal profile remains L0')
const known = planTemporalResponse(lightingObservation(event(45),'chrono-1',45), protocol)
check(known.action === 'apply_known_protocol', 'known deviation remains rule based')
const novelObs = lightingObservation(event(100),'chrono-1',100)
const novel = planTemporalResponse(novelObs, protocol)
check(novel.action === 'plan_experiment', 'novel deviation creates experiment path')
const ambiguous = planTemporalResponse(lightingObservation(event(180),'chrono-1',180,0.35), protocol)
check(ambiguous.action === 'escalate' && ambiguous.escalation?.status === 'pending', 'uncertain case persists L4 request only')

const hidden = event(100); hidden.payload.hiddenCause = 'controller-firmware-bug'
const observed = lightingObservation(hidden,'chrono-2',100)
check(!('hiddenCause' in observed.payload), 'observation does not leak ground truth')

const knowledge = knowledgeFromObservation(novelObs)
const sufficient = assessChronobiologyKnowledge([knowledge], protocol.subjectRef, 101)
check(sufficient.sufficient && sufficient.disposition === 'act', 'existing epistemic sufficiency gate accepts fresh evidence')
const stale = assessChronobiologyKnowledge([knowledge], protocol.subjectRef, 130)
check(!stale.sufficient && stale.disposition === 'gather_information', 'stale evidence requires new observation')

const research = createChronobiologyExperiment(novelObs,'chrono-team-a')
check(research.hypothesis.status === 'testing' && research.experiment.status === 'planned', 'L2 creates structured research objects')
const revised = reviseProtocol({ protocol, experiment:research.experiment, evidenceRefs:['experiment:'+research.experiment.id], approvedAtTick:120, uncertainty:0.18 })
check(revised.version === 2 && revised.supersedes === 'tp-greenhouse@1', 'experiment can create versioned protocol revision')


const magnetic = createMagnetobiologyExperiment({
  subjectRef: 'station-a:bio-lab-1',
  groupId: 'magbio-team-a',
  organismContext: 'model-organism:controlled-line-a',
  baselineMicrotesla: 45,
  exposureMicrotesla: 0.005,
  durationTicks: 48,
  measurements: ['mitochondrial_respiration', 'superoxide_proxy'],
  evidenceRefs: ['OTA-SCI-0096-2026-DE'],
})
check(magnetic.experiment.status === 'planned', 'magnetobiology experiment uses shared ExperimentPlan')
check(magnetic.experiment.intervention.organismContext === magnetic.experiment.baseline.organismContext, 'organism context remains controlled')

const nullFinding = createResearchFinding({
  experiment: magnetic.experiment,
  subjectRef: magnetic.hypothesis.subjectRef,
  outcome: 'null',
  measurementRefs: ['obs:magbio:run-1'],
  effectEstimate: 0,
  uncertainty: 0.2,
  context: { organismContext: 'model-organism:controlled-line-a', exposureMicrotesla: 0.005 },
  createdAtTick: 200,
})
const nullAssessment = assessResearchEvidence(magnetic.hypothesis, [nullFinding])
check(nullAssessment.status === 'insufficient' && !nullAssessment.allowsProtocolRevision, 'null result is preserved and grants no protocol revision')

const support1 = createResearchFinding({
  experiment: magnetic.experiment,
  subjectRef: magnetic.hypothesis.subjectRef,
  outcome: 'supports',
  measurementRefs: ['obs:magbio:run-2'],
  effectEstimate: 0.18,
  uncertainty: 0.18,
  context: { organismContext: 'model-organism:controlled-line-a', exposureMicrotesla: 0.005 },
  createdAtTick: 260,
})
const provisional = assessResearchEvidence(magnetic.hypothesis, [support1])
check(provisional.status === 'provisional' && !provisional.allowsProtocolRevision, 'single positive finding remains provisional')

const support2 = createResearchFinding({
  experiment: magnetic.experiment,
  subjectRef: magnetic.hypothesis.subjectRef,
  outcome: 'supports',
  measurementRefs: ['obs:magbio:replication-1'],
  effectEstimate: 0.16,
  uncertainty: 0.16,
  context: { organismContext: 'model-organism:controlled-line-a', exposureMicrotesla: 0.005, replication: true },
  createdAtTick: 320,
})
const replicated = assessResearchEvidence(magnetic.hypothesis, [support1, support2])
check(replicated.status === 'replicated' && replicated.allowsProtocolRevision, 'replicated findings may enter protocol review')
check(!('humanHealthEffect' in magnetic.experiment.intervention), 'model-organism experiment does not synthesize human effects')

if (failures) throw new Error(String(failures)+' cognitive runtime test(s) failed')
console.log('Cognitive runtime slice: tests passed; external_llm_calls=0')
