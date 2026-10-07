import { interiorPresenceObservations } from './interiorPerception'

let failures=0
const check=(ok:boolean,label:string)=>{if(!ok){failures++;console.error('FAIL: '+label)}}
const rows=[
 {person_id:'hana',tile_entity_id:'cafe',template_id:'cafe-standard-v1',room_id:'guest-room',updated_tick:10},
 {person_id:'lan',tile_entity_id:'cafe',template_id:'cafe-standard-v1',room_id:'guest-room',updated_tick:10},
 {person_id:'tiri',tile_entity_id:'habitat',template_id:'habitat-standard-v1',room_id:'common',updated_tick:10},
]
const observations=interiorPresenceObservations(rows,10)
check(observations.filter(o=>o.attribute==='current_room').length===3,'each person observes own authoritative room presence')
check(observations.some(o=>o.observerId==='hana'&&o.subjectRef==='person:lan'&&o.attribute==='co_present'),'Hana observes Lan in same room')
check(observations.some(o=>o.observerId==='lan'&&o.subjectRef==='person:hana'),'co-presence is observer-relative in both directions')
check(!observations.some(o=>o.observerId==='hana'&&o.subjectRef==='person:tiri'),'different building is not perceived as co-present')
if(failures)throw new Error(String(failures)+' interior perception test(s) failed')
console.log('Authoritative interior perception: tests passed')
