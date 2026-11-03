/** Owner-supervised training of a digital identity.
 * Training here means curated memory/identity updates, not changing LLM weights.
 * Proposal and approval are different events; historical facts require source review.
 */
export type TrainingTarget = 'historical-correction' | 'style' | 'values' | 'autonomous-preference'
export type TrainingStatus = 'proposed' | 'approved' | 'rejected'
export interface TrainingProposal {
  id: string
  legacyIdentityId: string
  createdByUserId: string
  target: TrainingTarget
  proposedText: string
  sourceIds: readonly string[]
  createdAt: string
  status: TrainingStatus
  reviewedByUserId?: string
  reviewedAt?: string
}
export interface TrainingDecision {
  proposalId: string
  approved: boolean
  reviewedByUserId: string
  reviewedAt: string
}
export function proposeTraining(input: Omit<TrainingProposal, 'status'>): TrainingProposal {
  if (!input.id.trim() || !input.legacyIdentityId.trim() || !input.createdByUserId.trim() || !input.proposedText.trim())
    throw new Error('Invalid training proposal')
  if (input.target === 'historical-correction' && input.sourceIds.length === 0)
    throw new Error('Historical corrections need source provenance')
  return { ...input, sourceIds: [...input.sourceIds], status: 'proposed' }
}
export function reviewTraining(proposal: TrainingProposal, decision: TrainingDecision, ownerUserId: string): TrainingProposal {
  if (proposal.status !== 'proposed') throw new Error('Proposal already reviewed')
  if (decision.proposalId !== proposal.id) throw new Error('Proposal mismatch')
  if (decision.reviewedByUserId !== ownerUserId) throw new Error('Only identity owner may review training')
  if (proposal.target === 'historical-correction' && proposal.sourceIds.length === 0)
    throw new Error('Historical corrections need provenance')
  return { ...proposal, sourceIds: [...proposal.sourceIds], status: decision.approved ? 'approved' : 'rejected',
    reviewedByUserId: decision.reviewedByUserId, reviewedAt: decision.reviewedAt }
}
/** A reviewed proposal is not a mutation: persistence/activation remains a separate, audited step. */
export function approvedTrainingForInstance(proposals: readonly TrainingProposal[], identityId: string) {
  return proposals.filter(p => p.legacyIdentityId === identityId && p.status === 'approved')
}
