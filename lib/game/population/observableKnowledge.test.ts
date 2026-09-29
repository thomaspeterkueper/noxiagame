import { observableKnowledgeFromPopulationEvent } from './observableKnowledge'
const base:any={id:'event-1',tick:12,eventType:'social_interaction',actorPersonId:'a',relatedPersonId:'b',locationId:'q1',subjectType:'person',subjectRef:'b',payload:{tileEntityId:'cafe'}}
let f=0;const c=(x:boolean,m:string)=>{if(!x){f++;console.error('FAIL '+m)}}
const k=observableKnowledgeFromPopulationEvent(base)
c(k.length===1&&k[0].knowledgeType==='met_in_person','encounter creates directly observed acquaintance fact')
c(k[0].subjectRef==='b'&&k[0].details.tileEntityId==='cafe','observation keeps encountered person and place')
c(observableKnowledgeFromPopulationEvent({...base,eventType:'hidden_cause'}).length===0,'unknown event does not leak ground truth')
c(observableKnowledgeFromPopulationEvent({...base,actorPersonId:null}).length===0,'event without observer creates no personal knowledge')
if(f)throw new Error(String(f)+' observable knowledge test(s) failed')
console.log('Observable event knowledge: tests passed')
