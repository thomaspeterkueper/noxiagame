import type { PopulationEvent } from './types'

export interface ObservableKnowledge {
  personId:string
  subjectType:string
  subjectRef:string
  knowledgeType:string
  confidence:number
  learnedTick:number
  sourceEventId:string
  details:Record<string,unknown>
}

/**
 * Projects only facts an actor could directly observe from its own persisted event.
 * It never copies hidden world state, causes, hypotheses or another person's private knowledge.
 */
export function observableKnowledgeFromPopulationEvent(event:PopulationEvent):ObservableKnowledge[] {
  if(!event.actorPersonId || !event.id) return []
  if(event.eventType==='social_interaction' && event.relatedPersonId) return [{
    personId:event.actorPersonId, subjectType:'person', subjectRef:event.relatedPersonId,
    knowledgeType:'met_in_person', confidence:1, learnedTick:event.tick, sourceEventId:event.id,
    details:{locationId:event.locationId??null,tileEntityId:event.payload?.tileEntityId??null},
  }]
  if(event.eventType==='npc_local_visit_started' && event.subjectRef) return [{
    personId:event.actorPersonId, subjectType:'tile_entity', subjectRef:event.subjectRef,
    knowledgeType:'visited', confidence:1, learnedTick:event.tick, sourceEventId:event.id,
    details:{locationId:event.locationId??null,reason:event.payload?.reason??null},
  }]
  return []
}

export async function persistObservableKnowledge(supabase:any,event:PopulationEvent){
  const rows=observableKnowledgeFromPopulationEvent(event)
  for(const k of rows){
    const {error}=await supabase.from('person_knowledge').upsert({
      person_id:k.personId,subject_type:k.subjectType,subject_ref:k.subjectRef,
      knowledge_type:k.knowledgeType,confidence:k.confidence,learned_tick:k.learnedTick,
      source_event_id:k.sourceEventId,details:k.details,updated_at:new Date().toISOString(),
    },{onConflict:'person_id,subject_type,subject_ref,knowledge_type'})
    if(error) throw error
  }
  return rows.length
}
