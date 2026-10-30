/** Technical idea intake only. A submitted invention is not a verified technology.
 * The input may be untrusted JSON: rejection never forwards an unchecked payload.
 */
export type EngineeringDomain = 'vehicle'|'material'|'building_technology'|'manufacturing'|'energy'|'other'
export interface EngineeringCandidate {
 id:string; sourceProposalId:string; worldYear:number; domain:EngineeringDomain;
 problem:string; hypothesis:string; sourceRefs:readonly string[];
 availableCapabilities:readonly string[]; limitations:readonly string[];
 origin:'conversation'|'book'|'dream'|'insight'|'experiment'|'community';
}
export interface EngineeringHandoff {
 id:string; target:'kueper-engineering'; status:'needs_review'|'rejected';
 reasons:string[]; payload:EngineeringCandidate|null; grantsTechnology:false;
}
const domains:readonly EngineeringDomain[]=['vehicle','material','building_technology','manufacturing','energy','other']
const origins:readonly EngineeringCandidate['origin'][]=['conversation','book','dream','insight','experiment','community']
const nonempty=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0
const nonemptyList=(v:unknown):v is string[]=>Array.isArray(v)&&v.length>0&&v.every(nonempty)

/** A screen result is never an authorization to unlock technology or mutate the world. */
export function screenEngineeringCandidate(input:unknown):EngineeringHandoff {
 const c:Record<string,unknown>=input!==null&&typeof input==='object'&&!Array.isArray(input)
   ? input as Record<string,unknown> : {}
 const reasons:string[]=[]
 if(!nonempty(c.id)||!nonempty(c.sourceProposalId)||!nonemptyList(c.sourceRefs)) reasons.push('missing_provenance')
 if(typeof c.worldYear!=='number'||!Number.isSafeInteger(c.worldYear)) reasons.push('invalid_world_year')
 if(!domains.includes(c.domain as EngineeringDomain)||!origins.includes(c.origin as EngineeringCandidate['origin'])) reasons.push('invalid_classification')
 if(!nonempty(c.problem)||!nonempty(c.hypothesis)) reasons.push('missing_technical_problem')
 if(!nonemptyList(c.availableCapabilities)) reasons.push('capabilities_unknown')
 if(!nonemptyList(c.limitations)) reasons.push('limitations_not_documented')
 const accepted=reasons.length===0
 return {id:'engineering-handoff:'+(nonempty(c.id)?c.id:''),target:'kueper-engineering',
  status:accepted?'needs_review':'rejected',reasons,
  payload:accepted?input as EngineeringCandidate:null,grantsTechnology:false}
}
