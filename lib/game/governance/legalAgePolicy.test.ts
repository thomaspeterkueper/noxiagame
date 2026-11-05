import { evaluateAdultStatus, type AgeRule } from './legalAgePolicy'
let errors=0
const check=(x:boolean,s:string)=>{if(!x){errors++;console.error('FAIL',s)}}
const laws:AgeRule[]=[
{id:'earth-18',jurisdictionId:'earth',effectiveFromTick:0,effectiveUntilTick:100,minimumAdultAgeYears:18},
{id:'earth-21',jurisdictionId:'earth',effectiveFromTick:100,minimumAdultAgeYears:21},
{id:'mars-20',jurisdictionId:'mars',effectiveFromTick:0,minimumAdultAgeYears:20},
]
const result=evaluateAdultStatus(laws,'earth',101,19)
check(result.ok && result.adult===false && result.ruleId==='earth-21','new age threshold applies')
const old=evaluateAdultStatus(laws,'earth',99,19)
check(old.ok && old.adult===true,'historic evaluation unchanged')
const mars=evaluateAdultStatus(laws,'mars',101,19)
check(mars.ok && mars.adult===false,'different jurisdiction')
check(!evaluateAdultStatus(laws,'venus',101,30).ok,'missing jurisdiction fails closed')
check(!evaluateAdultStatus([...laws,{...laws[2],id:'mars-conflict'}],'mars',101,30).ok,'overlap fails closed')
check(JSON.stringify(result)===JSON.stringify(evaluateAdultStatus(laws,'earth',101,19)),'deterministic')
if(errors)throw Error(errors+' legal age tests failed')
console.log('Legal age policy tests passed')
