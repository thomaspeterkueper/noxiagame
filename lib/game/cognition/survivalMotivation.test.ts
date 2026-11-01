import { survivalPreferences, type SurvivalContext } from './survivalMotivation'
let failures=0
function check(ok:boolean,label:string){if(!ok){failures++; console.error('FAIL',label)}}
const base:SurvivalContext={hunger:0.1,thirst:0.1,fatigue:0.1,injury:0,perceivedDanger:0.9,dependentsAtRisk:0,courage:0.1,care:0.5}
check(survivalPreferences(base)[0].action==='seek_safety','danger prompts shelter')
check(survivalPreferences({...base,perceivedDanger:0,thirst:1})[0].action==='seek_water','thirst prompts water')
check(survivalPreferences({...base,perceivedDanger:0.8,dependentsAtRisk:1,courage:1,care:1})[0].action==='help_others','courageous caregiver can help others')
check(JSON.stringify(survivalPreferences(base))===JSON.stringify(survivalPreferences({...base,actualDanger:0})), 'world omniscience avoided')
check(survivalPreferences({...base,hunger:100,thirst:-5}).every(x=>x.utility>=0&&x.utility<=1),'bounded scores')
check(JSON.stringify(survivalPreferences(base))===JSON.stringify(survivalPreferences(base)),'deterministic scoring')
if(failures)throw new Error(failures+' survival tests failed')
console.log('Survival motivation tests passed')
