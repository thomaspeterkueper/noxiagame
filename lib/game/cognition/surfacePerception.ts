import type { Observation } from './observation'
import { persistEpistemicObservations } from './personEpistemicPersistence'

export interface SurfacePresenceRow {
 person_id:string; location_id:string; x_m:number|null; y_m:number|null; spatial_region_id:string|null; source_ref:string; confidence:number; updated_tick:number
}
function dist(a:SurfacePresenceRow,b:SurfacePresenceRow){return Math.hypot(Number(a.x_m)-Number(b.x_m),Number(a.y_m)-Number(b.y_m))}
function band(m:number){return m<=10?'immediate':m<=25?'near':'visible'}

export function surfaceCoPresenceObservations(rows:SurfacePresenceRow[],tick:number,rangeM=45):Observation[]{
 const valid=rows.filter(r=>r.x_m!=null&&r.y_m!=null)
 const out:Observation[]=[]
 for(const self of valid){
  for(const other of valid){
   if(self.person_id===other.person_id||self.location_id!==other.location_id||self.spatial_region_id!==other.spatial_region_id)continue
   const distanceM=dist(self,other)
   if(distanceM>rangeM)continue
   out.push({
    id:'surface:'+self.person_id+':sees:'+other.person_id+':'+band(distanceM)+':'+tick,
    observerId:self.person_id,subjectRef:'person:'+other.person_id,attribute:'nearby_person',
    value:{distanceBand:band(distanceM),region:self.spatial_region_id},
    source:{id:'person-surface-presence',type:'system_record',provenanceRefs:[self.source_ref,other.source_ref]},
    modality:'system_record',observedAtTick:tick,
    confidence:Math.min(self.confidence,other.confidence,.9),salience:.55,spatialResolutionM:Math.max(2,distanceM*.1),
   })
  }
 }
 return out
}

export async function persistSurfacePerception(supabase:any,tick:number,rows:SurfacePresenceRow[]){
 // Re-evaluate the small active-presence set, but IDs are band/tick scoped and
 // persistence is invoked once per authoritative person tick.
 return persistEpistemicObservations(supabase,surfaceCoPresenceObservations(rows,tick))
}
