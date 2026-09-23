import { rankResearchByValue } from './researchValue'
const q=(id:string,score:number)=>({id,hypothesisId:'a,b',kind:'seek_support' as const,rule:{subjectType:'site',subjectRef:'s',knowledgeType:id,weight:1},priority:score,discriminatesHypothesisIds:['a','b'],discriminationScore:score})
const options=[
 {question:q('camera',2),cost:{timeTicks:1,credits:1,energy:1,risk:.01}},
 {question:q('spectrometer',5),cost:{timeTicks:2,credits:2,energy:2,risk:.02}},
 {question:q('drill',9),cost:{timeTicks:20,credits:50,energy:30,risk:.5}},
]
const policy={timeWeight:.1,creditWeight:.05,energyWeight:.05,riskWeight:5,riskTolerance:.2}
let failures=0;const check=(x:boolean,m:string)=>{if(!x){failures++;console.error('FAIL: '+m)}}
const ranked=rankResearchByValue(options,policy)
check(ranked[0].question.id==='spectrometer','best information per burden wins rather than raw information')
check(ranked.find(x=>x.question.id==='drill')?.affordable===false,'risk tolerance can reject an informative experiment')
const again=rankResearchByValue(options,policy)
check(JSON.stringify(ranked)===JSON.stringify(again),'ranking is deterministic')
if(failures)throw new Error(String(failures)+' research-value test(s) failed')
console.log('Research value: tests passed')
