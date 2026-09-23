import { discriminatingQuestions } from './hypothesisDiscrimination'
const base={subjectType:'site',subjectRef:'crater-7',prior:.1}
const impact={...base,id:'impact',hypothesisType:'impact',supporting:[
 {subjectType:'site',subjectRef:'crater-7',knowledgeType:'ejecta_pattern',weight:1},
 {subjectType:'site',subjectRef:'crater-7',knowledgeType:'shock_minerals',weight:1}],
 contradicting:[{subjectType:'site',subjectRef:'crater-7',knowledgeType:'volcanic_signature',weight:1}]}
const volcanic={...base,id:'volcanic',hypothesisType:'volcanic',supporting:[
 {subjectType:'site',subjectRef:'crater-7',knowledgeType:'volcanic_signature',weight:1}],
 contradicting:[{subjectType:'site',subjectRef:'crater-7',knowledgeType:'shock_minerals',weight:1}]}
const artificial={...base,id:'artificial',hypothesisType:'artificial_explosion',supporting:[
 {subjectType:'site',subjectRef:'crater-7',knowledgeType:'engineered_residue',weight:1},
 {subjectType:'site',subjectRef:'crater-7',knowledgeType:'shock_minerals',weight:.5}]}
let failures=0;const check=(x:boolean,m:string)=>{if(!x){failures++;console.error('FAIL: '+m)}}
const q=discriminatingQuestions([impact,volcanic,artificial],[])
check(q.length>=2,'finds shared discriminating evidence')
check(q[0].discriminatesHypothesisIds.length>=2,'top question separates multiple hypotheses')
const shock=q.find(x=>x.rule.knowledgeType==='shock_minerals')
check(!!shock&&shock.discriminatesHypothesisIds.includes('impact')&&shock.discriminatesHypothesisIds.includes('volcanic')&&shock.discriminatesHypothesisIds.includes('artificial'),'shock evidence compares all three explanations')
const known=[{id:'k',personId:'p',subjectType:'site',subjectRef:'crater-7',knowledgeType:'shock_minerals',confidence:.9,learnedTick:1,sourceEventId:null,details:{}}]
check(!discriminatingQuestions([impact,volcanic,artificial],known as any).some(x=>x.rule.knowledgeType==='shock_minerals'),'known discriminating evidence is not requested again')
if(failures)throw new Error(String(failures)+' discrimination test(s) failed')
console.log('Hypothesis discrimination: tests passed')
