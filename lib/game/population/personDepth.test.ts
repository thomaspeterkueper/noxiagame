import { assessPersonDepth, shouldEnrichPerson } from './personDepth'

let failures=0
const check=(ok:boolean,label:string)=>{if(!ok){failures++;console.error('FAIL: '+label)}}

const shallow=assessPersonDepth({active:true,hasHome:false,hasWork:false,hasEconomy:false,hasAppearance:false,hasLifeState:false,relationshipCount:0,memoryCount:0,skillCount:0})
check(shallow.level==='persistent','active identity alone stays persistent')

const developed=assessPersonDepth({active:true,hasHome:true,hasWork:true,hasEconomy:true,hasAppearance:true,hasLifeState:true,relationshipCount:3,memoryCount:70,skillCount:1})
check(developed.level==='developed','situated life with relationships and history becomes developed')
check(shouldEnrichPerson({active:true,hasHome:true,hasWork:true,hasEconomy:true,hasAppearance:true,hasLifeState:true,relationshipCount:7,memoryCount:130,skillCount:1}),'deep lived history warrants richer presentation')

if(failures)throw new Error(String(failures)+' person-depth test(s) failed')
console.log('Adaptive person depth: tests passed')
