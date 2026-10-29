// NOXIA-NPC-RELIGION-0001
// Minimal scheduled social life for real-world places.
//
// No second clock: windows are derived only from the authoritative simulation tick.
// Attendance never implies belief or religious identity.

import { lastSlotStart, nextSlotHour, pickCongregation, scheduledWindowsFor, slotWindowAt, type ActivitySlot, type ScheduledRow, type Tradition } from './worship'
import { clockTick, tickOfClock } from '../gameClock'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
 * Spielwoche (NOXIA-NPC-RELIGION-0001, 28.10.2026): Tag = floor(t / 24) mod 7,
 * Tag 0 ist Montag; Stunde = t mod 24. Seit 29.10.2026 ist t der Uhr-Tick
 * (clockTick, lib/game/gameClock.ts): Uhrzeit und Wochentag in Deutschland.
 * Die Wochenpläne unten bekommen den Uhr-Tick; hostWindowsAt rechnet zurück.
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

export interface RealPlaceHost { personKey:string; windows:(tick:number)=>PlaceActivityWindow[]; place:HostPlace; tradition:Tradition }

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
  { personKey:'earth-sundern-st-johannes-priest-001', windows:stJohannesActivityWindows, place:{kind:'work'}, tradition:'catholic' },
  { personKey:'earth-sundern-omnizedent-001', windows:sundernResonanceRoundWindows, place:{kind:'work'}, tradition:'omnizedenz' },
  { personKey:'earth-frankfurt-omnizedent-001', windows:frankfurtResonanceRoundWindows, place:{kind:'work'}, tradition:'omnizedenz' },
  { personKey:'mars-tharsis-omnizedent-001', windows:tharsisResonanceRoundWindows, place:{kind:'built',buildingTypes:['resonance_place','omnizedenz_resonance_place']}, tradition:'omnizedenz' },
  { personKey:'earth-sundern-lukaskirche-pastor-001', windows:lukasActivityWindows, place:{kind:'work'}, tradition:'protestant' },
  { personKey:'earth-frankfurt-hamidiye-imam-001', windows:hamidiyeActivityWindows, place:{kind:'work'}, tradition:'muslim' },
  { personKey:'earth-frankfurt-baumweg-rabbi-001', windows:baumwegActivityWindows, place:{kind:'work'}, tradition:'jewish' },
  { personKey:'earth-dwarka-dwarkadhish-pujari-001', windows:dwarkadhishActivityWindows, place:{kind:'work'}, tradition:'hindu' },
  { personKey:'earth-frankfurt-foguangshan-monastic-001', windows:foGuangShanActivityWindows, place:{kind:'work'}, tradition:'buddhist' },
]

// ── Uhrzeit und Termine (29.10.2026) ───────────────────────────────────
// Die Wochenpläne oben rechnen in Uhr-Ticks (Stunde und Wochentag in Deutschland,
// lib/game/gameClock.ts). Hier werden sie für einen Simulations-Tick ausgewertet und
// zurück in Ticks gerechnet – zusammen mit wandernden Terminen und Sonderterminen.

/** Zeile aus place_activity_slots. */
export type SlotRow = { id:string; person_key:string; kind:string; label:string; hour:number; duration:number; earliest_hour:number; latest_end_hour:number; since_tick:number; evaluated_start:number|null; empty_streak:number; last_attendance:number|null; history:unknown; active:boolean }
export function slotFromRow(row:SlotRow):ActivitySlot{
  return { id:String(row.id), kind:row.kind as ActivitySlot['kind'], label:String(row.label), hour:Number(row.hour), duration:Math.max(1,Number(row.duration??2)), earliest:Number(row.earliest_hour??7), latestEnd:Number(row.latest_end_hour??22) }
}

/**
 * Alle Termine eines Gastgebers zu einem Tick, in Ticks: Wochenplan (deutsche Zeit),
 * wandernde Termine und Sondertermine. Ein wandernder Termin weicht dem Wochenplan.
 */
export function hostWindowsAt(spec:Pick<RealPlaceHost,'windows'>,tick:number,slots:readonly ActivitySlot[]=[],scheduled:readonly PlaceActivityWindow[]=[]):PlaceActivityWindow[]{
  const clock=clockTick(tick), shift=tick-clock
  const back=(window:PlaceActivityWindow)=>({...window,startTick:window.startTick+shift,endTick:window.endTick+shift})
  const fixed=spec.windows(clock).map(back)
  const wandering=fixed.length?[]:slots.flatMap(slot=>{ const window=slotWindowAt(slot,clock); return window?[back(window)]:[] })
  return [...fixed,...wandering,...scheduled.filter(window=>tick>=window.startTick&&tick<window.endTick)]
}

/** Wandernde Termine laden; fehlt die Tabelle noch, gibt es keine. */
export async function loadSlotRows(supabase:SupabaseLike):Promise<SlotRow[]>{
  const {data,error}=await supabase.from('place_activity_slots').select('*').eq('active',true)
  if(error){ if(String(error.code)==='42P01'||/does not exist|schema cache/i.test(String(error.message)))return []; throw error }
  return (data??[]) as SlotRow[]
}

/**
 * Nach einem Termin: Kam niemand (außer dem Gastgeber), rückt der Termin eine Stunde
 * weiter (nextSlotHour). Ausgewertet wird jeder Termin einmal, nur Termine seit der
 * letzten Verlegung (`since_tick`).
 */
async function adaptSlots(supabase:SupabaseLike,tick:number,hostId:string,rows:SlotRow[],spec:Pick<RealPlaceHost,'windows'>){
  const clock=clockTick(tick)
  for(const row of rows){
    const slot=slotFromRow(row)
    // Letzter abgeschlossener Termin: Beginn so, dass das Ende spätestens jetzt ist.
    const startClock=lastSlotStart(slot,clock-slot.duration)
    const start=tickOfClock(startClock)
    if(start<Number(row.since_tick)||Number(row.evaluated_start)===start)continue
    // Fiel der Termin wegen des Wochenplans aus (z. B. Sonntagsgottesdienst), zählt er nicht.
    if(spec.windows(startClock).length){
      const {error:skipError}=await supabase.from('place_activity_slots').update({evaluated_start:start,updated_at:new Date().toISOString()}).eq('id',row.id)
      if(skipError)throw skipError
      row.evaluated_start=start
      continue
    }
    const {data:visits,error}=await supabase.from('population_events').select('actor_person_id')
      .eq('event_type','npc_real_place_visit_started').eq('related_person_id',hostId)
      .eq('payload->>windowStartTick',String(start)).neq('actor_person_id',hostId)
    if(error)throw error
    const attendance=new Set(((visits??[]) as Array<{actor_person_id:string}>).map(visit=>visit.actor_person_id)).size
    const others=rows.filter(other=>other.id!==row.id).map(other=>Number(other.hour))
    const hour=attendance===0?nextSlotHour(slot,others):slot.hour
    const history=[...(Array.isArray(row.history)?row.history as unknown[]:[]),{startTick:start,hour:slot.hour,attendance}].slice(-30)
    const {error:updateError}=await supabase.from('place_activity_slots').update({
      hour, evaluated_start:start, last_attendance:attendance,
      empty_streak:attendance===0?Number(row.empty_streak??0)+1:0,
      since_tick:hour===slot.hour?row.since_tick:tick,
      history, updated_at:new Date().toISOString(),
    }).eq('id',row.id)
    if(updateError)throw updateError
    row.hour=hour; row.evaluated_start=start
  }
}

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
    /** Gastgeber(in): trägt den Termin (last_action `host:…`), statt ihn zu besuchen. */
    asHost?:boolean
    /** Besucher, die gerade arbeiten, kommen nicht (Gastgeber schon). */
    skipWorking?:boolean
  },
){
  const {personId,locationId,place,hostPersonId,window,tick}=input
  const action=`${input.asHost?'host':'visit'}:${window.kind}`
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
  if(input.skipWorking && person.activity_state==='working')return false

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
      last_action:action,
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
    last_action:action,
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

/** Ort als Koordinaten: Erde in Grad, Station/Kolonie in Metern (Kachel-Raster als Rückfall). */
type Coord = { lat?:number; lon?:number; x?:number; y?:number }
function coordDistanceM(a:Coord|null,b:Coord|null){
  if(!a||!b)return null
  if(a.lat!=null&&a.lon!=null&&b.lat!=null&&b.lon!=null){
    const k=Math.cos(((a.lat+b.lat)/2)*Math.PI/180)
    return Math.hypot((a.lat-b.lat)*111320,(a.lon-b.lon)*111320*k)
  }
  if(a.x!=null&&a.y!=null&&b.x!=null&&b.y!=null)return Math.hypot(a.x-b.x,a.y-b.y)
  return null
}
type TileRow={id:string;latitude_deg:number|null;longitude_deg:number|null;x_m:number|null;y_m:number|null;tile_row:number|null;tile_col:number|null}
type FeatureRow={id:string;geometry:{kind?:string;coordinates?:unknown}|null}
function tileCoord(row:TileRow|undefined):Coord|null{
  if(!row)return null
  if(row.latitude_deg!=null&&row.longitude_deg!=null)return {lat:Number(row.latitude_deg),lon:Number(row.longitude_deg)}
  if(row.x_m!=null&&row.y_m!=null)return {x:Number(row.x_m),y:Number(row.y_m)}
  // Ältere Gebäude ohne Meterlage: Kachel-Raster (20 m, Ursprung wie bei der Weltplatzierung).
  if(row.tile_row!=null&&row.tile_col!=null)return {x:-310+Number(row.tile_col)*20,y:230-Number(row.tile_row)*20}
  return null
}
function featureCoord(row:FeatureRow|undefined):Coord|null{
  const g=row?.geometry
  if(!g)return null
  const pts=g.kind==='polygon'&&Array.isArray(g.coordinates)
    ?(g.coordinates as Array<{lat?:unknown;lon?:unknown}>).map(p=>({lat:Number(p?.lat),lon:Number(p?.lon)})).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon))
    :g.kind==='point'?[{lat:Number((g.coordinates as {lat?:unknown})?.lat),lon:Number((g.coordinates as {lon?:unknown})?.lon)}].filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)):[]
  if(!pts.length)return null
  return {lat:pts.reduce((a,p)=>a+p.lat,0)/pts.length,lon:pts.reduce((a,p)=>a+p.lon,0)/pts.length}
}
async function coordsFor(supabase:SupabaseLike,tileIds:string[],featureIds:string[]){
  const [tiles,features]=await Promise.all([
    tileIds.length?supabase.from('tile_entities').select('id,latitude_deg,longitude_deg,x_m,y_m,tile_row,tile_col').in('id',tileIds):Promise.resolve({data:[]}),
    featureIds.length?supabase.from('region_features').select('id,geometry').in('id',featureIds):Promise.resolve({data:[]}),
  ])
  const out=new Map<string,Coord|null>()
  for(const row of (tiles.data??[]) as TileRow[])out.set('t:'+row.id,tileCoord(row))
  for(const row of (features.data??[]) as FeatureRow[])out.set('f:'+row.id,featureCoord(row))
  return out
}

/** Menschen eines Ortes mit Wohnung (für die Nachbarschaft eines Termins), einmal je Tick und Ort. */
type Resident={id:string;home:Coord|null}
async function residentsOf(supabase:SupabaseLike,locationId:string):Promise<Resident[]>{
  const {data:people,error}=await supabase.from('people').select('id').eq('current_location_id',locationId).eq('simulation_tier','active').limit(600)
  if(error)throw error
  const ids=((people??[]) as Array<{id:string}>).map(row=>String(row.id))
  if(!ids.length)return []
  const {data:homes,error:homeError}=await supabase.from('person_assignments').select('person_id,tile_entity_id,region_feature_id').in('person_id',ids).eq('assignment_type','home').eq('is_active',true)
  if(homeError)throw homeError
  const homeOf=new Map<string,string>()
  for(const row of (homes??[]) as Array<{person_id:string;tile_entity_id:string|null;region_feature_id:string|null}>){
    if(homeOf.has(String(row.person_id)))continue
    if(row.tile_entity_id)homeOf.set(String(row.person_id),'t:'+row.tile_entity_id)
    else if(row.region_feature_id)homeOf.set(String(row.person_id),'f:'+row.region_feature_id)
  }
  const refs=[...new Set(homeOf.values())]
  const coords=await coordsFor(supabase,refs.filter(r=>r.startsWith('t:')).map(r=>r.slice(2)),refs.filter(r=>r.startsWith('f:')).map(r=>r.slice(2)))
  return ids.map(id=>({id,home:coords.get(homeOf.get(id)??'')??null}))
}

/** Runs every scheduled real-place host. A missing or unavailable host only skips its own windows. */
export async function runRealPlaceSocialTick(supabase:SupabaseLike,tick:number){
  const result:RealPlaceTickResult={closed:0,windows:0,events:0,visitors:0,skipped:true}
  result.closed=await closeExpiredRegionVisits(supabase,tick)
  // Sondertermine (z. B. Probe-Gottesdienst): population_events `place_activity_scheduled`.
  const {data:scheduled,error:scheduledError}=await supabase
    .from('population_events')
    .select('payload')
    .eq('event_type','place_activity_scheduled')
    .lte('tick',tick)
    .gte('tick',tick-24*14)
  if(scheduledError)throw scheduledError
  const slotRows=await loadSlotRows(supabase)
  const residents=new Map<string,Promise<Resident[]>>()
  const residentsAt=(locationId:string)=>{ if(!residents.has(locationId))residents.set(locationId,residentsOf(supabase,locationId)); return residents.get(locationId)! }
  for(const host of REAL_PLACE_HOSTS){
    const extra=scheduledWindowsFor((scheduled??[]) as ScheduledRow[],host.personKey)
    const rows=slotRows.filter(row=>row.person_key===host.personKey)
    if(rows.length){
      const {data:hostRow}=await supabase.from('people').select('id').eq('person_key',host.personKey).maybeSingle()
      if(hostRow?.id)await adaptSlots(supabase,tick,String(hostRow.id),rows,host)
    }
    const part=await runHostPlaceTick(supabase,tick,host,hostWindowsAt(host,tick,rows.map(slotFromRow),extra),residentsAt)
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
  const part=await runHostPlaceTick(supabase,tick,REAL_PLACE_HOSTS[0],hostWindowsAt(REAL_PLACE_HOSTS[0],tick),(locationId)=>residentsOf(supabase,locationId))
  return {...part,closed}
}

export async function resolveHostPlace(supabase:SupabaseLike,host:{id:string;current_location_id:string},spec:HostPlace):Promise<Place|null>{
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

async function runHostPlaceTick(supabase:SupabaseLike,tick:number,spec:RealPlaceHost,windows:PlaceActivityWindow[],residentsAt:(locationId:string)=>Promise<Resident[]>){
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

  // Gemeinde (28.10.2026): enge Beziehungen der Gastgeberin/des Gastgebers und
  // ein Teil der Nachbarschaft – soziale Herkunft, keine zugeschriebene Religion.
  const {data:relations,error:relationError}=await supabase
    .from('person_relationships')
    .select('person_id,other_person_id,affinity')
    .or(`person_id.eq.${host.id},other_person_id.eq.${host.id}`)
    .gte('affinity',0.5)
  if(relationError)throw relationError
  const relationList=((relations??[]) as Array<{person_id:string;other_person_id:string;affinity:number}>)
    .map(row=>({id:String(row.person_id===host.id?row.other_person_id:row.person_id),affinity:Number(row.affinity??0)}))
    .filter(row=>row.id&&row.id!==host.id)
  const placeCoord=(await coordsFor(supabase,place.tileEntityId?[place.tileEntityId]:[],place.regionFeatureId?[place.regionFeatureId]:[])).get(place.tileEntityId?'t:'+place.tileEntityId:'f:'+place.regionFeatureId)??null
  const neighbours=(await residentsAt(host.current_location_id)).flatMap(resident=>{
    const distanceM=coordDistanceM(resident.home,placeCoord)
    return distanceM==null?[]:[{id:resident.id,distanceM}]
  })

  for(const window of windows){
    if(await ensureEvent(supabase,tick,host.id,host.current_location_id,place,window))result.events+=1
    // Wer den Termin trägt, ist für seine Dauer dort – auch wenn der Arbeitsplatz woanders ist.
    await ensureVisitor(supabase,{personId:host.id,locationId:host.current_location_id,place,hostPersonId:host.id,window,tick,asHost:true})
    const congregation=pickCongregation({kind:window.kind,windowStart:window.startTick,relations:relationList,neighbours,exclude:new Set([host.id])})
    for(const visitorId of congregation){
      if(await ensureVisitor(supabase,{personId:visitorId,locationId:host.current_location_id,place,hostPersonId:host.id,window,tick,skipWorking:true}))result.visitors+=1
    }
  }
  return result
}
