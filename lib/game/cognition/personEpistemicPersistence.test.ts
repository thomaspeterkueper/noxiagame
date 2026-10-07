import { reconstructNpcMemory } from './npcRelationalMemory'
import { nearbyPlaceObservation } from './npcObservationMemory'
import { epistemicTraceToObservation, observationToEpistemicTrace, reconstructMemoryStateFromEpistemicTraces } from './personEpistemicPersistence'

let failures=0
const check=(ok:boolean,label:string)=>{if(!ok){failures++;console.error('FAIL: '+label)}}
const observation=nearbyPlaceObservation({npcId:'hana',targetRef:'building:cafe',placeName:'Café',kind:'building',distanceM:8,atTick:44})
const row=observationToEpistemicTrace(observation)
const roundTrip=epistemicTraceToObservation(row)
check(roundTrip.observerId==='hana'&&roundTrip.subjectRef==='building:cafe','observation persistence round-trip')
check(roundTrip.source.id===observation.source.id,'source provenance round-trip')
const state=reconstructMemoryStateFromEpistemicTraces('hana',[row])
const view=reconstructNpcMemory({npcId:'hana',subjectRef:'building:cafe',attribute:'nearby_place',possibleValues:[observation.value,{name:'Werkstatt',kind:'building',distanceM:8}],memories:state.memories,traces:state.traces})
check(view.status==='determined','persisted observation reconstructs relational memory')
check(state.traces[0].sourceRef==='observation:'+observation.id,'relational trace retains persisted observation identity')
if(failures)throw new Error(String(failures)+' epistemic persistence test(s) failed')
console.log('Person epistemic persistence: tests passed')
