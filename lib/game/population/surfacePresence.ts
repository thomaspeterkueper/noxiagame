import { resolvedPresenceCandidates } from './presence'
import type { Person, PersonAssignment } from './types'

type SupabaseLike=any

export interface SurfacePresenceProjectionResult {projected:number;updated:number;cleared:number}

function dbPerson(row:any):Person{
  return {id:row.id,displayName:row.display_name??row.id,birthYear:row.birth_year??null,currentLocationId:row.current_location_id,simulationTier:row.simulation_tier,activityState:row.activity_state,lastAction:row.last_action??null,lastDecisionFactors:row.last_decision_factors??{},lastTick:row.last_tick??null}
}
function dbAssignment(row:any):PersonAssignment{
  return {id:row.id,personId:row.person_id,assignmentType:row.assignment_type,locationId:row.location_id,tileEntityId:row.tile_entity_id,employerActorId:row.employer_actor_id??null,roleCode:row.role_code??null,startsTick:row.starts_tick??null,endsTick:row.ends_tick??null,isActive:Boolean(row.is_active)}
}
function changed(existing:any,next:any){
  return !existing
    || existing.location_id!==next.location_id
    || existing.source_kind!==next.source_kind
    || existing.source_ref!==next.source_ref
    || existing.x_m!==next.x_m || existing.y_m!==next.y_m
    || existing.latitude_deg!==next.latitude_deg || existing.longitude_deg!==next.longitude_deg
    || existing.altitude_m!==next.altitude_m || existing.spatial_region_id!==next.spatial_region_id
}

export async function projectSurfacePresence(supabase:SupabaseLike,tick:number,peopleRows:any[],assignmentRows:any[]):Promise<SurfacePresenceProjectionResult>{
  const people=peopleRows.map(dbPerson)
  const assignments=assignmentRows.map(dbAssignment)
  const candidates=resolvedPresenceCandidates(people,assignments)
  const tileIds=[...new Set(candidates.map(c=>c.tileEntityId))]
  const {data:tiles,error:tileError}=tileIds.length
    ? await supabase.from('tile_entities').select('id, location_id, x_m, y_m, latitude_deg, longitude_deg, altitude_m, spatial_region_id').in('id',tileIds)
    : {data:[],error:null}
  if(tileError)throw tileError
  const tileById=new Map((tiles??[]).map((row:any)=>[row.id,row]))

  const ids=people.map(p=>p.id)
  const {data:existing,error:existingError}=ids.length
    ? await supabase.from('person_surface_presence').select('*').in('person_id',ids)
    : {data:[],error:null}
  if(existingError)throw existingError
  const existingByPerson=new Map((existing??[]).map((row:any)=>[row.person_id,row]))

  const keep=new Set<string>()
  const upserts:any[]=[]
  for(const candidate of candidates){
    const tile:any=tileById.get(candidate.tileEntityId)
    if(!tile)continue
    // A building anchor is coarse but authoritative enough for local discovery.
    // If neither metric nor geodetic placement exists, do not invent position.
    if(tile.x_m==null&&tile.latitude_deg==null)continue
    keep.add(candidate.person.id)
    const next={
      person_id:candidate.person.id,
      location_id:candidate.person.currentLocationId,
      source_kind:'building_anchor',
      source_ref:'tile_entity:'+candidate.tileEntityId,
      x_m:tile.x_m??null,y_m:tile.y_m??null,
      latitude_deg:tile.latitude_deg??null,longitude_deg:tile.longitude_deg??null,altitude_m:tile.altitude_m??null,
      spatial_region_id:tile.spatial_region_id??null,
      confidence:.9,
      updated_tick:tick,
      updated_at:new Date().toISOString(),
    }
    if(changed(existingByPerson.get(candidate.person.id),next))upserts.push(next)
  }

  const stale=(existing??[]).filter((row:any)=>!keep.has(row.person_id)).map((row:any)=>row.person_id)
  if(stale.length){
    const {error}=await supabase.from('person_surface_presence').delete().in('person_id',stale)
    if(error)throw error
  }
  if(upserts.length){
    const {error}=await supabase.from('person_surface_presence').upsert(upserts,{onConflict:'person_id'})
    if(error)throw error
  }
  return {projected:keep.size,updated:upserts.length,cleared:stale.length}
}
