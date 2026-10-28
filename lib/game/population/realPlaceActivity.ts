// NOXIA-NPC-RELIGION-0001
// Minimal scheduled social life for real-world places.
//
// No second clock: windows are derived only from the authoritative simulation tick.
// Attendance never implies belief or religious identity.

type SupabaseLike = any

export type PlaceActivityKind =
  | 'open_community' | 'service' | 'resonance_round'
  | 'friday_prayer' | 'shabbat' | 'aarti' | 'dharma_service'

export interface PlaceActivityWindow {
  kind: PlaceActivityKind
  label: string
  startTick: number
  endTick: number
}

const DAY_TICKS = 24
const WEEK_TICKS = 168

/**
 * Spielwoche (NOXIA-NPC-RELIGION-0001, 28.10.2026): Tag = floor(tick / 24) mod 7,
 * Tag 0 ist Montag; Stunde = tick mod 24. Es gibt weiterhin nur die eine Uhr,
 * die Zählung legt nur fest, welcher Tag „Freitag“ oder „Sonntag“ heißt.
 */
export const WEEKDAY = { monday:0, tuesday:1, wednesday:2, thursday:3, friday:4, saturday:5, sunday:6 } as const
export function weekPhase(day:number, hour:number){ return day*DAY_TICKS+hour }
export function weekdayOfTick(tick:number){ return Math.floor(tick/DAY_TICKS)%7 }

const OPEN_PHASE = 18
const OPEN_DURATION = 2
// Sonntag, 10 Uhr (bis 28.10.2026: Phase 108 = Freitag 12 Uhr, unbeabsichtigt).
const SERVICE_PHASE = weekPhase(WEEKDAY.sunday, 10)
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

// NOXIA-NPC-RELIGION-0002: weekly open resonance round of the Omnizedenz,
// day 3 of the week, 19:00, two hours. Same tick, same mechanics as the church.
const RESONANCE_PHASE = 67
const RESONANCE_DURATION = 2

export function sundernResonanceRoundWindows(tick:number):PlaceActivityWindow[]{
  return [
    windowAt(tick,WEEK_TICKS,RESONANCE_PHASE,RESONANCE_DURATION,'resonance_round','Offene Resonanzrunde'),
  ].filter((value):value is PlaceActivityWindow=>Boolean(value))
}

// Frankfurt, CAMALEO-ArtLounge: Tag 5 der Woche, 19 Uhr, zwei Stunden.
const FRANKFURT_RESONANCE_PHASE = 115

export function frankfurtResonanceRoundWindows(tick:number):PlaceActivityWindow[]{
  return [
    windowAt(tick,WEEK_TICKS,FRANKFURT_RESONANCE_PHASE,RESONANCE_DURATION,'resonance_round','Offene Resonanzrunde in der ArtLounge'),
  ].filter((value):value is PlaceActivityWindow=>Boolean(value))
}

// Tharsis Hub: Tag 6 der Woche, 19 Uhr, zwei Stunden – sobald dort ein Resonanzplatz steht.
const THARSIS_RESONANCE_PHASE = 139

export function tharsisResonanceRoundWindows(tick:number):PlaceActivityWindow[]{
  return [
    windowAt(tick,WEEK_TICKS,THARSIS_RESONANCE_PHASE,RESONANCE_DURATION,'resonance_round','Offene Resonanzrunde am Resonanzplatz'),
  ].filter((value):value is PlaceActivityWindow=>Boolean(value))
}

/**
 * Where a host's activity takes place.
 * - `work`: the host's workplace – a real imported place (church, hall, lounge) or a
 *   bought and converted real house (tile entity).
 * - `built`: a built building of one of these types at the host's location
 *   (e.g. a resonance place on Mars). Without such a building the windows are skipped.
 */
export type HostPlace =
  | { kind:'work' }
  | { kind:'built'; buildingTypes:readonly string[] }

export interface RealPlaceHost { personKey:string; windows:(tick:number)=>PlaceActivityWindow[]; place:HostPlace }

// ── Vertreter weiterer Religionen (Thomas, 28.10.2026) ────────────────
/** Lukaskirche Sundern (evangelisch): Gottesdienst Sonntag 10 Uhr, offene Gesprächszeit Dienstag 18 Uhr. */
export function lukasActivityWindows(tick:number):PlaceActivityWindow[]{
  return [
    windowAt(tick,WEEK_TICKS,weekPhase(WEEKDAY.tuesday,18),2,'open_community','Offene Gesprächszeit im Gemeindezentrum'),
    windowAt(tick,WEEK_TICKS,SERVICE_PHASE,SERVICE_DURATION,'service','Gottesdienst'),
  ].filter((value):value is PlaceActivityWindow=>Boolean(value))
}
/** Hamidiye-Moschee Frankfurt: Freitagsgebet Freitag 13 Uhr. */
export function hamidiyeActivityWindows(tick:number):PlaceActivityWindow[]{
  return [
    windowAt(tick,WEEK_TICKS,weekPhase(WEEKDAY.friday,13),2,'friday_prayer','Freitagsgebet'),
  ].filter((value):value is PlaceActivityWindow=>Boolean(value))
}
/** Baumweg-Synagoge Frankfurt: Schabbat-Beginn Freitag 18 Uhr, Schabbat-Gottesdienst Samstag 10 Uhr. */
export function baumwegActivityWindows(tick:number):PlaceActivityWindow[]{
  return [
    windowAt(tick,WEEK_TICKS,weekPhase(WEEKDAY.friday,18),2,'shabbat','Gottesdienst zum Schabbatbeginn'),
    windowAt(tick,WEEK_TICKS,weekPhase(WEEKDAY.saturday,10),2,'shabbat','Schabbat-Gottesdienst'),
  ].filter((value):value is PlaceActivityWindow=>Boolean(value))
}
/** Dwarkadhish-Tempel Dvārakā: Aarti täglich 7 und 19 Uhr. */
export function dwarkadhishActivityWindows(tick:number):PlaceActivityWindow[]{
  return [
    windowAt(tick,DAY_TICKS,7,1,'aarti','Morgen-Aarti'),
    windowAt(tick,DAY_TICKS,19,1,'aarti','Abend-Aarti'),
  ].filter((value):value is PlaceActivityWindow=>Boolean(value))
}
/** Fo-Guang-Shan-Tempel Frankfurt: Andacht mit Dharma-Vortrag Sonntag 10 Uhr. */
export function foGuangShanActivityWindows(tick:number):PlaceActivityWindow[]{
  return [
    windowAt(tick,WEEK_TICKS,weekPhase(WEEKDAY.sunday,10),2,'dharma_service','Andacht und Dharma-Vortrag'),
  ].filter((value):value is PlaceActivityWindow=>Boolean(value))
}

/** Hosts whose real-place schedule the population tick carries. */
export const REAL_PLACE_HOSTS: ReadonlyArray<RealPlaceHost> = [
  { personKey:'earth-sundern-st-johannes-priest-001', windows:stJohannesActivityWindows, place:{kind:'work'} },
  { personKey:'earth-sundern-omnizedent-001', windows:sundernResonanceRoundWindows, place:{kind:'work'} },
  { personKey:'earth-frankfurt-omnizedent-001', windows:frankfurtResonanceRoundWindows, place:{kind:'work'} },
  { personKey:'mars-tharsis-omnizedent-001', windows:tharsisResonanceRoundWindows, place:{kind:'built',buildingTypes:['resonance_place','omnizedenz_resonance_place']} },
  { personKey:'earth-sundern-lukaskirche-pastor-001', windows:lukasActivityWindows, place:{kind:'work'} },
  { personKey:'earth-frankfurt-hamidiye-imam-001', windows:hamidiyeActivityWindows, place:{kind:'work'} },
  { personKey:'earth-frankfurt-baumweg-rabbi-001', windows:baumwegActivityWindows, place:{kind:'work'} },
  { personKey:'earth-dwarka-dwarkadhish-pujari-001', windows:dwarkadhishActivityWindows, place:{kind:'work'} },
  { personKey:'earth-frankfurt-foguangshan-monastic-001', windows:foGuangShanActivityWindows, place:{kind:'work'} },
]

/** A concrete place: an imported real place or a built tile entity. */
type Place = { regionFeatureId:string; tileEntityId:null } | { regionFeatureId:null; tileEntityId:string }
const placeRef=(place:Place)=>place.regionFeatureId?`region_feature:${place.regionFeatureId}`:`tile_entity:${place.tileEntityId}`
const placeSubjectType=(place:Place)=>place.regionFeatureId?'region_feature':'tile_entity'

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
  place:Place,
  window:PlaceActivityWindow,
){
  // Region-feature refs keep their original shape so existing events stay idempotent.
  const subjectRef=`${placeRef(place)}:${window.kind}:${window.startTick}`
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
    subject_type:placeSubjectType(place),
    subject_ref:subjectRef,
    payload:{
      regionFeatureId:place.regionFeatureId,
      tileEntityId:place.tileEntityId,
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
    place:Place
    hostPersonId:string
    window:PlaceActivityWindow
    tick:number
  },
){
  const {personId,locationId,place,hostPersonId,window,tick}=input
  const roleCode=`visit:real_place:${window.kind}`
  const decisionFactors={
    destinationRegionFeatureId:place.regionFeatureId,
    destinationTileEntityId:place.tileEntityId,
    hostPersonId,
    activityKind:window.kind,
    attendanceDoesNotImplyBelief:true,
  }

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
    .select('id,region_feature_id,tile_entity_id,role_code,starts_tick,ends_tick')
    .eq('person_id',personId)
    .eq('assignment_type','temporary')
    .eq('is_active',true)
    .order('created_at',{ascending:false})
    .limit(1)
  if(existingError)throw existingError

  const current=existing?.[0]
  const samePlace=current
    && (current.region_feature_id??null)===place.regionFeatureId
    && (current.tile_entity_id??null)===place.tileEntityId
  if(current && samePlace && current.role_code===roleCode){
    const {error}=await supabase.from('people').update({
      activity_state:'socialising',
      last_action:`visit:${window.kind}`,
      last_decision_factors:decisionFactors,
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
    tile_entity_id:place.tileEntityId,
    region_feature_id:place.regionFeatureId,
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
    last_decision_factors:decisionFactors,
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
    subject_type:placeSubjectType(place),
    subject_ref:place.regionFeatureId??place.tileEntityId,
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

type RealPlaceTickResult={closed:number,windows:number,events:number,visitors:number,skipped:boolean}

/** Runs every scheduled real-place host. A missing or unavailable host only skips its own windows. */
export async function runRealPlaceSocialTick(supabase:SupabaseLike,tick:number){
  const result:RealPlaceTickResult={closed:0,windows:0,events:0,visitors:0,skipped:true}
  result.closed=await closeExpiredRegionVisits(supabase,tick)
  for(const host of REAL_PLACE_HOSTS){
    const part=await runHostPlaceTick(supabase,tick,host,host.windows(tick))
    result.windows+=part.windows
    result.events+=part.events
    result.visitors+=part.visitors
    if(!part.skipped)result.skipped=false
  }
  return result
}

/** Kept for callers of the first pilot; closes expired visits and runs St. Johannes only. */
export async function runStJohannesSocialPlaceTick(supabase:SupabaseLike,tick:number){
  const closed=await closeExpiredRegionVisits(supabase,tick)
  const part=await runHostPlaceTick(supabase,tick,REAL_PLACE_HOSTS[0],stJohannesActivityWindows(tick))
  return {...part,closed}
}

async function resolveHostPlace(supabase:SupabaseLike,host:{id:string;current_location_id:string},spec:HostPlace):Promise<Place|null>{
  if(spec.kind==='work'){
    // Realer Ort (region_feature) oder ein gekauftes, umgebautes Haus (tile_entity),
    // z. B. die Omnizedenz-Begegnungsstätte Hauptstraße 87 in Sundern.
    const {data:work,error:workError}=await supabase
      .from('person_assignments')
      .select('region_feature_id,tile_entity_id')
      .eq('person_id',host.id)
      .eq('assignment_type','work')
      .eq('is_active',true)
      .limit(5)
    if(workError)throw workError
    const row=(work??[]).find((item:{tile_entity_id:string|null;region_feature_id:string|null})=>item.tile_entity_id||item.region_feature_id)
    if(!row)return null
    return row.tile_entity_id
      ?{regionFeatureId:null,tileEntityId:String(row.tile_entity_id)}
      :{regionFeatureId:String(row.region_feature_id),tileEntityId:null}
  }
  const {data:built,error:builtError}=await supabase
    .from('tile_entities')
    .select('id')
    .eq('location_id',host.current_location_id)
    .eq('status','active')
    .in('entity_id',[...spec.buildingTypes])
    .order('created_at',{ascending:true})
    .limit(1)
  if(builtError)throw builtError
  const id=built?.[0]?.id
  return id?{regionFeatureId:null,tileEntityId:String(id)}:null
}

async function runHostPlaceTick(supabase:SupabaseLike,tick:number,spec:RealPlaceHost,windows:PlaceActivityWindow[]){
  const result:RealPlaceTickResult={closed:0,windows:0,events:0,visitors:0,skipped:false}
  if(!windows.length)return result
  result.windows=windows.length

  const {data:host,error:hostError}=await supabase
    .from('people')
    .select('id,current_location_id,activity_state,last_action')
    .eq('person_key',spec.personKey)
    .maybeSingle()
  if(hostError)throw hostError
  if(!host){result.skipped=true;return result}
  if(host.activity_state==='travelling' || (host.activity_state==='resting' && String(host.last_action??'').includes('sleep'))){
    result.skipped=true
    return result
  }

  const place=await resolveHostPlace(supabase,host,spec.place)
  if(!place){result.skipped=true;return result}

  // Pilot attendance comes only from an already-established local relationship.
  // It is social provenance, not inferred religious identity.
  const {data:relations,error:relationError}=await supabase
    .from('person_relationships')
    .select('person_id,other_person_id,familiarity,trust,affinity')
    .or(`person_id.eq.${host.id},other_person_id.eq.${host.id}`)
    .gte('affinity',0.5)
  if(relationError)throw relationError
  const candidateIds:string[]=[...new Set<string>((relations??[])
    .map((row:any)=>String(row.person_id===host.id?row.other_person_id:row.person_id))
    .filter((value:string)=>Boolean(value)))]
    .sort()

  for(const window of windows){
    if(await ensureEvent(supabase,tick,host.id,host.current_location_id,place,window))result.events+=1
    // A host whose workplace is elsewhere (e.g. a technician hosting a round at a
    // built resonance place) goes there for the window, like any visitor.
    if(spec.place.kind==='built') await ensureVisitor(supabase,{personId:host.id,locationId:host.current_location_id,place,hostPersonId:host.id,window,tick})
    // Keep the first pilot deliberately small. Future participation should grow
    // from actual relationships/place affinity, not random religious assignment.
    const visitorId=candidateIds[0]
    if(visitorId && await ensureVisitor(supabase,{
      personId:visitorId,
      locationId:host.current_location_id,
      place,
      hostPersonId:host.id,
      window,
      tick,
    })) result.visitors+=1
  }
  return result
}
