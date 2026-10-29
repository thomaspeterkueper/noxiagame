/** Technical idea intake only. A submitted invention is not a verified technology. */
export type EngineeringDomain = 'vehicle'|'material'|'building_technology'|'manufacturing'|'energy'|'other'
export interface EngineeringCandidate {
 id:string; sourceProposalId:string; worldYear:number; domain:EngineeringDomain;
 problem:string; hypothesis:string; sourceRefs:readonly string[];
 availableCapabilities:readonly string[]; limitations:readonly string[];
 origin:'conversation'|'book'|'dream'|'insight'|'experiment'|'community';
}
export interface EngineeringHandoff {
 id:string; target:'kueper-engineering'; status:'needs_review'|'rejected';
 reasons:string[]; payload:EngineeringCandidate; grantsTechnology:false;
}
export function screenEngineeringCandidate(c:EngineeringCandidate):EngineeringHandoff {
 const reasons:string[]=[]
 if(!c.id || !c.sourceProposalId || !c.sourceRefs.length) reasons.push('missing_provenance')
 if(!Number.isInteger(c.worldYear)) reasons.push('invalid_world_year')
 if(!c.problem.trim() || !c.hypothesis.trim()) reasons.push('missing_technical_problem')
 if(c.availableCapabilities.length===0) reasons.push('capabilities_unknown')
 if(c.limitations.length===0) reasons.push('limitations_not_documented')
 return {id:'engineering-handoff:'+c.id,target:'kueper-engineering',
 status:reasons.length?'rejected':'needs_review',reasons,payload:c,grantsTechnology:false}
}
