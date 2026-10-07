import { reconstructNpcMemory } from './npcRelationalMemory'
import { nearbyPlaceObservation, rememberObservation } from './npcObservationMemory'

let failures=0
const check=(ok:boolean,label:string)=>{if(!ok){failures++;console.error('FAIL: '+label)}}

let state={npcId:'hana',clock:{},memories:[],traces:[]}
const cafe=nearbyPlaceObservation({npcId:'hana',targetRef:'place:cafe',placeName:'Café',kind:'cafe',distanceM:8,atTick:40})
const projected=rememberObservation(state,cafe)
check(projected.memory.subjectRef==='place:cafe','nearby place becomes subjective memory')
check(projected.state.traces[0].sourceRef==='observation:'+cafe.id,'observation provenance survives projection')
const view=reconstructNpcMemory({npcId:'hana',subjectRef:'place:cafe',attribute:'nearby_place',possibleValues:[cafe.value,{name:'Werkstatt',kind:'workshop',distanceM:8}],memories:projected.state.memories,traces:projected.state.traces})
check(view.status==='determined','NPC can reconstruct directly observed place')

let rejected=false
try{rememberObservation(projected.state,{...cafe,id:'obs:lan',observerId:'lan'})}catch{rejected=true}
check(rejected,'NPC cannot silently inherit another observer direct perception')

if(failures)throw new Error(String(failures)+' observation-memory bridge test(s) failed')
console.log('NPC observation-memory bridge: tests passed; external_llm_calls=0; persistence_writes=0')
