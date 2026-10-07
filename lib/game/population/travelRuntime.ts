import { advanceTravel, travelStreetPoint, type PersonTravelState } from './travelState'

export interface TravelTickResult {active:number;advanced:number;arrived:number;errors:string[]}

function rowToState(row:any):PersonTravelState{
 return {personId:row.person_id,locationId:row.location_id,fromTileEntityId:row.from_tile_entity_id,toTileEntityId:row.to_tile_entity_id,route:Array.isArray(row.route)?row.route:[],progress:Number(row.progress),status:row.status,startedTick:Number(row.started_tick),updatedTick:Number(row.updated_tick)}
}

export async function runTravelTick(supabase:any,tick:number,step=.08):Promise<TravelTickResult>{
 const result:TravelTickResult={active:0,advanced:0,arrived:0,errors:[]}
 const {data,error}=await supabase.from('person_travel_state').select('*').eq('status','active')
 if(error)return {...result,errors:[error.message??String(error)]}
 result.active=(data??[]).length
 for(const row of data??[]){
  try{
   const next=advanceTravel(rowToState(row),tick,step)
   const point=travelStreetPoint(next)
   if(!point){result.errors.push(`${row.person_id}: route has no position`);continue}
   const {error:travelError}=await supabase.from('person_travel_state').update({progress:next.progress,status:next.status,updated_tick:tick,arrived_tick:next.status==='arrived'?tick:null,updated_at:new Date().toISOString()}).eq('person_id',row.person_id)
   if(travelError){result.errors.push(`${row.person_id}: ${travelError.message??travelError}`);continue}
   const {error:presenceError}=await supabase.from('person_surface_presence').upsert({
    person_id:row.person_id,location_id:row.location_id,source_kind:'street_route',source_ref:'person_travel_state:'+row.person_id,
    x_m:Number(point.col),y_m:Number(point.row),latitude_deg:null,longitude_deg:null,altitude_m:null,
    spatial_region_id:'grid:'+row.location_id,confidence:1,updated_tick:tick,updated_at:new Date().toISOString(),
   },{onConflict:'person_id'})
   if(presenceError){result.errors.push(`${row.person_id}: presence ${presenceError.message??presenceError}`);continue}
   result.advanced++
   if(next.status==='arrived'){
    await supabase.from('people').update({activity_state:'idle',last_action:'arrive_destination',last_tick:tick,updated_at:new Date().toISOString()}).eq('id',row.person_id)
    result.arrived++
   }
  }catch(e:any){result.errors.push(`${row.person_id}: ${e?.message??String(e)}`)}
 }
 return result
}
