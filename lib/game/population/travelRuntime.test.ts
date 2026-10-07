import { runTravelTick } from './travelRuntime'
let failures=0;const check=(x:boolean,l:string)=>{if(!x){failures++;console.error('FAIL: '+l)}}
const writes:any[]=[]
const travel={person_id:'hana',location_id:'earth',from_tile_entity_id:'home',to_tile_entity_id:'cafe',route:[{row:0,col:0},{row:0,col:1},{row:0,col:2}],progress:.5,status:'active',started_tick:1,updated_tick:1}
const supabase:any={from:(name:string)=>({
 select:()=>({eq:async()=>({data:name==='person_travel_state'?[travel]:[],error:null})}),
 update:(value:any)=>({eq:async()=>{writes.push([name,'update',value]);return {error:null}}}),
 upsert:async(value:any)=>{writes.push([name,'upsert',value]);return {error:null}},
})}
const r=await runTravelTick(supabase,2,.25)
check(r.advanced===1,'active travel advances')
const p=writes.find(x=>x[0]==='person_surface_presence')?.[2]
check(p?.source_kind==='street_route'&&p.x_m===1.5&&p.y_m===0,'travel position becomes authoritative surface presence')
if(failures)throw new Error(String(failures)+' travel runtime test(s) failed');console.log('Authoritative travel runtime: tests passed')
