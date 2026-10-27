import { deriveRegulationState, regulatedFamilyDesire } from './personInteroception'

let failures=0
const check=(ok:boolean,label:string)=>{if(!ok){failures++;console.error('FAIL: '+label)}}

const calmBonded=deriveRegulationState({
 affect:{joy:.4,fear:0,anger:0,sadness:0,mood:.3,pain:0},
 needs:{rest:.8,safety:.9,social:.8,purpose:.7,variety:.6},
 strongestBond:{trust:.85,affinity:.82,familiarity:.95,recent:.8},
})
const stressed=deriveRegulationState({
 affect:{joy:0,fear:.8,anger:.3,sadness:.4,mood:-.5,pain:.4},
 needs:{rest:.25,safety:.2,social:.3,purpose:.4,variety:.4},
 strongestBond:null,
})
check(calmBonded.socialBondingTone>stressed.socialBondingTone,'bonding follows persisted social safety')
check(stressed.stressAxis>calmBonded.stressAxis,'stress follows affect and unmet body needs')
check(regulatedFamilyDesire(.65,calmBonded)>.65,'stable bonding can only nudge existing family intent')
check(regulatedFamilyDesire(.65,stressed)<.65,'high regulatory load can postpone family intent')

if(failures)throw new Error(String(failures)+' interoception test(s) failed')
console.log('Coarse interoceptive regulation: tests passed')
