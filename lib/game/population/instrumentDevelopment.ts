import type { ObservationCapabilityProfile, ObservationRequirement, ObservationTechnologyGap } from './observationCapability'

export type InstrumentDevelopmentDimension='observable'|'environment'|'uncertainty'|'detection_limit'|'range'|'spatial_resolution'|'temporal_resolution'

export interface InstrumentDevelopmentTarget {
  dimension:InstrumentDevelopmentDimension
  direction:'add'|'at_most'|'at_least'
  target:string|number
}

export interface InstrumentDevelopmentGoal {
  id:string
  kind:'instrument_capability'
  observable:string
  environment:ObservationRequirement['environment']
  basedOnInstrumentTypes:string[]
  targets:InstrumentDevelopmentTarget[]
  reason:'observation_technology_gap'
}

/**
 * Turns a measured capability gap into requirements for technology development.
 * It deliberately does not invent a device, implementation, material, cost or success.
 */
export function instrumentDevelopmentGoal(gap:ObservationTechnologyGap):InstrumentDevelopmentGoal{
 const r=gap.requirement
 const targets:InstrumentDevelopmentTarget[]=[]
 for(const d of gap.missingDimensions){
  if(d==='observable')targets.push({dimension:d,direction:'add',target:r.observable})
  else if(d==='environment')targets.push({dimension:d,direction:'add',target:r.environment})
  else if(d==='uncertainty'&&r.maxUncertainty!==undefined)targets.push({dimension:d,direction:'at_most',target:r.maxUncertainty})
  else if(d==='detection_limit'&&r.maxDetectionLimit!==undefined)targets.push({dimension:d,direction:'at_most',target:r.maxDetectionLimit})
  else if(d==='range'&&r.minRangeMeters!==undefined)targets.push({dimension:d,direction:'at_least',target:r.minRangeMeters})
  else if(d==='spatial_resolution'&&r.maxSpatialResolutionMeters!==undefined)targets.push({dimension:d,direction:'at_most',target:r.maxSpatialResolutionMeters})
  else if(d==='temporal_resolution'&&r.maxTemporalResolutionTicks!==undefined)targets.push({dimension:d,direction:'at_most',target:r.maxTemporalResolutionTicks})
 }
 const signature=[r.observable,r.environment,...targets.map(t=>`${t.dimension}:${t.direction}:${t.target}`)].join('|')
 return {id:`instrument-development:${signature}`,kind:'instrument_capability',observable:r.observable,environment:r.environment,basedOnInstrumentTypes:[...gap.candidateInstrumentTypes],targets,reason:'observation_technology_gap'}
}

export function profileSatisfiesDevelopmentGoal(profile:ObservationCapabilityProfile,goal:InstrumentDevelopmentGoal):boolean{
 if(profile.observable!==goal.observable||!profile.environments.includes(goal.environment))return false
 return goal.targets.every(t=>{
  if(t.dimension==='observable')return profile.observable===t.target
  if(t.dimension==='environment')return profile.environments.includes(t.target as any)
  const value=t.dimension==='uncertainty'?profile.uncertainty:t.dimension==='detection_limit'?profile.detectionLimit:t.dimension==='range'?profile.rangeMeters:t.dimension==='spatial_resolution'?profile.spatialResolutionMeters:profile.temporalResolutionTicks
  if(value===undefined||typeof t.target!=='number')return false
  return t.direction==='at_least'?value>=t.target:value<=t.target
 })
}
