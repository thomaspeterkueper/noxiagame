import type { Observation } from './observation'
import type { NpcMemoryState } from './npcRelationalMemory'
import { rememberObservation } from './npcObservationMemory'
import { consolidateMemories } from '../personCognition'

export interface PersistedEpistemicTrace {
  id:string
  person_id:string
  subject_ref:string
  attribute:string
  value:unknown
  source_type:Observation['source']['type']
  source_ref:string
  modality:Observation['modality']
  provenance_refs:string[]
  confidence:number
  salience:number
  observed_tick:number
  trace_kind:'observation'
}

export function observationToEpistemicTrace(observation:Observation):PersistedEpistemicTrace{
  return {
    id:observation.id,
    person_id:observation.observerId,
    subject_ref:observation.subjectRef,
    attribute:observation.attribute,
    value:observation.value,
    source_type:observation.source.type,
    source_ref:observation.source.id,
    modality:observation.modality,
    provenance_refs:observation.source.provenanceRefs??[],
    confidence:observation.confidence,
    salience:observation.salience,
    observed_tick:observation.observedAtTick,
    trace_kind:'observation',
  }
}

export function epistemicTraceToObservation(row:PersistedEpistemicTrace):Observation{
  return {
    id:row.id,
    observerId:row.person_id,
    subjectRef:row.subject_ref,
    attribute:row.attribute,
    value:row.value,
    source:{id:row.source_ref,type:row.source_type,provenanceRefs:row.provenance_refs},
    modality:row.modality,
    observedAtTick:row.observed_tick,
    confidence:row.confidence,
    salience:row.salience,
  }
}

export async function persistEpistemicObservations(supabase:any,observations:Observation[]){
  if(!observations.length)return {written:0,error:null}
  const rows=observations.map(observationToEpistemicTrace)
  const {error}=await supabase.from('person_epistemic_traces').upsert(rows,{onConflict:'id',ignoreDuplicates:true})
  return {written:error?0:rows.length,error:error?.message??null}
}

export function reconstructMemoryStateFromEpistemicTraces(npcId:string,rows:PersistedEpistemicTrace[]):NpcMemoryState{
  let state:NpcMemoryState={npcId,clock:{},memories:[],traces:[]}
  for(const row of rows.filter(row=>row.person_id===npcId).sort((a,b)=>a.observed_tick-b.observed_tick||a.id.localeCompare(b.id))){
    state=rememberObservation(state,epistemicTraceToObservation(row)).state
  }
  return state
}

export interface SleepConsolidationRow {
  person_id:string
  trace_id:string
  retention:number
  replay_priority:number
  consolidated_tick:number
}

export function sleepConsolidationRows(input:{
  sleepingPersonIds:string[]
  traces:PersistedEpistemicTrace[]
  tick:number
}):SleepConsolidationRow[]{
  const sleeping=new Set(input.sleepingPersonIds)
  const byPerson=new Map<string,PersistedEpistemicTrace[]>()
  for(const trace of input.traces){
    if(!sleeping.has(trace.person_id))continue
    const rows=byPerson.get(trace.person_id)??[]
    rows.push(trace);byPerson.set(trace.person_id,rows)
  }
  const out:SleepConsolidationRow[]=[]
  for(const [personId,traces] of byPerson){
    const ranked=consolidateMemories(traces.map(trace=>({
      id:trace.id,salience:trace.salience,valence:0,tick:trace.observed_tick,
      summary:trace.subject_ref+'#'+trace.attribute,
    })),input.tick)
    for(const item of ranked)out.push({person_id:personId,trace_id:item.id,retention:item.retention,replay_priority:item.replayPriority,consolidated_tick:input.tick})
  }
  return out
}

export async function consolidateSleepingEpistemicTraces(supabase:any,input:{sleepingPersonIds:string[];tick:number;lookbackTicks?:number}){
  if(!input.sleepingPersonIds.length)return {considered:0,written:0,error:null}
  const since=Math.max(0,input.tick-Math.max(1,input.lookbackTicks??1440))
  const {data,error}=await supabase.from('person_epistemic_traces')
    .select('id,person_id,subject_ref,attribute,value,source_type,source_ref,modality,provenance_refs,confidence,salience,observed_tick,trace_kind')
    .in('person_id',input.sleepingPersonIds).gte('observed_tick',since).order('observed_tick',{ascending:false}).limit(512)
  if(error)return {considered:0,written:0,error:error.message??String(error)}
  const rows=sleepConsolidationRows({sleepingPersonIds:input.sleepingPersonIds,traces:(data??[]) as PersistedEpistemicTrace[],tick:input.tick})
  if(!rows.length)return {considered:0,written:0,error:null}
  const {error:writeError}=await supabase.from('person_epistemic_consolidation').upsert(rows,{onConflict:'person_id,trace_id'})
  return {considered:rows.length,written:writeError?0:rows.length,error:writeError?.message??null}
}
