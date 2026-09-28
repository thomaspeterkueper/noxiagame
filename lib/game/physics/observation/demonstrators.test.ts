import { HORIZON_REFRACTION_DEMONSTRATOR_ID, runHorizonRefractionDemonstrator } from './demonstrators.ts'
let fails=0
const check=(ok:boolean,label:string)=>{if(!ok){fails++;console.log('FAIL:',label)}}
const earth=runHorizonRefractionDemonstrator({geometricAltitudeDeg:0,atmosphere:{pressureHpa:1010,temperatureC:10}})
check(earth.demonstratorId===HORIZON_REFRACTION_DEMONSTRATOR_ID,'stable demonstrator id')
check(earth.explanation.apparentAltitudeDeg>earth.explanation.geometricAltitudeDeg,'exposes explainable displacement')
const vacuum=runHorizonRefractionDemonstrator({geometricAltitudeDeg:0,atmosphere:null})
check(vacuum.explanation.refractionDeg===0,'vacuum experiment')
console.log(fails===0?'Horizon demonstrator tests passed':fails+' failures')
process.exitCode=fails?1:0
