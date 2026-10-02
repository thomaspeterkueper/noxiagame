import { creativeTraceFromMemory } from './creativeTrace'
const base:any={id:'m1',personId:'p1',sourceEventId:'e1',kind:'interaction',tick:9,salience:.7,valence:.2,summary:'interaction:p2'}
let f=0;const c=(x:boolean,m:string)=>{if(!x){f++;console.error('FAIL '+m)}}
const t=creativeTraceFromMemory(base)
c(t?.traceKind==='scene_seed','salient interaction becomes scene seed')
c(t?.sourceMemoryId==='m1'&&t?.sourceEventId==='e1','trace retains provenance')
c(creativeTraceFromMemory({...base,salience:.59})===null,'low-salience memory is not automatically selected')
c(t?.subjectType==='memory','trace points to subjective memory, not hidden world state')
if(f)throw new Error(String(f)+' creative trace test(s) failed')
console.log('Creative trace: tests passed')
