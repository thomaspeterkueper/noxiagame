import {advanceRegulation,neutralRegulation,regulationEffects,type RegulationInputs,type RegulationState} from './personRegulation'
export type ObservedExperience={id:string;tick:number;kind:'injury'|'threat'|'sleep'|'meal'|'support'|'rejection'|'isolation'|'meaningful_contact';intensity:number}
const channels:Record<ObservedExperience['kind'],keyof RegulationInputs>={injury:'injury',threat:'threat',sleep:'sleep',meal:'food',support:'support',rejection:'rejection',isolation:'isolation',meaningful_contact:'meaningfulContact'}
/** Pure event replay. Call with authoritative, deduplicated events in deterministic order. */
export function replayExperiences(initial:RegulationState,events:ObservedExperience[],endTick:number){
 let state=initial
 const seen=new Set<string>()
 for(const e of [...events].sort((a,b)=>a.tick-b.tick||a.id.localeCompare(b.id))){
  if(seen.has(e.id)||e.tick<state.updatedTick||e.tick>endTick)continue
  seen.add(e.id)
  const input:RegulationInputs={[channels[e.kind]]:e.intensity}
  state=advanceRegulation(state,e.tick,input)
 }
 return advanceRegulation(state,endTick)
}
export function compareSocialTrajectories(days=14){
 const end=days*24
 const events=(kind:ObservedExperience['kind'],intensity:number):ObservedExperience[]=>Array.from({length:days},(_,d)=>({id:kind+':'+d,tick:d*24+12,kind,intensity}))
 const isolated=replayExperiences(neutralRegulation(),events('isolation',.5),end)
 const connected=replayExperiences(neutralRegulation(),events('meaningful_contact',.5),end)
 return {isolated,connected,isolatedEffects:regulationEffects(isolated),connectedEffects:regulationEffects(connected)}
}
