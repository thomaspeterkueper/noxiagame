import { cognitiveArtifactToRow, InMemoryCognitiveArtifactStore } from './researchPersistence'
import type { NarrativeCandidate } from './researchExchange'

async function run(){
 let failures=0; const check=(ok:boolean,label:string)=>{if(!ok){failures++;console.error('FAIL: '+label)}}
 const candidate:NarrativeCandidate={id:'nc:1',sourceDecisionId:'d:1',subjectRef:'station:a',occurredAtTick:200,significance:.8,reasonCodes:['cross_domain_effect'],evidenceRefs:['rev:2'],status:'candidate'}
 const row=cognitiveArtifactToRow(candidate)
 check(row.artifact_type==='narrative_candidate' && row.status==='candidate','candidate maps to persistent non-canon artifact')
 const store=new InMemoryCognitiveArtifactStore(); await store.save(row)
 const afterRestart=new InMemoryCognitiveArtifactStore(); for(const persisted of await store.findBySubject('station:a')) await afterRestart.save(persisted)
 const loaded=await afterRestart.findBySubject('station:a')
 check(loaded.length===1 && loaded[0].id==='nc:1','structured artifact survives store rehydration')
 check(loaded[0].artifact_type!=='canonization_record','rehydration cannot promote candidate to canon')
 if(failures) throw new Error(String(failures)+' cognitive persistence test(s) failed')
 console.log('Cognitive persistence contract: tests passed')
}
void run()
