import { nearbyPlaceObservation } from './npcObservationMemory'
import { emptyPerceptionFilterState, filterPerception } from './npcPerceptionFilter'

let failures=0
const check=(ok:boolean,label:string)=>{if(!ok){failures++;console.error('FAIL: '+label)}}

let state=emptyPerceptionFilterState()
const first=nearbyPlaceObservation({npcId:'hana',targetRef:'place:cafe',placeName:'Café',kind:'cafe',distanceM:8,atTick:10})
let d=filterPerception({state,observation:first})
check(d.emit&&d.reason==='first_seen','first sighting emits')
state=d.nextState

d=filterPerception({state,observation:{...first,observedAtTick:11}})
check(!d.emit&&d.reason==='unchanged','identical next frame is free')
check(d.nextState===state,'suppressed frame does not churn filter state')

const moved=nearbyPlaceObservation({npcId:'hana',targetRef:'place:cafe',placeName:'Café',kind:'cafe',distanceM:20,atTick:12})
d=filterPerception({state,observation:moved})
check(d.emit&&d.reason==='changed','meaningful observed value change emits')
state=d.nextState

d=filterPerception({state,observation:{...moved,observedAtTick:300}})
check(d.emit&&d.reason==='refreshed','stable observation may refresh after bounded horizon')

if(failures)throw new Error(String(failures)+' perception filter test(s) failed')
console.log('NPC perception change filter: tests passed; unchanged_frames_emitted=0; external_llm_calls=0; persistence_writes=0')
