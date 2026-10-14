import { projectSurfacePresence } from './surfacePresence'

let failures=0
const check=(ok:boolean,label:string)=>{if(!ok){failures++;console.error('FAIL: '+label)}}

function mockSupabase(seed:Record<string,any[]>,writes:any[]){
  return {
    from:(name:string)=>{
      const filters:{key:string;values:any[]}[]=[]
      let eqFilter:{key:string;value:any}|null=null
      const rows=()=> (seed[name]??[]).filter((row:any)=>
        filters.every(f=>f.values.includes(row[f.key]))
        && (!eqFilter||row[eqFilter.key]===eqFilter.value)
      )
      const builder:any={
        select:()=>builder,
        in:(key:string,values:any[])=>{filters.push({key,values});return builder},
        eq:(key:string,value:any)=>{eqFilter={key,value};return Promise.resolve({data:rows(),error:null})},
        then:(resolve:any)=>resolve({data:rows(),error:null}),
        upsert:async(items:any[])=>{writes.push(...items);return {error:null}},
        delete:()=>({in:async()=>({error:null})}),
      }
      return builder
    },
  }
}

{
  const writes:any[]=[]
  const supabase:any=mockSupabase({
    tile_entities:[{id:'cafe',location_id:'earth',x_m:10,y_m:20,latitude_deg:50,longitude_deg:8,altitude_m:null,spatial_region_id:'earth-test'}],
    person_surface_presence:[],
    person_travel_state:[],
  },writes)
  const people=[{id:'hana',display_name:'Hana',birth_year:null,current_location_id:'earth',simulation_tier:'active',activity_state:'socialising',last_action:null,last_decision_factors:{},last_tick:1},{id:'lan',display_name:'Lan',birth_year:null,current_location_id:'earth',simulation_tier:'active',activity_state:'travelling',last_action:null,last_decision_factors:{},last_tick:1}]
  const assignments=[{id:'a',person_id:'hana',assignment_type:'temporary',location_id:'earth',tile_entity_id:'cafe',region_feature_id:null,is_active:true},{id:'b',person_id:'lan',assignment_type:'work',location_id:'earth',tile_entity_id:'cafe',region_feature_id:null,is_active:true}]
  const result=await projectSurfacePresence(supabase,12,people,assignments)
  check(result.projected===1&&result.updated===1,'only resolved non-travelling presence is projected')
  check(writes[0]?.source_ref==='tile_entity:cafe'&&writes[0]?.x_m===10,'building placement anchors surface presence')
  check(!writes.some(r=>r.person_id==='lan'),'travelling person receives no fabricated coordinate')
}

{
  const writes:any[]=[]
  const supabase:any=mockSupabase({
    tile_entities:[{id:'home',location_id:'earth',x_m:null,y_m:null,latitude_deg:51.33,longitude_deg:8.01,altitude_m:null,spatial_region_id:'earth-sundern'}],
    region_features:[{id:'church',region_id:'region-sundern',geometry:{kind:'point',coordinates:{lat:51.3287,lon:8.0042}}}],
    celestial_regions:[{id:'region-sundern',slug:'earth-place-sundern'}],
    person_surface_presence:[],
    person_travel_state:[],
  },writes)
  const people=[{id:'elias',display_name:'Elias',birth_year:null,current_location_id:'earth',simulation_tier:'active',activity_state:'working',last_action:'work',last_decision_factors:{},last_tick:12}]
  const assignments=[
    {id:'home-a',person_id:'elias',assignment_type:'home',location_id:'earth',tile_entity_id:'home',region_feature_id:null,is_active:true},
    {id:'work-a',person_id:'elias',assignment_type:'work',location_id:'earth',tile_entity_id:null,region_feature_id:'church',is_active:true},
  ]
  const result=await projectSurfacePresence(supabase,12,people,assignments)
  check(result.projected===1&&result.updated===1,'real-place work assignment is projected')
  check(writes[0]?.source_kind==='region_feature_anchor','real-place work outranks home building while working')
  check(writes[0]?.source_ref==='region_feature:church'&&writes[0]?.spatial_region_id==='earth-place-sundern','region feature keeps observed place provenance')
  check(Math.abs(writes[0]?.latitude_deg-51.3287)<0.000001,'observed feature coordinate anchors person')
}

if(failures)throw new Error(String(failures)+' surface presence test(s) failed')
console.log('Authoritative person surface presence: tests passed')
