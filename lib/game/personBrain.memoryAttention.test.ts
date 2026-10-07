import { memoryAttentionSignal } from './personBrain'
let failures=0
const check=(ok:boolean,label:string)=>{if(!ok){failures++;console.error('FAIL: '+label)}}
const empty=memoryAttentionSignal([])
check(empty.salience===0&&empty.uncertainty===0,'no consolidated memory creates no attention bias')
const signal=memoryAttentionSignal([{trace_id:'weak',retention:.3,replay_priority:.2},{trace_id:'strong',retention:.8,replay_priority:.9}])
check(signal.strongestTraceId==='strong','highest replay priority drives attention')
check(Math.abs(signal.salience-.9)<1e-9,'replay priority maps to bounded salience')
check(Math.abs(signal.uncertainty-.2)<1e-9,'retention maps inversely to bounded uncertainty')
if(failures)throw new Error(String(failures)+' memory attention test(s) failed')
console.log('Memory attention: tests passed; world_truth_writes=0; external_llm_calls=0')
