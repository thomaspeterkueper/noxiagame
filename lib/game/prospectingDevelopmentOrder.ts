import type { InstrumentDevelopmentGoal } from './population/instrumentDevelopment'
import { instrumentDevelopmentGoal } from './population/instrumentDevelopment'
import type { ObservationTechnologyGap } from './population/observationCapability'
import type { TechnologyApproach } from './population/technologySolutionSpace'

export interface ProspectingDevelopmentOrder{
 id:string
 kind:'instrument_development_order'
 questionId:string
 learningPathId:string
 goal:InstrumentDevelopmentGoal
 status:'proposed'
 approaches:TechnologyApproach[]
}

/**
 * Creates a proposal, not a completed technology. Costs, materials and success
 * remain unknown until an engineering approach provides them.
 */
export function prospectingDevelopmentOrder(args:{
 questionId:string
 learningPathId:string
 gap:ObservationTechnologyGap
 approaches?:TechnologyApproach[]
}):ProspectingDevelopmentOrder{
 const goal=instrumentDevelopmentGoal(args.gap)
 return {
  id:`prospecting-development:${args.questionId}:${goal.id}`,
  kind:'instrument_development_order',
  questionId:args.questionId,
  learningPathId:args.learningPathId,
  goal,
  status:'proposed',
  approaches:[...(args.approaches??[])],
 }
}
