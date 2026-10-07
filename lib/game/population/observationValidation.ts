import type { ObservationCapabilityProfile, ObservationEnvironment } from './observationCapability'

export type ValidationState='predicted'|'lab_validated'|'field_validated'|'environment_validated'|'operationally_validated'
export type SignalSeparationMethod='none'|'background_subtraction'|'coronagraphy'|'spectral'|'temporal'|'spatial'|'model_based'
export type SensorTopology='point'|'array'|'distributed_surface'|'mobile'|'swarm'

export interface ObservationValidationProfile {
 profile:ObservationCapabilityProfile
 validationState:ValidationState
 validatedEnvironments:ObservationEnvironment[]
 evidenceRefs:string[]
 calibrationTick?:number
 validUntilTick?:number
 sensorTopology?:SensorTopology
 access?:{mobile:boolean;maxTravelMeters?:number}
 signalSeparation?:{method:SignalSeparationMethod;suppressionRatio?:number}
 selfInterference?:{characterized:boolean;maxFraction?:number}
}

export interface QualifiedObservationRequirement {
 environment:ObservationEnvironment
 minValidationState?:ValidationState
 maxCalibrationAgeTicks?:number
 requireMobileAccess?:boolean
 minSignalSuppressionRatio?:number
 requireCharacterizedSelfInterference?:boolean
}

const rank:Record<ValidationState,number>={predicted:0,lab_validated:1,field_validated:2,environment_validated:3,operationally_validated:4}
export type ObservationValidationGap='validation'|'environment_validation'|'calibration'|'access'|'signal_separation'|'self_interference'

export function assessObservationValidation(v:ObservationValidationProfile,r:QualifiedObservationRequirement,nowTick:number){
 const gaps:ObservationValidationGap[]=[]
 if(rank[v.validationState]<rank[r.minValidationState??'predicted'])gaps.push('validation')
 if(!v.validatedEnvironments.includes(r.environment))gaps.push('environment_validation')
 if(r.maxCalibrationAgeTicks!==undefined&&(v.calibrationTick===undefined||nowTick-v.calibrationTick>r.maxCalibrationAgeTicks))gaps.push('calibration')
 if(r.requireMobileAccess&&!v.access?.mobile)gaps.push('access')
 if(r.minSignalSuppressionRatio!==undefined&&(v.signalSeparation?.suppressionRatio??0)<r.minSignalSuppressionRatio)gaps.push('signal_separation')
 if(r.requireCharacterizedSelfInterference&&!v.selfInterference?.characterized)gaps.push('self_interference')
 return {sufficient:gaps.length===0,gaps}
}
