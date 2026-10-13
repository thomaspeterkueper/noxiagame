import type { TechnologyApproach } from './technologySolutionSpace'
import type { PrototypeMeasurement } from './prototypeExperiment'

export type PerformanceDimension='uncertainty'|'detection_limit'|'range'|'spatial_resolution'|'temporal_resolution'
export interface PrototypeResidual {dimension:PerformanceDimension;predicted:number;measured?:number;delta?:number;classification:'better'|'within_expectation'|'underperform'|'unmeasured'}
const lowerBetter=new Set<PerformanceDimension>(['uncertainty','detection_limit','spatial_resolution','temporal_resolution'])

function measured(m:PrototypeMeasurement,d:PerformanceDimension){
 const p=m.measuredProfile
 return d==='uncertainty'?p.uncertainty:d==='detection_limit'?p.detectionLimit:d==='range'?p.rangeMeters:d==='spatial_resolution'?p.spatialResolutionMeters:p.temporalResolutionTicks
}
export function prototypeResiduals(a:TechnologyApproach,m:PrototypeMeasurement,toleranceFraction=.05):PrototypeResidual[]{
 return (Object.keys(a.predictedTargets) as PerformanceDimension[]).sort().map(d=>{
  const predicted=a.predictedTargets[d]!,actual=measured(m,d)
  if(actual===undefined)return {dimension:d,predicted,classification:'unmeasured'}
  const delta=actual-predicted,tol=Math.abs(predicted)*Math.max(0,toleranceFraction)
  if(Math.abs(delta)<=tol)return {dimension:d,predicted,measured:actual,delta,classification:'within_expectation'}
  const worse=lowerBetter.has(d)?delta>0:delta<0
  return {dimension:d,predicted,measured:actual,delta,classification:worse?'underperform':'better'}
 })
}
