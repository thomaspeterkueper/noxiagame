// Describes what an instrument can actually make observable.
// Catalog data only: it does not assert ownership, availability, authority, or truth.

export type ObservationEnvironment='surface'|'atmosphere'|'vacuum'|'underwater'|'interior'|'orbital'

export interface ObservationCapabilityProfile {
  instrumentType:string
  observable:string
  method:string
  environments:ObservationEnvironment[]
  rangeMeters?:number
  spatialResolutionMeters?:number
  temporalResolutionTicks?:number
  uncertainty?:number
  detectionLimit?:number
  energyPerObservation?:number
  durationTicks?:number
}

export interface ObservationRequirement {
  observable:string
  environment:ObservationEnvironment
  maxUncertainty?:number
  maxDetectionLimit?:number
  minRangeMeters?:number
  maxSpatialResolutionMeters?:number
  maxTemporalResolutionTicks?:number
}

export interface CapabilityMatch {
  profile:ObservationCapabilityProfile
  sufficient:boolean
  gaps:Array<'observable'|'environment'|'uncertainty'|'detection_limit'|'range'|'spatial_resolution'|'temporal_resolution'>
}

export function assessObservationCapability(profile:ObservationCapabilityProfile,req:ObservationRequirement):CapabilityMatch{
 const gaps:CapabilityMatch['gaps']=[]
 if(profile.observable!==req.observable)gaps.push('observable')
 if(!profile.environments.includes(req.environment))gaps.push('environment')
 if(req.maxUncertainty!==undefined&&(profile.uncertainty===undefined||profile.uncertainty>req.maxUncertainty))gaps.push('uncertainty')
 if(req.maxDetectionLimit!==undefined&&(profile.detectionLimit===undefined||profile.detectionLimit>req.maxDetectionLimit))gaps.push('detection_limit')
 if(req.minRangeMeters!==undefined&&(profile.rangeMeters===undefined||profile.rangeMeters<req.minRangeMeters))gaps.push('range')
 if(req.maxSpatialResolutionMeters!==undefined&&(profile.spatialResolutionMeters===undefined||profile.spatialResolutionMeters>req.maxSpatialResolutionMeters))gaps.push('spatial_resolution')
 if(req.maxTemporalResolutionTicks!==undefined&&(profile.temporalResolutionTicks===undefined||profile.temporalResolutionTicks>req.maxTemporalResolutionTicks))gaps.push('temporal_resolution')
 return {profile,sufficient:gaps.length===0,gaps}
}

export function instrumentsForObservation(catalog:ObservationCapabilityProfile[],req:ObservationRequirement):CapabilityMatch[]{
 return catalog.map(p=>assessObservationCapability(p,req)).sort((a,b)=>Number(b.sufficient)-Number(a.sufficient)||a.gaps.length-b.gaps.length||a.profile.instrumentType.localeCompare(b.profile.instrumentType))
}

export interface ObservationTechnologyGap {
  requirement:ObservationRequirement
  candidateInstrumentTypes:string[]
  missingDimensions:CapabilityMatch['gaps']
}

/** A technology gap exists only when the supplied instrument catalog cannot satisfy the requirement. */
export function observationTechnologyGap(catalog:ObservationCapabilityProfile[],req:ObservationRequirement):ObservationTechnologyGap|null{
 const matches=instrumentsForObservation(catalog,req)
 if(matches.some(m=>m.sufficient))return null
 return {requirement:req,candidateInstrumentTypes:matches.slice(0,3).map(m=>m.profile.instrumentType),missingDimensions:[...new Set(matches.flatMap(m=>m.gaps))]}
}
