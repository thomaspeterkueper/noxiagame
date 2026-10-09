import { healthyBody, projectBody, type PersonBodyState } from '../cognition/personBody'

type SupabaseLike = any

/** Optional event-sourced body projection; never creates an injury without a causal event. */
export async function loadPersonBody(supabase:SupabaseLike,personId:string):Promise<PersonBodyState|null>{
  const {data,error}=await supabase.from('person_body').select('body').eq('person_id',personId).maybeSingle()
  if(error)return null
  return data?.body as PersonBodyState ?? healthyBody()
}

/** Persist a body snapshot after the authoritative event was recorded. */
export async function persistPersonBody(
  supabase:SupabaseLike,
  input:{personId:string;body:PersonBodyState;sourceEventId:string;tick:number},
):Promise<'applied'|'replayed'|'unavailable'>{
  try{
    const {data:existing,error:readError}=await supabase.from('person_body')
      .select('source_event_id,updated_tick').eq('person_id',input.personId).maybeSingle()
    if(readError)return 'unavailable'
    if(existing?.source_event_id===input.sourceEventId)return 'replayed'
    if(existing?.updated_tick!=null&&Number(existing.updated_tick)>input.tick)return 'unavailable'
    const projection=projectBody(input.body)
    const {error}=await supabase.from('person_body').upsert({
      person_id:input.personId,body:input.body,
      nociception:projection.interoception.nociception,
      systemic_distress:projection.interoception.systemicDistress,
      source_event_id:input.sourceEventId,updated_tick:input.tick,
      updated_at:new Date().toISOString(),
    },{onConflict:'person_id'})
    return error?'unavailable':'applied'
  }catch{return 'unavailable'}
}
