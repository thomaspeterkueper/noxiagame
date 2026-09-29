import { planTirinQ1Routine } from './tirinQ1Routine'
let f=0;const c=(x:boolean,m:string)=>{if(!x){f++;console.error('FAIL '+m)}}
c(planTirinQ1Routine(2).kind==='home','night is home')
c(planTirinQ1Routine(9).kind==='archive','morning is archive')
c(planTirinQ1Routine(12).kind==='cafe','midday social stop')
c(planTirinQ1Routine(15).kind==='archive','afternoon research')
const a=planTirinQ1Routine(18).kind,b=planTirinQ1Routine(42).kind,d=planTirinQ1Routine(66).kind
c(new Set([a,b,d]).size===3,'optional public places rotate deterministically')
if(f)throw new Error(String(f)+' routine test(s) failed')
console.log('Tirin Q1 routine: tests passed')
