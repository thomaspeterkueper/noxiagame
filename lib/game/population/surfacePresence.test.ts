import { projectSurfacePresence } from './surfacePresence'

let failures=0
const check=(ok:boolean,label:string)=>{if(!ok){failures++;console.error('FAIL: '+label)}}
const writes:any[]=[]
const tables:any={
 tile_entities:[{id:'cafe',location_id:'earth',x_m:10,y_m:20,latitude_deg:50,longitude_deg:8,altitude_m:null,spatial_region_id:'earth-test'}],
 person_surface_presence:[],
}
const supabase:any={from:(name:string)=>({
 select:()=>({in:async(_k:string,ids:string[])=>({data:(tables[name]??[]).filter((r:any)=>ids.includes(r.id??r.person_id)),error:null})}),
 upsert:async(rows:any[])=>{writes.push(...rows);return {error:null}},
 delete:()=>({in:async()=>({error:null})}),
})}
const people=[{id:'hana',display_name:'Hana',birth_year:null,current_location_id:'earth',simulation_tier:'active',activity_state:'socialising',last_action:null,last_decision_factors:{},last_tick:1},{id:'lan',display_name:'Lan',birth_year:null,current_location_id:'earth',simulation_tier:'active',activity_state:'travelling',last_action:null,last_decision_factors:{},last_tick:1}]
const assignments=[{id:'a',person_id:'hana',assignment_type:'temporary',location_id:'earth',tile_entity_id:'cafe',is_active:true},{id:'b',person_id:'lan',assignment_type:'work',location_id:'earth',tile_entity_id:'cafe',is_active:true}]
const result=await projectSurfacePresence(supabase,12,people,assignments)
check(result.projected===1&&result.updated===1,'only resolved non-travelling presence is projected')
check(writes[0]?.source_ref==='tile_entity:cafe'&&writes[0]?.x_m===10,'building placement anchors surface presence')
check(!writes.some(r=>r.person_id==='lan'),'travelling person receives no fabricated coordinate')
if(failures)throw new Error(String(failures)+' surface presence test(s) failed')
console.log('Authoritative person surface presence: tests passed')
