import { classifyHabitExecution } from './habitExecutionEvidence'
import type { PopulationIntentExecutionResult } from './personActionExecutor'
const assert=(v:boolean,msg:string)=>{if(!v)throw new Error(msg)}
const request={executed:true,kind:'person_action_request',detail:{ok:true}} as PopulationIntentExecutionResult
const visit={executed:true,kind:'social_visit',detail:{ok:true}} as PopulationIntentExecutionResult
const blocked={executed:false,kind:'travel',reason:'not_executed_here'} as PopulationIntentExecutionResult
assert(classifyHabitExecution('social_interaction',visit).status==='executed','confirmed visit should be executed')
assert(classifyHabitExecution('work',request).status==='unverified','request is not fulfilled work')
assert(classifyHabitExecution('travel_work',blocked).status==='unverified','unowned travel is unverified')
console.log('habit evidence PASS')
