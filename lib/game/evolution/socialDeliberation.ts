/** Deliberation is a proposal, not a vote or permission to mutate world state.
 * Books, conversations, dreams and insight are subjective signals with references.
 */
export type DeliberationSource = 'conversation' | 'book' | 'dream' | 'insight' | 'observation'
export type Stance = 'support' | 'oppose' | 'question' | 'alternative'
export interface CivicContribution {
  id: string
  actorId: string
  proposalKey: string
  source: DeliberationSource
  sourceRefs: readonly string[]
  stance: Stance
  tick: number
  /** Direct evidence that this participant has an independently sourced reason. */
  independentEvidence: boolean
  /** Explicit consent to join a potential collaborative project. */
  willingToCollaborate: boolean
}
export interface DeliberationSnapshot {
  proposalKey: string
  participants: number
  supporters: number
  opponents: number
  questions: number
  alternatives: number
  independentSupporters: number
  collaborators: string[]
  sourceKinds: DeliberationSource[]
  sources: string[]
  status: 'discussion' | 'collaboration_candidate'
  execution: 'review_required'
  canonical: false
}
/** Count persons, not messages. The latest contribution determines their present stance.
 * No single actor or any number of duplicates can authorize collective action.
 */
export function deliberate(input: {
  contributions: readonly CivicContribution[]
  minCollaborators?: number
}): DeliberationSnapshot[] {
  // A contribution ID identifies one immutable receipt across all proposals.
  // Identical replays count once; conflicting uses of an ID count zero,
  // irrespective of input order. Neither is a new participant or vote.
  const unique = new Map<string, { contribution: CivicContribution; fingerprint: string }>()
  const conflictingIds = new Set<string>()
  for (const c of input.contributions) {
    if (!c.id || conflictingIds.has(c.id)) continue
    const fingerprint = JSON.stringify([
      c.actorId, c.proposalKey, c.source,
      Array.isArray(c.sourceRefs) ? [...c.sourceRefs].sort() : null,
      c.stance, c.tick, c.independentEvidence, c.willingToCollaborate,
    ])
    const prior = unique.get(c.id)
    if (prior && prior.fingerprint !== fingerprint) {
      unique.delete(c.id)
      conflictingIds.add(c.id)
    } else if (!prior) {
      unique.set(c.id, { contribution: c, fingerprint })
    }
  }
  const groups = new Map<string, CivicContribution[]>()
  for (const { contribution: c } of unique.values()) {
    if (!c.actorId || !c.proposalKey || !Array.isArray(c.sourceRefs) ||
        !c.sourceRefs.length || !Number.isFinite(c.tick)) continue
    groups.set(c.proposalKey, [...(groups.get(c.proposalKey) ?? []), c])
  }
  const required = Math.max(2, Math.floor(input.minCollaborators ?? 3))
  return [...groups.entries()].map(([proposalKey, contributions]) => {
    const latest = new Map<string, CivicContribution>()
    for (const c of contributions) {
      const prior = latest.get(c.actorId)
      if (!prior || c.tick > prior.tick || (c.tick === prior.tick && c.id > prior.id)) latest.set(c.actorId, c)
    }
    const actors = [...latest.values()]
    const count = (stance: Stance) => actors.filter(c => c.stance === stance).length
    const collaborators = actors.filter(c => c.stance === 'support' && c.willingToCollaborate && c.independentEvidence)
      .map(c => c.actorId).sort()
    return {
      proposalKey,
      participants: actors.length,
      supporters: count('support'),
      opponents: count('oppose'),
      questions: count('question'),
      alternatives: count('alternative'),
      independentSupporters: actors.filter(c => c.stance === 'support' && c.independentEvidence).length,
      collaborators,
      sourceKinds: [...new Set(contributions.map(c => c.source))].sort() as DeliberationSource[],
      sources: [...new Set(contributions.flatMap(c => c.sourceRefs))].sort(),
      status: collaborators.length >= required ? 'collaboration_candidate' as const : 'discussion' as const,
      execution: 'review_required' as const,
      canonical: false as const,
    }
  }).sort((a,b)=>a.proposalKey.localeCompare(b.proposalKey))
}
