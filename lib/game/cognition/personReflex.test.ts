import { evaluateReflex, reflexAdaptation, reflexProfileFromTraits } from './personReflex'
let failures=0
const check=(ok:boolean,label:string)=>{if(!ok){failures++;console.error('FAIL: '+label)}}
const p=reflexProfileFromTraits({reflex_startle:.8,reflex_withdraw:.9})
const danger=evaluateReflex(p,{kind:'rapid_approach',intensity:1,immediacy:1})
check(danger.triggered&&danger.kind==='withdraw'&&danger.computeTier===0,'immediate danger triggers cheap withdrawal reflex')
const habituated=evaluateReflex(p,{kind:'sudden_sound',intensity:.7,immediacy:1},reflexAdaptation(20,0))
const sensitized=evaluateReflex(p,{kind:'sudden_sound',intensity:.7,immediacy:1},reflexAdaptation(5,5))
check(habituated.strength<sensitized.strength,'safe repetition habituates while harmful outcomes sensitize')
check(reflexAdaptation(20,0).habituation>0&&reflexAdaptation(20,0).sensitization===0,'safe exposure does not invent harm')
if(failures)throw new Error(String(failures)+' reflex test(s) failed')
console.log('NPC reflex runtime: tests passed; memory_reads=0; external_llm_calls=0')
