import type { Observation } from './observation'
import { persistEpistemicObservations } from './personEpistemicPersistence'

export interface InteriorPresenceRow {
  person_id:string
  tile_entity_id:string
  template_id:string
  room_id:string
  updated_tick:number
}

export function interiorPresenceObservations(rows:InteriorPresenceRow[],tick:number):Observation[]{
  const sorted=[...rows].sort((a,b)=>a.person_id.localeCompare(b.person_id))
  const observations:Observation[]=[]
  for(const self of sorted){
    observations.push({
      id:'interior:'+self.person_id+':location:'+self.tile_entity_id+':'+self.room_id+':'+tick,
      observerId:self.person_id,
      subjectRef:'building:'+self.tile_entity_id,
      attribute:'current_room',
      value:{templateId:self.template_id,roomId:self.room_id},
      source:{id:'person-interior-presence',type:'system_record',provenanceRefs:['person_interior_presence:'+self.person_id]},
      modality:'system_record',
      observedAtTick:tick,
      confidence:1,
      salience:.55,
    })
    for(const other of sorted){
      if(other.person_id===self.person_id)continue
      if(other.tile_entity_id!==self.tile_entity_id||other.room_id!==self.room_id)continue
      observations.push({
        id:'interior:'+self.person_id+':co-present:'+other.person_id+':'+self.tile_entity_id+':'+self.room_id+':'+tick,
        observerId:self.person_id,
        subjectRef:'person:'+other.person_id,
        attribute:'co_present',
        value:{buildingId:self.tile_entity_id,roomId:self.room_id},
        source:{id:'person-interior-presence',type:'system_record',provenanceRefs:['person_interior_presence:'+self.person_id,'person_interior_presence:'+other.person_id]},
        modality:'system_record',
        observedAtTick:tick,
        confidence:1,
        salience:.65,
      })
    }
  }
  return observations
}

// Authoritative runtime hook. We only persist changed presence rows from the
// current projection tick; stable occupancy therefore creates no repeated writes.
export async function persistInteriorPerception(supabase:any,tick:number,rows:InteriorPresenceRow[]){
  const changed=rows.filter(row=>Number(row.updated_tick)===tick)
  return persistEpistemicObservations(supabase,interiorPresenceObservations(changed,tick))
}
