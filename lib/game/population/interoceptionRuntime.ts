import { deriveRegulationState } from '../cognition/personInteroception'

type SB=any
const EPS=.015

function changed(old:any,next:any){
  if(!old)return true
  return Math.abs(Number(old.stress_axis)-next.stressAxis)>=EPS
    || Math.abs(Number(old.social_bonding_tone)-next.socialBondingTone)>=EPS
    || Math.abs(Number(old.reward_drive)-next.rewardDrive)>=EPS
    || Math.abs(Number(old.arousal)-next.arousal)>=EPS
}

export async function runInteroceptionTick(supabase:SB,tick:number){
  const {data:people,error:peopleError}=await supabase
    .from('people').select('id,simulation_tier').in('simulation_tier',['active','background'])
  if(peopleError)throw peopleError
  const ids=(people??[]).map((p:any)=>p.id)
  if(!ids.length)return {considered:0,updated:0}

  const [needsRes,affectRes,relationsRes,existingRes]=await Promise.all([
    supabase.from('person_needs').select('person_id,need_code,satisfaction').in('person_id',ids),
    supabase.from('person_affect').select('person_id,joy,fear,anger,sadness,mood,pain').in('person_id',ids),
    supabase.from('person_relationships').select('person_id,trust,affinity,familiarity,recent_encounter_score').in('person_id',ids),
    supabase.from('person_regulation_state').select('*').in('person_id',ids),
  ])
  for(const result of [needsRes,affectRes,relationsRes,existingRes])if(result.error)throw result.error

  const needs=new Map<string,Record<string,number>>()
  for(const row of needsRes.data??[]){
    const map=needs.get(row.person_id)??{}
    map[row.need_code]=Number(row.satisfaction)
    needs.set(row.person_id,map)
  }
  const affect=new Map((affectRes.data??[]).map((r:any)=>[r.person_id,r]))
  const relationships=new Map<string,any[]>()
  for(const row of relationsRes.data??[]){
    const list=relationships.get(row.person_id)??[]
    list.push(row);relationships.set(row.person_id,list)
  }
  const existing=new Map((existingRes.data??[]).map((r:any)=>[r.person_id,r]))
  const writes:any[]=[]

  for(const person of people??[]){
    const strongest=(relationships.get(person.id)??[])
      .map(row=>({...row,score:Number(row.trust)*.3+Number(row.affinity)*.3+Number(row.familiarity)*.2+Number(row.recent_encounter_score??0)*.2}))
      .sort((a,b)=>b.score-a.score)[0]??null
    const a:any=affect.get(person.id)??null
    const state=deriveRegulationState({
      affect:a?{joy:Number(a.joy),fear:Number(a.fear),anger:Number(a.anger),sadness:Number(a.sadness),mood:Number(a.mood),pain:Number(a.pain)}:null,
      needs:needs.get(person.id),
      strongestBond:strongest?{
        trust:Number(strongest.trust),affinity:Number(strongest.affinity),
        familiarity:Number(strongest.familiarity),recent:Number(strongest.recent_encounter_score??0),
      }:null,
    })
    if(!changed(existing.get(person.id),state))continue
    writes.push({
      person_id:person.id,
      stress_axis:state.stressAxis,
      social_bonding_tone:state.socialBondingTone,
      reward_drive:state.rewardDrive,
      arousal:state.arousal,
      updated_tick:tick,
      updated_at:new Date().toISOString(),
    })
  }
  if(writes.length){
    const {error}=await supabase.from('person_regulation_state').upsert(writes,{onConflict:'person_id'})
    if(error)throw error
  }
  return {considered:ids.length,updated:writes.length}
}
