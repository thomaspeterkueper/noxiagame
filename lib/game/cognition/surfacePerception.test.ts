import { surfaceCoPresenceObservations } from './surfacePerception'
let failures=0
const check=(ok:boolean,label:string)=>{if(!ok){failures++;console.error('FAIL: '+label)}}
const rows:any[]=[
 {person_id:'hana',location_id:'earth',x_m:0,y_m:0,spatial_region_id:'town',source_ref:'tile:a',confidence:.9,updated_tick:1},
 {person_id:'lan',location_id:'earth',x_m:12,y_m:0,spatial_region_id:'town',source_ref:'tile:b',confidence:.9,updated_tick:1},
 {person_id:'tiri',location_id:'earth',x_m:12,y_m:0,spatial_region_id:'other',source_ref:'tile:c',confidence:.9,updated_tick:1},
]
const obs=surfaceCoPresenceObservations(rows,5)
check(obs.length===2,'nearby compatible pair yields two subjective observations')
check(obs.some(o=>o.observerId==='hana'&&o.subjectRef==='person:lan'),'Hana sees Lan')
check(!obs.some(o=>o.subjectRef==='person:tiri'),'different spatial region never uses incompatible metres')
if(failures)throw new Error(String(failures)+' surface perception test(s) failed')
console.log('Authoritative surface perception: tests passed')
