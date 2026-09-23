import { publishProtocolFinding, routeFinding, adoptProtocolFromFinding, type ResearchGroup } from './researchExchange'
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

if(failures) throw new Error(String(failures)+' research exchange test(s) failed')
console.log('Research exchange: tests passed; cross-group reuse requires no LLM call')
