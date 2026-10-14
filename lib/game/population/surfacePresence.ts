import { resolvedPresenceCandidates } from './presence'
import type { Person, PersonAssignment } from './types'

type SupabaseLike=any

export interface SurfacePresenceProjectionResult {projected:number;updated:number;cleared:number}

function dbPerson(row:any):Person{
  return {id:row.id,displayName:row.display_name??row.id,birthYear:row.birth_year??null,currentLocationId:row.current_location_id,simulationTier:row.simulation_tier,activityState:row.activity_state,lastAction:row.last_action??null,lastDecisionFactors:row.last_decision_factors??{},lastTick:row.last_tick??null}
}
function dbAssignment(row:any):PersonAssignment{
  return {id:row.id,personId:row.person_id,assignmentType:row.assignment_type,locationId:row.location_id,tileEntityId:row.tile_entity_id??null,regionFeatureId:row.region_feature_id??null,employerActorId:row.employer_actor_id??null,roleCode:row.role_code??null,startsTick:row.starts_tick??null,endsTick:row.ends_tick??null,isActive:Boolean(row.is_active)}
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
function regionFeaturePosition(geometry:any):{lat:number;lon:number}|null{
  if(!geometry||typeof geometry!=='object')return null
  if(geometry.kind==='point'){
    const lat=Number(geometry.coordinates?.lat)
    const lon=Number(geometry.coordinates?.lon)
    return Number.isFinite(lat)&&Number.isFinite(lon)?{lat,lon}:null
  }
  if(geometry.kind==='polygon'&&Array.isArray(geometry.coordinates)){
    const points=geometry.coordinates
      .map((point:any)=>({lat:Number(point?.lat),lon:Number(point?.lon)}))
      .filter((point:any)=>Number.isFinite(point.lat)&&Number.isFinite(point.lon))
    if(!points.length)return null
    return {
      lat:points.reduce((sum:number,point:any)=>sum+point.lat,0)/points.length,
      lon:points.reduce((sum:number,point:any)=>sum+point.lon,0)/points.length,
    }
  }
  return null
}

function activeRegionFeatureWork(person:Person,assignments:readonly PersonAssignment[]):PersonAssignment|null{
  if(person.activityState!=='working'&&person.activityState!=='inspecting')return null
  return assignments
    .filter(assignment=>
      assignment.personId===person.id
      && assignment.isActive
      && assignment.assignmentType==='work'
      && assignment.locationId===person.currentLocationId
      && Boolean(assignment.regionFeatureId)
    )
    .sort((a,b)=>a.id.localeCompare(b.id))[0]??null
}

export async function projectSurfacePresence(supabase:SupabaseLike,tick:number,peopleRows:any[],assignmentRows:any[]):Promise<SurfacePresenceProjectionResult>{
  const people=peopleRows.map(dbPerson)
  const assignments=assignmentRows.map(dbAssignment)
  const candidates=resolvedPresenceCandidates(people,assignments)

  const regionAssignmentByPerson=new Map<string,PersonAssignment>()
  for(const person of people){
    const assignment=activeRegionFeatureWork(person,assignments)
    if(assignment)regionAssignmentByPerson.set(person.id,assignment)
  }
  const regionFeatureIds=[...new Set([...regionAssignmentByPerson.values()].map(a=>a.regionFeatureId).filter((id):id is string=>Boolean(id)))]
  const {data:regionFeatures,error:regionFeatureError}=regionFeatureIds.length
    ? await supabase.from('region_features').select('id, region_id, geometry').in('id',regionFeatureIds)
    : {data:[],error:null}
  if(regionFeatureError)throw regionFeatureError
  const featureById=new Map((regionFeatures??[]).map((row:any)=>[row.id,row]))
  const regionIds=[...new Set((regionFeatures??[]).map((row:any)=>row.region_id).filter(Boolean))]
  const {data:regions,error:regionError}=regionIds.length
    ? await supabase.from('celestial_regions').select('id, slug').in('id',regionIds)
    : {data:[],error:null}
  if(regionError)throw regionError
  const regionSlugById=new Map((regions??[]).map((row:any)=>[row.id,row.slug]))

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

  const {data:activeTravel,error:travelError}=ids.length
    ? await supabase.from('person_travel_state').select('person_id').in('person_id',ids).eq('status','active')
    : {data:[],error:null}
  if(travelError)throw travelError
  const travelling=new Set<string>((activeTravel??[]).map((row:any):string=>String(row.person_id)))
  const keep=new Set<string>(travelling)
  const upserts:any[]=[]

  // A real imported region feature is an authoritative coarse work anchor.
  // It outranks a lower-priority home building while the person is working.
  for(const person of people){
    if(travelling.has(person.id))continue
    const assignment=regionAssignmentByPerson.get(person.id)
    if(!assignment?.regionFeatureId)continue
    const feature:any=featureById.get(assignment.regionFeatureId)
    const position=regionFeaturePosition(feature?.geometry)
    if(!feature||!position)continue
    keep.add(person.id)
    const next={
      person_id:person.id,
      location_id:person.currentLocationId,
      source_kind:'region_feature_anchor',
      source_ref:'region_feature:'+assignment.regionFeatureId,
      x_m:null,y_m:null,
      latitude_deg:position.lat,longitude_deg:position.lon,altitude_m:null,
      spatial_region_id:regionSlugById.get(feature.region_id)??null,
      confidence:.9,
      updated_tick:tick,
      updated_at:new Date().toISOString(),
    }
    if(changed(existingByPerson.get(person.id),next))upserts.push(next)
  }

  for(const candidate of candidates){
    if(travelling.has(candidate.person.id))continue
    if(regionAssignmentByPerson.has(candidate.person.id))continue
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
