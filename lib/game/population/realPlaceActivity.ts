// NOXIA-NPC-RELIGION-0001
// Minimal scheduled social life for real-world places.
//
// No second clock: windows are derived only from the authoritative simulation tick.
// Attendance never implies belief or religious identity.

type SupabaseLike = any

export type PlaceActivityKind = 'open_community' | 'service'

export interface PlaceActivityWindow {
  kind: PlaceActivityKind
  label: string
  startTick: number
  endTick: number
}

const DAY_TICKS = 24
const WEEK_TICKS = 168
const OPEN_PHASE = 18
const OPEN_DURATION = 2
const SERVICE_PHASE = 108
const SERVICE_DURATION = 2

function windowAt(tick:number, period:number, phase:number, duration:number, kind:PlaceActivityKind, label:string):PlaceActivityWindow|null{
  const base=Math.floor(tick/period)*period
  let start=base+phase
  if(start>tick) start-=period
  if(tick<start || tick>=start+duration) return null
  return {kind,label,startTick:start,endTick:start+duration}
}

export function stJohannesActivityWindows(tick:number):PlaceActivityWindow[]{
  return [
    windowAt(tick,DAY_TICKS,OPEN_PHASE,OPEN_DURATION,'open_community','Offene Gemeinde- und Gesprächszeit'),
    windowAt(tick,WEEK_TICKS,SERVICE_PHASE,SERVICE_DURATION,'service','Gottesdienst / Andacht'),
  ].filter((value):value is PlaceActivityWindow=>Boolean(value))
}

async function closeExpiredRegionVisits(supabase:SupabaseLike,tick:number){
  const {data,error}=await supabase
    .from('person_assignments')
    .select('id,person_id,ends_tick')
    .eq('assignment_type','temporary')
    .eq('is_active',true)
    .like('role_code','visit:real_place:%')
    .lte('ends_tick',tick)
  if(error)throw error
  if(!data?.length)return 0
  const ids=data.map((row:any)=>row.id)
  const {error:updateError}=await supabase.from('person_assignments').update({
    is_active:false,
    updated_at:new Date().toISOString(),
  }).in('id',ids)
  if(updateError)throw updateError
  return ids.length
}

async function ensureEvent(
  supabase:SupabaseLike,
  tick:number,
  hostPersonId:string,
  locationId:string,
  regionFeatureId:string,
  window:PlaceActivityWindow,
){
  const subjectRef=`region_feature:${regionFeatureId}:${window.kind}:${window.startTick}`
  const {data:existing,error:lookupError}=await supabase
    .from('population_events')
    .select('id')
    .eq('tick',window.startTick)
    .eq('event_type','place_activity_started')
    .eq('subject_ref',subjectRef)
    .limit(1)
  if(lookupError)throw lookupError
  if(existing?.length)return false
  const {error}=await supabase.from('population_events').insert({
    tick:window.startTick,
    event_type:'place_activity_started',
    actor_person_id:hostPersonId,
    location_id:locationId,
    subject_type:'region_feature',
    subject_ref:subjectRef,
    payload:{
      regionFeatureId,
      activityKind:window.kind,
      label:window.label,
      startsTick:window.startTick,
      endsTick:window.endTick,
      attendanceDoesNotImplyBelief:true,
    },
  })
  if(error)throw error
  return true
}

async function ensureVisitor(
  supabase:SupabaseLike,
  input:{
    personId:string
    locationId:string
    regionFeatureId:string
    hostPersonId:string
    window:PlaceActivityWindow
    tick:number
  },
){
  const {personId,locationId,regionFeatureId,hostPersonId,window,tick}=input
  const roleCode=`visit:real_place:${window.kind}`

  const {data:person,error:personError}=await supabase
    .from('people')
    .select('id,current_location_id,simulation_tier,activity_state,last_action')
    .eq('id',personId)
    .maybeSingle()
  if(personError)throw personError
  if(!person || person.simulation_tier!=='active' || person.current_location_id!==locationId)return false
  if(person.activity_state==='travelling' || (person.activity_state==='resting' && String(person.last_action??'').includes('sleep')))return false

  const {data:existing,error:existingError}=await supabase
    .from('person_assignments')
    .select('id,region_feature_id,role_code,starts_tick,ends_tick')
    .eq('person_id',personId)
    .eq('assignment_type','temporary')
    .eq('is_active',true)
    .order('created_at',{ascending:false})
    .limit(1)
  if(existingError)throw existingError

  const current=existing?.[0]
  if(current && current.region_feature_id===regionFeatureId && current.role_code===roleCode){
    const {error}=await supabase.from('people').update({
      activity_state:'socialising',
      last_action:`visit:${window.kind}`,
      last_decision_factors:{
        destinationRegionFeatureId:regionFeatureId,
        hostPersonId,
        activityKind:window.kind,
        attendanceDoesNotImplyBelief:true,
      },
      last_tick:tick,
      updated_at:new Date().toISOString(),
    }).eq('id',personId)
    if(error)throw error
    return false
  }
  if(current){
    const {error}=await supabase.from('person_assignments').update({
      is_active:false,
      ends_tick:tick,
      updated_at:new Date().toISOString(),
    }).eq('id',current.id)
    if(error)throw error
  }

  const {data:assignment,error:assignmentError}=await supabase.from('person_assignments').insert({
    person_id:personId,
    assignment_type:'temporary',
    location_id:locationId,
    tile_entity_id:null,
    region_feature_id:regionFeatureId,
    employer_actor_id:null,
    role_code:roleCode,
    starts_tick:tick,
    ends_tick:window.endTick,
    is_active:true,
  }).select('id').single()
  if(assignmentError)throw assignmentError

  const {error:updatePersonError}=await supabase.from('people').update({
    activity_state:'socialising',
    last_action:`visit:${window.kind}`,
    last_decision_factors:{
      destinationRegionFeatureId:regionFeatureId,
      hostPersonId,
      activityKind:window.kind,
      attendanceDoesNotImplyBelief:true,
    },
    last_tick:tick,
    updated_at:new Date().toISOString(),
  }).eq('id',personId)
  if(updatePersonError)throw updatePersonError

  const {error:eventError}=await supabase.from('population_events').insert({
    tick,
    event_type:'npc_real_place_visit_started',
    actor_person_id:personId,
    related_person_id:hostPersonId,
    location_id:locationId,
    subject_type:'region_feature',
    subject_ref:regionFeatureId,
    payload:{
      assignmentId:assignment.id,
      activityKind:window.kind,
      windowStartTick:window.startTick,
      windowEndTick:window.endTick,
      attendanceDoesNotImplyBelief:true,
    },
  })
  if(eventError)throw eventError
  return true
}

export async function runStJohannesSocialPlaceTick(supabase:SupabaseLike,tick:number){
  const result={closed:0,windows:0,events:0,visitors:0,skipped:false}
  result.closed=await closeExpiredRegionVisits(supabase,tick)
  const windows=stJohannesActivityWindows(tick)
  if(!windows.length)return result
  result.windows=windows.length

  const {data:host,error:hostError}=await supabase
    .from('people')
    .select('id,current_location_id')
    .eq('person_key','earth-sundern-st-johannes-priest-001')
    .maybeSingle()
  if(hostError)throw hostError
  if(!host){result.skipped=true;return result}

  const {data:work,error:workError}=await supabase
    .from('person_assignments')
    .select('region_feature_id')
    .eq('person_id',host.id)
    .eq('assignment_type','work')
    .eq('is_active',true)
    .not('region_feature_id','is',null)
    .limit(1)
  if(workError)throw workError
  const regionFeatureId=work?.[0]?.region_feature_id
  if(!regionFeatureId){result.skipped=true;return result}

  // Pilot attendance comes only from an already-established local relationship.
  // It is social provenance, not inferred religious identity.
  const {data:relations,error:relationError}=await supabase
    .from('person_relationships')
    .select('person_id,other_person_id,familiarity,trust,affinity')
    .or(`person_id.eq.${host.id},other_person_id.eq.${host.id}`)
    .gte('affinity',0.5)
  if(relationError)throw relationError
  const candidateIds=[...new Set((relations??[]).map((row:any)=>row.person_id===host.id?row.other_person_id:row.person_id))]
    .filter(Boolean)
    .sort()

  for(const window of windows){
    if(await ensureEvent(supabase,tick,host.id,host.current_location_id,regionFeatureId,window))result.events+=1
    // Keep the first pilot deliberately small. Future participation should grow
    // from actual relationships/place affinity, not random religious assignment.
    const visitorId=candidateIds[0]
    if(visitorId && await ensureVisitor(supabase,{
      personId:visitorId,
      locationId:host.current_location_id,
      regionFeatureId,
      hostPersonId:host.id,
      window,
      tick,
    })) result.visitors+=1
  }
  return result
}
