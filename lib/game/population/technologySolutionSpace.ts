import type { InstrumentDevelopmentGoal } from './instrumentDevelopment'

export interface TechnologyKnowledgeRequirement { subjectType:string; subjectRef:string; knowledgeType:string; minConfidence:number }
export interface TechnologyMaterialRequirement { materialType:string; amount:number }
export interface TechnologyComponentRequirement { componentType:string; amount:number }
export interface TechnologyCapabilityRequirement { capability:string; minLevel:number }

export interface TechnologyApproach {
 id:string
 developmentKind:'instrument'
 basedOnInstrumentType?:string
 descriptionCode:string
 predictedTargets:Partial<Record<'uncertainty'|'detection_limit'|'range'|'spatial_resolution'|'temporal_resolution',number>>
 addsObservable?:string
 addsEnvironment?:string
 knowledge:TechnologyKnowledgeRequirement[]
 materials:TechnologyMaterialRequirement[]
 components:TechnologyComponentRequirement[]
 capabilities:TechnologyCapabilityRequirement[]
 estimatedTimeTicks:number
 estimatedCredits:number
 estimatedEnergy:number
 risk:number
}

export interface TechnologyActorState {
 knowledge:Array<{subjectType:string;subjectRef:string;knowledgeType:string;confidence:number}>
 materials:Record<string,number>
 components:Record<string,number>
 capabilities:Record<string,number>
 credits:number
 energy:number
 availableTimeTicks:number
}

export interface TechnologyApproachAssessment {
 approach:TechnologyApproach
 addressesGoal:boolean
 executable:boolean
 blockers:Array<'goal'|'knowledge'|'material'|'component'|'capability'|'credits'|'energy'|'time'>
 burden:number
}

function addresses(goal:InstrumentDevelopmentGoal,a:TechnologyApproach){
 return goal.targets.every(t=>{
  if(t.dimension==='observable')return a.addsObservable===t.target
  if(t.dimension==='environment')return a.addsEnvironment===t.target
  const v=a.predictedTargets[t.dimension]
  if(v===undefined||typeof t.target!=='number')return false
  return t.direction==='at_least'?v>=t.target:v<=t.target
 })
}
export function assessTechnologyApproach(goal:InstrumentDevelopmentGoal,a:TechnologyApproach,s:TechnologyActorState):TechnologyApproachAssessment{
 const blockers:TechnologyApproachAssessment['blockers']=[]
 const addressesGoal=addresses(goal,a);if(!addressesGoal)blockers.push('goal')
 if(a.knowledge.some(r=>!s.knowledge.some(k=>k.subjectType===r.subjectType&&k.subjectRef===r.subjectRef&&k.knowledgeType===r.knowledgeType&&k.confidence>=r.minConfidence)))blockers.push('knowledge')
 if(a.materials.some(r=>(s.materials[r.materialType]??0)<r.amount))blockers.push('material')
 if(a.components.some(r=>(s.components[r.componentType]??0)<r.amount))blockers.push('component')
 if(a.capabilities.some(r=>(s.capabilities[r.capability]??0)<r.minLevel))blockers.push('capability')
 if(s.credits<a.estimatedCredits)blockers.push('credits');if(s.energy<a.estimatedEnergy)blockers.push('energy');if(s.availableTimeTicks<a.estimatedTimeTicks)blockers.push('time')
 const burden=a.estimatedTimeTicks+a.estimatedCredits+a.estimatedEnergy+a.risk*10
 return {approach:a,addressesGoal,executable:blockers.length===0,blockers,burden}
}
export function technologySolutionSpace(goal:InstrumentDevelopmentGoal,approaches:TechnologyApproach[],state:TechnologyActorState){
 return approaches.map(a=>assessTechnologyApproach(goal,a,state)).sort((a,b)=>Number(b.addressesGoal)-Number(a.addressesGoal)||Number(b.executable)-Number(a.executable)||a.burden-b.burden||a.approach.id.localeCompare(b.approach.id))
}
