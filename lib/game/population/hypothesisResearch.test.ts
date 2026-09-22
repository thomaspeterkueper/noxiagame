import { assessHypothesis } from './hypothesis'
import { informationIntentForResearchQuestion, researchQuestionsForHypothesis } from './hypothesisResearch'
import type { PersonKnowledge } from './types'
const k=(id:string,type:string,c=.9):PersonKnowledge=>({id,personId:'p1',subjectType:'site',subjectRef:'crater-7',knowledgeType:type,confidence:c,learnedTick:1,sourceEventId:null,details:{}})
const def={id:'impact',hypothesisType:'past_impact',subjectType:'site',subjectRef:'crater-7',prior:.1,supporting:[
 {subjectType:'site',subjectRef:'crater-7',knowledgeType:'fresh_crater_morphology',weight:1,minConfidence:.6},
 {subjectType:'site',subjectRef:'crater-7',knowledgeType:'ejecta_pattern',weight:1,minConfidence:.6}],
 contradicting:[{subjectType:'site',subjectRef:'crater-7',knowledgeType:'volcanic_signature',weight:.8,minConfidence:.6}]}
let failures=0;const check=(x:boolean,m:string)=>{if(!x){failures++;console.error('FAIL: '+m)}}
const known=[k('morph','fresh_crater_morphology')]
check(assessHypothesis(def,known).status==='plausible','starting hypothesis is provisional')
const qs=researchQuestionsForHypothesis(def,known)
check(qs.some(q=>q.rule.knowledgeType==='ejecta_pattern'),'hypothesis asks for missing supporting evidence')
check(qs.some(q=>q.rule.knowledgeType==='volcanic_signature'&&q.kind==='test_contradiction'),'hypothesis also seeks falsifying evidence')
const q=qs.find(q=>q.rule.knowledgeType==='ejecta_pattern')!
const intent=informationIntentForResearchQuestion('p1',q)
check(intent.method==='measure'&&intent.knowledgeType==='ejecta_pattern','research question becomes measurement intent')
const after=assessHypothesis(def,[...known,k('ejecta','ejecta_pattern')])
check(after.status==='supported','answering research question can strengthen hypothesis')
const done=researchQuestionsForHypothesis(def,[...known,k('ejecta','ejecta_pattern'),k('volcanic','volcanic_signature')])
check(done.length===0,'already observed evidence is not requested repeatedly')
if(failures)throw new Error(String(failures)+' research-cycle test(s) failed')
console.log('Hypothesis research cycle: tests passed')
