import { publishProtocolFinding, routeFinding, adoptProtocolFromFinding, challengeFinding, openControversy, shouldEscalateControversy, reviseControversy, decisionFromResolvedControversy, narrativeCandidateFromDecision, reviewNarrativeCandidate, canonizeNarrativeCandidate, type ResearchGroup } from './researchExchange'
import type { ProtocolRevision } from './runtime'

let failures = 0
function check(ok:boolean,label:string){ if(!ok){ failures++; console.error('FAIL: '+label) } }

const protocol: ProtocolRevision = {
  id:'tp-greenhouse', version:2, subjectRef:'station-a:greenhouse', phaseOffsetMinutes:0,
  evidenceRefs:['experiment:e1'], supersedes:'tp-greenhouse@1', approvedAtTick:120, uncertainty:0.18,
}
const finding=publishProtocolFinding({groupId:'chrono',protocol,createdAtTick:120})
const groups:ResearchGroup[]=[
  {id:'chrono',domain:'chronobiology',subscribedEvidenceTypes:['temporal_protocol_revision']},
  {id:'plants',domain:'plant_science',subscribedEvidenceTypes:['temporal_protocol_revision']},
  {id:'life',domain:'life_support',subscribedEvidenceTypes:['temporal_protocol_revision']},
]
const inbox=routeFinding(finding,groups,121)
check(inbox.length===2,'producer is not notified of its own finding')
check(inbox.some(x=>x.recipientGroupId==='plants') && inbox.some(x=>x.recipientGroupId==='life'),'dependent research groups receive finding')
const adopted=adoptProtocolFromFinding({groupId:'plants',finding,atTick:122})
check(adopted?.protocolVersion===2,'plant science can adopt sufficiently supported protocol')
const weak={...finding,id:'finding:weak',confidence:0.4}
check(adoptProtocolFromFinding({groupId:'life',finding:weak,atTick:122})===null,'weak evidence is not automatically adopted')

const plantChallenge=challengeFinding({groupId:'plants',finding,evidenceRefs:['experiment:plants-replication'],confidence:0.82,reasonCode:'failed_replication',atTick:130})
const controversy=openControversy({finding,challenge:plantChallenge})
check(controversy.status==='open' && controversy.participantGroupIds.length===2,'strong conflicting evidence opens explicit controversy')
check(!shouldEscalateControversy({finding,challenges:[plantChallenge]}),'one independent challenge stays within deterministic research loop')
const lifeChallenge=challengeFinding({groupId:'life',finding,evidenceRefs:['experiment:life-support-side-effect'],confidence:0.76,reasonCode:'side_effect',atTick:132})
check(shouldEscalateControversy({finding,challenges:[plantChallenge,lifeChallenge]}),'two independent strong challenges justify higher cognitive escalation')

const history1=reviseControversy({controversy,history:[],events:[
  {id:'ce1',controversyId:controversy.id,groupId:'plants',evidenceRefs:['rep:1'],direction:'supports_challenge',confidence:0.82,occurredAtTick:140},
  {id:'ce2',controversyId:controversy.id,groupId:'life',evidenceRefs:['rep:2'],direction:'supports_challenge',confidence:0.76,occurredAtTick:145},
]})
check(history1.status==='open' && history1.revision===1,'early conflicting evidence keeps controversy historically open')
const history2=reviseControversy({controversy,history:[history1],events:[
  {id:'ce3',controversyId:controversy.id,groupId:'plants',evidenceRefs:['rep:3'],direction:'supports_challenge',confidence:0.9,occurredAtTick:160},
  {id:'ce4',controversyId:controversy.id,groupId:'life',evidenceRefs:['rep:4'],direction:'supports_challenge',confidence:0.85,occurredAtTick:165},
  {id:'ce5',controversyId:controversy.id,groupId:'chrono-2',evidenceRefs:['rep:5'],direction:'supports_challenge',confidence:0.8,occurredAtTick:170},
]})
check(history2.status==='resolved_finding_revised' && history2.revision===2,'later convergent evidence can revise the original finding without erasing history')

const decision=decisionFromResolvedControversy({
  authorityId:'station-council-a',controversy,revision:history2,domain:'station_operations',
  decisionType:'revise_greenhouse_temporal_standard',effectiveAtTick:175,reversible:true,
})
check(decision?.status==='proposed' && decision.controversyRevisionId===history2.id,'resolved science can become an auditable societal decision')
check(decisionFromResolvedControversy({
  authorityId:'station-council-a',controversy,revision:history1,domain:'station_operations',
  decisionType:'premature_change',effectiveAtTick:150,reversible:true,
})===null,'open controversy cannot silently become policy')
const candidate=decision ? narrativeCandidateFromDecision({decision,affectedPopulation:850,durationTicks:240,crossDomainEffects:3}) : null
check(candidate!==null && candidate.reasonCodes.includes('cross_domain_effect'),'large durable cross-domain consequence becomes narrative candidate')
const trivial=decision ? narrativeCandidateFromDecision({decision,affectedPopulation:20,durationTicks:5,crossDomainEffects:0}) : null
check(trivial===null,'routine decision does not pollute narrative candidate stream')

if(candidate){
  check(canonizeNarrativeCandidate({candidate,reviews:[],canonizedBy:'canon-editor',canonizedAtTick:200,canonRef:'ore:event:2187-chrono'})===null,'simulation candidate cannot canonize itself without review')
  const review=reviewNarrativeCandidate({candidate,reviewerId:'canon-editor',atTick:190,decision:'approve',rationaleCodes:['historically_significant','provenance_complete']})
  const canon=canonizeNarrativeCandidate({candidate,reviews:[review],canonizedBy:'canon-editor',canonizedAtTick:200,canonRef:'ore:event:2187-chrono'})
  check(canon?.status==='canonized' && canon.approvedReviewIds.includes(review.id),'explicit approved review can cross canon boundary')
  const revise=reviewNarrativeCandidate({candidate,reviewerId:'continuity-review',atTick:191,decision:'revise',rationaleCodes:['continuity_conflict']})
  check(canonizeNarrativeCandidate({candidate,reviews:[review,revise],canonizedBy:'canon-editor',canonizedAtTick:200,canonRef:'ore:event:2187-chrono'})===null,'revise or reject blocks canonization')
}

if(failures) throw new Error(String(failures)+' research exchange test(s) failed')
console.log('Research exchange: tests passed; cross-group reuse requires no LLM call')
