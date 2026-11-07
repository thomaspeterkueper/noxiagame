import type {PopulationEvent,PersonRelationship} from '../population/types'
import {socialExperiencesFromEvents} from './personSocialRegulation'
import {replayExperiences} from './personRegulationExperiment'
import {neutralRegulation,regulationEffects,type RegulationState} from './personRegulation'
/** Read-only shadow projection: no synthetic loneliness from mere absence of encounters. */
export function projectObservedSocialRegulation(input:{
 personIds:readonly string[];events:readonly PopulationEvent[];relationships:readonly PersonRelationship[];
 fromTick:number;toTick:number;initial?:ReadonlyMap<string,RegulationState>
}){
 const mapped=socialExperiencesFromEvents(input.events,input.relationships)
 const output=new Map<string,{state:RegulationState;effects:ReturnType<typeof regulationEffects>;observedEvents:number}>()
 for(const id of input.personIds){
  const start=input.initial?.get(id)??neutralRegulation(input.fromTick)
  const experiences=(mapped.get(id)??[]).filter(e=>e.tick>=input.fromTick&&e.tick<=input.toTick)
  const state=replayExperiences(start,experiences,input.toTick)
  output.set(id,{state,effects:regulationEffects(state),observedEvents:experiences.length})
 }
 return output
}
