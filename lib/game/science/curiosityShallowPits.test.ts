import { curiosityShallowPitHypotheses } from './curiosityShallowPits'
import { discriminatingQuestions } from '../population/hypothesisDiscrimination'

let failures=0
const check=(x:boolean,m:string)=>{if(!x){failures++;console.error('FAIL: '+m)}}
check(curiosityShallowPitHypotheses.length===4,'keeps four explicit competing hypotheses')
check(curiosityShallowPitHypotheses.every(h=>h.prior<0.25),'does not encode a favored explanation')
const qs=discriminatingQuestions(curiosityShallowPitHypotheses,[])
check(qs.length>0,'produces discriminating research questions')
check(qs.some(q=>q.discriminatesHypothesisIds.length>=2),'at least one observation separates competing hypotheses')
if(failures)throw new Error(String(failures)+' shallow-pit research test(s) failed')
console.log('Curiosity shallow-pit research case: tests passed')
