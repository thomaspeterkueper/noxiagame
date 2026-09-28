import { observationTechnologyGap, type ObservationCapabilityProfile, type ObservationRequirement } from './observationCapability'
import { instrumentDevelopmentGoal, type InstrumentDevelopmentGoal } from './instrumentDevelopment'
import { technologySolutionSpace, type TechnologyActorState, type TechnologyApproach, type TechnologyApproachAssessment } from './technologySolutionSpace'

export interface ObservationDevelopmentAssessment {
  requirement:ObservationRequirement
  sufficientInstrumentTypes:string[]
  developmentGoal:InstrumentDevelopmentGoal|null
  solutionSpace:TechnologyApproachAssessment[]
}

/**
 * Canonical bridge: an epistemic/measurement requirement first checks existing
 * instruments. Only a real capability gap may create a development goal and
 * competing technology approaches.
 */
export function assessObservationDevelopment(args:{
  catalog:ObservationCapabilityProfile[]
  requirement:ObservationRequirement
  approaches:TechnologyApproach[]
  actorState:TechnologyActorState
}):ObservationDevelopmentAssessment{
  const gap=observationTechnologyGap(args.catalog,args.requirement)
  if(!gap){
    const sufficientInstrumentTypes=args.catalog
      .filter(p=>observationTechnologyGap([p],args.requirement)===null)
      .map(p=>p.instrumentType)
      .sort()
    return {requirement:args.requirement,sufficientInstrumentTypes,developmentGoal:null,solutionSpace:[]}
  }
  const developmentGoal=instrumentDevelopmentGoal(gap)
  return {requirement:args.requirement,sufficientInstrumentTypes:[],developmentGoal,solutionSpace:technologySolutionSpace(developmentGoal,args.approaches,args.actorState)}
}
