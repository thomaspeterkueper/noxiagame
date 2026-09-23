import { knowledgeFromObservation } from '../population/observation'
import { assessChronobiologyKnowledge, createChronobiologyExperiment, lightingObservation, planTemporalResponse, reviseProtocol, type TemporalProtocol, type WorldEvent } from './runtime'

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

if (failures) throw new Error(String(failures)+' cognitive runtime test(s) failed')
console.log('Cognitive runtime slice: tests passed; external_llm_calls=0')
