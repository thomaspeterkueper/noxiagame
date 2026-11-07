/** Pure civic preflight: never mutates property, maps or world state.
 * All input can arrive as untrusted JSON. A positive preflight is advisory only:
 * Core must independently authenticate the actor, check ownership/authority,
 * revalidate the persisted decision and serialize the command.
 */
export type CivicAction = 'purchase' | 'sale' | 'renovation' | 'conversion' | 'demolition'
export interface CivicDecision {
  id: string
  proposalId: string
  action: CivicAction
  assetId: string
  competentAuthority: boolean
  quorumMet: boolean
  approved: boolean
  protectedAsset: boolean
  protectionPermit: boolean
  propertyOwnerConsents: boolean
  legalTransferAuthority: boolean
  budgetAvailable: boolean
  resourcesAvailable: boolean
  provenanceRefs: readonly string[]
}
export interface CivicPreflight {
  decisionId: string
  allowed: boolean
  reasons: string[]
  action: CivicAction | null
  assetId: string
  execution: 'core_command_required'
}
const actions: readonly CivicAction[] = ['purchase', 'sale', 'renovation', 'conversion', 'demolition']
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const isAction = (value: unknown): value is CivicAction => actions.some(action => action === value)

/** Fail closed on malformed receipts, including truthy strings masquerading as booleans. */
export function evaluateCivicDecision(input: CivicDecision): CivicPreflight {
  const d: Record<string, unknown> = input && typeof input === 'object' && !Array.isArray(input)
    ? input as unknown as Record<string, unknown> : {}
  const reasons: string[] = []
  const refs = d.provenanceRefs
  if (!nonempty(d.id) || !nonempty(d.proposalId) || !nonempty(d.assetId) ||
      !Array.isArray(refs) || refs.length === 0 || !refs.every(nonempty)) {
    reasons.push('missing_provenance')
  }
  if (!isAction(d.action)) reasons.push('invalid_action')
  if (d.competentAuthority !== true) reasons.push('no_authority')
  if (d.quorumMet !== true) reasons.push('quorum_not_met')
  if (d.approved !== true) reasons.push('not_approved')
  if (typeof d.propertyOwnerConsents !== 'boolean' || typeof d.legalTransferAuthority !== 'boolean' ||
      (d.propertyOwnerConsents !== true && d.legalTransferAuthority !== true)) {
    reasons.push('property_rights_unresolved')
  }
  if (typeof d.protectedAsset !== 'boolean' || typeof d.protectionPermit !== 'boolean' ||
      (d.protectedAsset === true && d.protectionPermit !== true)) {
    reasons.push('protection_permit_missing')
  }
  if (d.budgetAvailable !== true) reasons.push('insufficient_budget')
  if (d.resourcesAvailable !== true) reasons.push('insufficient_resources')
  return {
    decisionId: nonempty(d.id) ? d.id : '',
    allowed: reasons.length === 0,
    reasons,
    action: isAction(d.action) ? d.action : null,
    assetId: nonempty(d.assetId) ? d.assetId : '',
    execution: 'core_command_required',
  }
}
