import type { ObservationCapabilityProfile, ObservationEnvironment } from './observationCapability'
import type { InstrumentDevelopmentGoal } from './instrumentDevelopment'
import { profileSatisfiesDevelopmentGoal } from './instrumentDevelopment'
import type { TechnologyApproach } from './technologySolutionSpace'

export interface InstrumentPrototype {
 id:string
 approachId:string
 instrumentType:string
 observable:string
 method:string
 environments:ObservationEnvironment[]
 status:'built'|'tested'
}

export interface PrototypeMeasurement {
 prototypeId:string
 testId:string
 measuredTick:number
 measuredProfile:ObservationCapabilityProfile
 evidenceRefs:string[]
}

export interface PrototypeEvaluation {
 prototypeId:string
 approachId:string
 goalId:string
 outcome:'meets_goal'|'partial'|'fails_goal'
 measuredProfile:ObservationCapabilityProfile
 unmetDimensions:string[]
 evidenceRefs:string[]
}

/** Building records lineage only. Predicted approach values are deliberately not copied into measured capability. */
export function prototypeFromApproach(input:{id:string;instrumentType:string;observable:string;method:string;environments:ObservationEnvironment[];approach:TechnologyApproach}):InstrumentPrototype{
 return {id:input.id,approachId:input.approach.id,instrumentType:input.instrumentType,observable:input.observable,method:input.method,environments:[...input.environments],status:'built'}
}

export function evaluatePrototype(prototype:InstrumentPrototype,measurement:PrototypeMeasurement,goal:InstrumentDevelopmentGoal):PrototypeEvaluation{
 if(measurement.prototypeId!==prototype.id)throw new Error('prototype_measurement_mismatch')
 const p=measurement.measuredProfile
 const unmet:string[]=[]
 if(p.observable!==goal.observable)unmet.push('observable')
 if(!p.environments.includes(goal.environment))unmet.push('environment')
 for(const t of goal.targets){
  if(t.dimension==='observable'||t.dimension==='environment')continue
  const v=t.dimension==='uncertainty'?p.uncertainty:t.dimension==='detection_limit'?p.detectionLimit:t.dimension==='range'?p.rangeMeters:t.dimension==='spatial_resolution'?p.spatialResolutionMeters:p.temporalResolutionTicks
  if(v===undefined||typeof t.target!=='number'||(t.direction==='at_least'?v<t.target:v>t.target))unmet.push(t.dimension)
 }
 const meets=profileSatisfiesDevelopmentGoal(p,goal)
 const observedDimensions=goal.targets.length-unmet.length
 return {prototypeId:prototype.id,approachId:prototype.approachId,goalId:goal.id,outcome:meets?'meets_goal':observedDimensions>0?'partial':'fails_goal',measuredProfile:p,unmetDimensions:[...new Set(unmet)],evidenceRefs:[...measurement.evidenceRefs]}
}
