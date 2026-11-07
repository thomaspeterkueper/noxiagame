import type {PopulationEvent,PersonRelationship} from '../population/types'
import type {ObservedExperience} from './personRegulationExperiment'
const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0))
/** An encounter is only evidence of proximity; meaningful connection requires relationship context. */
export function socialExperiencesFromEvents(events:readonly PopulationEvent[],relationships:readonly PersonRelationship[]):Map<string,ObservedExperience[]>{
 const relation=new Map(relationships.map(r=>[r.personId+'|'+r.otherPersonId,r]))
 const out=new Map<string,ObservedExperience[]>()
 const seen=new Set<string>()
 for(const e of [...events].sort((a,b)=>a.tick-b.tick||a.id.localeCompare(b.id))){
  if(!e.actorPersonId||seen.has(e.id))continue
  seen.add(e.id)
  let kind:ObservedExperience['kind']|null=null,intensity=0
  if(e.eventType==='social_interaction'&&e.relatedPersonId){
   const r=relation.get(e.actorPersonId+'|'+e.relatedPersonId)
   if(!r)continue
   const quality=clamp(.4*r.trust+.35*r.affinity+.25*r.familiarity)
   if(quality>=.6){kind='meaningful_contact';intensity=quality*.4}
  }else if(e.eventType==='social_support'){kind='support';intensity=clamp(Number(e.payload.intensity??.5))}
  else if(e.eventType==='social_rejection'){kind='rejection';intensity=clamp(Number(e.payload.intensity??.5))}
  if(!kind)continue
  const items=out.get(e.actorPersonId)??[]
  items.push({id:e.id,tick:e.tick,kind,intensity})
  out.set(e.actorPersonId,items)
 }
 return out
}
