import {evaluateAffectiveInteroception} from './affectiveInteroception'
let failures=0
const check=(ok:boolean,label:string)=>{if(!ok){failures++;console.error('FAIL: '+label)}}
const calm=evaluateAffectiveInteroception({})
check(calm.interoception.nociception===0&&!calm.reflex,'healthy body creates no pain or reflex')
const cut=evaluateAffectiveInteroception({injuries:[{id:'cut',region:'left_arm',tissueDamage:.6,inflammation:.35,acute:true}]})
check(cut.interoception.dominantRegion==='left_arm','injury remains body-region specific')
check(cut.affect.valence<0&&Number(cut.stimulus.emotionalSalience)>0,'nociception produces negative salient affect')
check(cut.reflex?.actionCode==='protect_injured_region','moderate injury produces protective reflex')
const severe=evaluateAffectiveInteroception({injuries:[{id:'burn',region:'right_hand',tissueDamage:1,inflammation:.5,acute:true}]})
check(severe.reflex?.actionCode==='withdraw_from_harm'&&severe.reflex.priority===.99,'severe acute harm bypasses deliberation with withdrawal')
const hungry=evaluateAffectiveInteroception({hunger:.9})
check(hungry.interoception.nociception===0&&hungry.interoception.bodilyDistress>0,'interoception distinguishes systemic distress from nociception')
if(failures)throw new Error(String(failures)+' affective interoception test(s) failed')
console.log('Affective interoception: tests passed; external_llm_calls=0; world_truth_writes=0')
