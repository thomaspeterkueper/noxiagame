import type { Observation } from './observation'
import type { NpcMemoryState } from './npcRelationalMemory'
import { rememberObservation } from './npcObservationMemory'

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
