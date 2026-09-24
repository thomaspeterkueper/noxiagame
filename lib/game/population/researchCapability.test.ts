import { acquisitionIntentsForResearch, resolveResearchExecutability } from './researchCapability'
const question:any={id:'spectrometer',hypothesisId:'a,b',kind:'seek_support',rule:{subjectType:'site',subjectRef:'s',knowledgeType:'spectrum',weight:1},priority:5,discriminatesHypothesisIds:['a','b'],discriminationScore:5}
const cost={timeTicks:2,credits:3,energy:4,risk:.02}
const req={capability:'field_spectroscopy',minLevel:2,toolType:'spectrometer'}
let failures=0;const check=(x:boolean,m:string)=>{if(!x){failures++;console.error('FAIL: '+m)}}
const novice={personId:'p1',capabilities:{field_spectroscopy:1},availableToolTypes:[],credits:2,energy:10,availableTimeTicks:5}
const blocked=resolveResearchExecutability(question,cost,req,novice)
check(!blocked.executable&&blocked.blockers.includes('tool')&&blocked.blockers.includes('capability')&&blocked.blockers.includes('credits'),'missing prerequisites are explicit')
const intents=acquisitionIntentsForResearch(blocked,novice)
check(intents.some(x=>x.kind==='acquire_tool')&&intents.some(x=>x.kind==='gain_capability')&&intents.some(x=>x.kind==='secure_resources'),'research blockers create acquisition/training/resource intents')
const ready={...novice,capabilities:{field_spectroscopy:2},availableToolTypes:['spectrometer'],credits:10}
check(resolveResearchExecutability(question,cost,req,ready).executable,'qualified equipped funded actor can proceed')
if(failures)throw new Error(String(failures)+' capability test(s) failed')
console.log('Research capability: tests passed')
