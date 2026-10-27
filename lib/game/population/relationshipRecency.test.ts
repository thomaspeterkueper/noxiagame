import { encounterRecencyAfterTick, nextEncounterRecency } from './relationshipRecency'

let failures=0
const check=(ok:boolean,label:string)=>{if(!ok){failures++;console.error('FAIL: '+label)}}

const first=nextEncounterRecency(0,null,100)
check(Math.abs(first-.05)<1e-9,'first encounter creates small recency evidence')
const repeated=nextEncounterRecency(.5,95,100)
check(repeated>.5,'closely repeated encounter strengthens recency evidence')
check(encounterRecencyAfterTick(.8,24)<.8,'recency decays without contact')
check(encounterRecencyAfterTick(.8,0)===.8,'zero elapsed ticks preserve evidence')

if(failures)throw new Error(String(failures)+' relationship-recency test(s) failed')
console.log('Relationship recency evidence: tests passed')
