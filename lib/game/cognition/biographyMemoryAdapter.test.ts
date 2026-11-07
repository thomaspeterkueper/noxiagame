import { rememberBiographyEvent } from './biographyMemoryAdapter'
import type { NpcMemoryState } from './npcRelationalMemory'
import type { BiographyEvent } from './biographyEvents'
let failures=0
function check(ok:boolean,label:string){if(!ok){failures++;console.error('FAIL',label)}}
const start:NpcMemoryState={npcId:'witness',clock:{},memories:[],traces:[]}
const event:BiographyEvent={id:'birth-42',personId:'child',tick:20,kind:'birth'}
const perceived={npcId:'witness',perceivedEventId:'birth-42',atTick:25,sourceRef:'observed:birth-42',confidence:0.9,salience:0.8}
const result=rememberBiographyEvent(start,event,perceived)
check(start.memories.length===0 && result.memories.length===1,'pure memory update')
check(result.traces[0].sourceRef==='observed:birth-42','provenance retained')
check(rememberBiographyEvent(result,event,perceived)===result,'duplicate is idempotent')
check(JSON.stringify(result)===JSON.stringify(rememberBiographyEvent(start,event,perceived)),'deterministic')
try{rememberBiographyEvent(start,event,{...perceived,perceivedEventId:'other'});check(false,'no unsupported knowledge')}catch{check(true,'no unsupported knowledge')}
try{rememberBiographyEvent(start,event,{...perceived,atTick:19});check(false,'no future observation')}catch{check(true,'no future observation')}
try{rememberBiographyEvent(result,{...event,id:'birth-43'},{...perceived,perceivedEventId:'birth-43',sourceRef:'observed:birth-43'});check(false,'no key collision')}catch{check(true,'no key collision')}
if(failures)throw Error(failures+' biography-memory tests failed')
console.log('Biography-memory adapter tests passed')
