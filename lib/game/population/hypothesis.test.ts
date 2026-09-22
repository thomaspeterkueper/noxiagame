import { assessHypothesis } from './hypothesis'
import type { PersonKnowledge } from './types'
const k=(id:string,type:string,confidence:number):PersonKnowledge=>({id,personId:'p1',subjectType:'site',subjectRef:'crater-7',knowledgeType:type,confidence,learnedTick:10,sourceEventId:null,details:{}})
const impact={id:'h-impact',hypothesisType:'past_impact',subjectType:'site',subjectRef:'crater-7',prior:0.1,
 supporting:[
  {subjectType:'site',subjectRef:'crater-7',knowledgeType:'fresh_crater_morphology',weight:1,minConfidence:0.6},
  {subjectType:'site',subjectRef:'crater-7',knowledgeType:'ejecta_pattern',weight:1,minConfidence:0.6},
 ],
 contradicting:[{subjectType:'site',subjectRef:'crater-7',knowledgeType:'volcanic_signature',weight:1,minConfidence:0.6}]
}
let failures=0; const check=(x:boolean,m:string)=>{if(!x){failures++;console.error('FAIL: '+m)}}
const none=assessHypothesis(impact,[]); check(none.status==='unsupported','no evidence does not invent history')
const one=assessHypothesis(impact,[k('k1','fresh_crater_morphology',.9)]); check(one.status==='plausible'&&one.missingSupportingRules===1,'partial evidence remains hypothesis')
const two=assessHypothesis(impact,[k('k1','fresh_crater_morphology',.9),k('k2','ejecta_pattern',.9)]); check(two.status==='supported'&&two.evidenceKnowledgeIds.length===2,'multiple independent observations can support hypothesis')
const contested=assessHypothesis(impact,[k('k1','fresh_crater_morphology',.9),k('k2','ejecta_pattern',.9),k('k3','volcanic_signature',.9)]); check(contested.status==='contested'&&contested.confidence<two.confidence,'contradictory evidence weakens hypothesis')
const again=assessHypothesis(impact,[k('k1','fresh_crater_morphology',.9),k('k2','ejecta_pattern',.9)]); check(JSON.stringify(two)===JSON.stringify(again),'same evidence is deterministic')
if(failures) throw new Error(String(failures)+' hypothesis test(s) failed')
console.log('Evidence/hypothesis inference: tests passed')
