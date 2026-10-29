/** Pure civic preflight: no property, map, or world state mutation. */
export type CivicAction = 'purchase' | 'sale' | 'renovation' | 'conversion' | 'demolition'
export interface CivicDecision {
 id:string; proposalId:string; action:CivicAction; assetId:string;
 competentAuthority:boolean; quorumMet:boolean; approved:boolean;
 protectedAsset:boolean; protectionPermit:boolean;
 propertyOwnerConsents:boolean; legalTransferAuthority:boolean;
 budgetAvailable:boolean; resourcesAvailable:boolean;
 provenanceRefs:readonly string[];
}
export interface CivicPreflight {
 decisionId:string; allowed:boolean; reasons:string[];
 action:CivicAction; assetId:string; execution:'core_command_required'
}
export function evaluateCivicDecision(d:CivicDecision):CivicPreflight {
 const reasons:string[]=[]
 if (!d.id || !d.proposalId || !d.assetId || !d.provenanceRefs.length) reasons.push('missing_provenance')
 if (!d.competentAuthority) reasons.push('no_authority')
 if (!d.quorumMet) reasons.push('quorum_not_met')
 if (!d.approved) reasons.push('not_approved')
 if (!d.propertyOwnerConsents && !d.legalTransferAuthority) reasons.push('property_rights_unresolved')
 if (d.protectedAsset && !d.protectionPermit) reasons.push('protection_permit_missing')
 if (!d.budgetAvailable) reasons.push('insufficient_budget')
 if (!d.resourcesAvailable) reasons.push('insufficient_resources')
 return {decisionId:d.id,allowed:reasons.length===0,reasons,action:d.action,
 assetId:d.assetId,execution:'core_command_required'}
}
