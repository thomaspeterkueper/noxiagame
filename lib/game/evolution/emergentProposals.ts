/** NOXIA emergent evolution: deterministic, read-only opportunity screening.
 * NPC speech, dreams and external material are untrusted signals, never commands.
 * This module never alters world state or generates/executes software.
 */
export type OpportunityKind = 'event' | 'building' | 'service' | 'technology' | 'game_mechanic'
export type SignalChannel = 'conversation' | 'behavior' | 'dream' | 'world_observation'
export interface EvolutionSignal {
  id: string
  npcId: string
  tick: number
  channel: SignalChannel
  opportunityKey: string
  kind: OpportunityKind
  relevance: number
  provenanceRefs: readonly string[]
}
export interface EvolutionProposal {
  id: string
  opportunityKey: string
  kind: OpportunityKind
  score: number
  independentNpcs: number
  signalIds: string[]
  provenanceRefs: string[]
  status: 'candidate'
  execution: 'review_required'
  canonical: false
}
const bounded = (n: number) => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0
/** Screening only. A separate domain-specific command must validate actual actions. */
export function discoverEvolutionProposals(input: {
  signals: readonly EvolutionSignal[]
  minIndependentNpcs?: number
  minScore?: number
  maxProposals?: number
}): EvolutionProposal[] {
  const minNpcs = Math.max(2, Math.floor(input.minIndependentNpcs ?? 2))
  const minScore = bounded(input.minScore ?? 0.6)
  const groups = new Map<string, EvolutionSignal[]>()
  for (const s of input.signals) {
    if (!s.id || !s.npcId || !s.opportunityKey || !s.provenanceRefs.length || !Number.isFinite(s.tick)) continue
    const key = s.kind + ':' + s.opportunityKey
    groups.set(key, [...(groups.get(key) ?? []), s])
  }
  const proposals: EvolutionProposal[] = []
  for (const [key, signals] of groups) {
    // A prolific NPC cannot create consensus alone; count one strongest signal per NPC.
    const strongest = new Map<string, EvolutionSignal>()
    for (const s of signals) {
      const old = strongest.get(s.npcId)
      if (!old || bounded(s.relevance) > bounded(old.relevance) ||
        (bounded(s.relevance) === bounded(old.relevance) && s.id < old.id)) strongest.set(s.npcId, s)
    }
    const independent = [...strongest.values()].sort((a, b) => a.id.localeCompare(b.id))
    if (independent.length < minNpcs) continue
    const score = independent.reduce((sum, s) => sum + bounded(s.relevance), 0) / independent.length
    if (score < minScore) continue
    const representative = independent[0]
    proposals.push({
      id: 'evolution:' + key, opportunityKey: representative.opportunityKey,
      kind: representative.kind, score, independentNpcs: independent.length,
      signalIds: independent.map(s => s.id),
      provenanceRefs: [...new Set(independent.flatMap(s => s.provenanceRefs))].sort(),
      status: 'candidate', execution: 'review_required', canonical: false,
    })
  }
  return proposals.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, Math.min(100, Math.floor(input.maxProposals ?? 20))))
}
