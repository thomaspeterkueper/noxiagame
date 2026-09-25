// Resolves whether an epistemically useful experiment is actually executable.
// Pure planning boundary: no inventory/resource mutation and no authority grant.

import type { DiscriminatingResearchQuestion } from './hypothesisDiscrimination'
import type { ResearchCost } from './researchValue'

export interface ResearchCapabilityRequirement {
  capability: string
  minLevel?: number
  toolType?: string
}

export interface ResearchActorResources {
  personId: string
  capabilities: Record<string, number>
  availableToolTypes: string[]
  credits: number
  energy: number
  availableTimeTicks: number
}

export interface ExecutableResearchOption {
  question: DiscriminatingResearchQuestion
  cost: ResearchCost
  requirement: ResearchCapabilityRequirement
  executable: boolean
  blockers: Array<'capability'|'tool'|'credits'|'energy'|'time'>
}

export function resolveResearchExecutability(
  question:DiscriminatingResearchQuestion,
  cost:ResearchCost,
  requirement:ResearchCapabilityRequirement,
  actor:ResearchActorResources,
):ExecutableResearchOption {
  const blockers:ExecutableResearchOption['blockers']=[]
  if((actor.capabilities[requirement.capability]??0)<(requirement.minLevel??1)) blockers.push('capability')
  if(requirement.toolType&&!actor.availableToolTypes.includes(requirement.toolType)) blockers.push('tool')
  if(actor.credits<cost.credits) blockers.push('credits')
  if(actor.energy<cost.energy) blockers.push('energy')
  if(actor.availableTimeTicks<cost.timeTicks) blockers.push('time')
  return {question,cost,requirement,executable:blockers.length===0,blockers}
}

export type ResearchAcquisitionIntent =
 | {kind:'acquire_tool';personId:string;toolType:string;reason:'research_blocker'}
 | {kind:'gain_capability';personId:string;capability:string;minLevel:number;reason:'research_blocker'}
 | {kind:'secure_resources';personId:string;resource:'credits'|'energy'|'time';amount:number;reason:'research_blocker'}

export function acquisitionIntentsForResearch(option:ExecutableResearchOption, actor:ResearchActorResources):ResearchAcquisitionIntent[]{
  const out:ResearchAcquisitionIntent[]=[]
  for(const b of option.blockers){
    if(b==='tool'&&option.requirement.toolType) out.push({kind:'acquire_tool',personId:actor.personId,toolType:option.requirement.toolType,reason:'research_blocker'})
    else if(b==='capability') out.push({kind:'gain_capability',personId:actor.personId,capability:option.requirement.capability,minLevel:option.requirement.minLevel??1,reason:'research_blocker'})
    else if(b==='credits') out.push({kind:'secure_resources',personId:actor.personId,resource:'credits',amount:Math.max(0,option.cost.credits-actor.credits),reason:'research_blocker'})
    else if(b==='energy') out.push({kind:'secure_resources',personId:actor.personId,resource:'energy',amount:Math.max(0,option.cost.energy-actor.energy),reason:'research_blocker'})
    else if(b==='time') out.push({kind:'secure_resources',personId:actor.personId,resource:'time',amount:Math.max(0,option.cost.timeTicks-actor.availableTimeTicks),reason:'research_blocker'})
  }
  return out
}


import type { PopulationActionIntent } from './actionIntent'
/** Projects epistemic blockers into the shared population intent boundary; still no authority or mutation. */
export function populationActionIntentsForResearch(option:ExecutableResearchOption,actor:ResearchActorResources):PopulationActionIntent[]{return acquisitionIntentsForResearch(option,actor).map((i):PopulationActionIntent=>{if(i.kind==='acquire_tool')return {kind:'acquire_tool',personId:i.personId,toolType:i.toolType,purpose:'research'};if(i.kind==='gain_capability')return {kind:'gain_capability',personId:i.personId,capability:i.capability,minLevel:i.minLevel,purpose:'research'};return {kind:'secure_resource',personId:i.personId,resource:i.resource,amount:i.amount,purpose:'research'}})}
