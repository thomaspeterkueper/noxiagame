/** NOXIA emergent evolution: deterministic, read-only opportunity screening.
 * NPC speech, dreams and external material are untrusted signals, never commands.
 * This module never alters world state or generates/executes software.
 */
export type OpportunityKind = 'event' | 'building' | 'service' | 'technology' | 'game_mechanic'
export type SignalChannel = 'conversation' | 'behavior' | 'dream' | 'insight' | 'real_world_discussion' | 'world_observation'
export interface EvolutionSignal {
  id: string
  npcId: string
  tick: number
  channel: SignalChannel
  opportunityKey: string
  kind: OpportunityKind
  relevance: number
  provenanceRefs: readonly string[]
  /** Required for conversations about real-world news to prevent timeline leakage. */
  worldProjection?: { availableFromYear: number; worldYear: number; licensed: boolean; accessible: boolean }
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
const opportunityKinds: readonly OpportunityKind[] = ['event', 'building', 'service', 'technology', 'game_mechanic']
const signalChannels: readonly SignalChannel[] = ['conversation', 'behavior', 'dream', 'insight', 'real_world_discussion', 'world_observation']
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0

/** TypeScript does not validate JSON loaded from NPC memory, event logs or APIs.
 * Invalid receipts are ignored *before* ID collision detection so malformed data
 * cannot veto an otherwise valid, persisted receipt.
 */
function validSignal(value: unknown): value is EvolutionSignal {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const s = value as Partial<EvolutionSignal>
  if (!nonempty(s.id) || !nonempty(s.npcId) || !nonempty(s.opportunityKey) ||
      !Number.isSafeInteger(s.tick) || (s.tick as number) < 0 ||
      typeof s.relevance !== 'number' || !Number.isFinite(s.relevance) ||
      s.relevance < 0 || s.relevance > 1 ||
      !opportunityKinds.includes(s.kind as OpportunityKind) ||
      !signalChannels.includes(s.channel as SignalChannel) ||
      !Array.isArray(s.provenanceRefs) || !s.provenanceRefs.length ||
      !s.provenanceRefs.every(nonempty)) return false
  const p = s.worldProjection
  if (p !== undefined && (!p || typeof p !== 'object' || Array.isArray(p) ||
      !Number.isSafeInteger(p.availableFromYear) || !Number.isSafeInteger(p.worldYear) ||
      typeof p.licensed !== 'boolean' || typeof p.accessible !== 'boolean')) return false
  return true
}
/** Screening only. A separate domain-specific command must validate actual actions. */
export function discoverEvolutionProposals(input: {
  signals: readonly EvolutionSignal[]
  minIndependentNpcs?: number
  minScore?: number
  maxProposals?: number
}): EvolutionProposal[] {
  const minNpcs = Number.isSafeInteger(input.minIndependentNpcs)
    ? Math.max(2, input.minIndependentNpcs as number) : 2
  const minScore = typeof input.minScore === 'number' && Number.isFinite(input.minScore)
    ? bounded(input.minScore) : 0.6
  // Signal IDs are evidence identities, not NPC votes. Replayed identical
  // receipts count once; conflicting receipts with the same ID count zero.
  // Reject both sides of a collision regardless of arrival order.
  const unique = new Map<string, { signal: EvolutionSignal; fingerprint: string }>()
  const conflictingIds = new Set<string>()
  for (const candidate of input.signals as readonly unknown[]) {
    if (!validSignal(candidate)) continue
    const s = candidate
    if (conflictingIds.has(s.id)) continue
    const fingerprint = JSON.stringify([
      s.npcId, s.tick, s.channel, s.opportunityKey, s.kind, s.relevance,
      Array.isArray(s.provenanceRefs) ? [...s.provenanceRefs].sort() : null,
      s.worldProjection ? [
        s.worldProjection.availableFromYear, s.worldProjection.worldYear,
        s.worldProjection.licensed, s.worldProjection.accessible,
      ] : null,
    ])
    const previous = unique.get(s.id)
    if (previous && previous.fingerprint !== fingerprint) {
      unique.delete(s.id)
      conflictingIds.add(s.id)
    } else if (!previous) {
      unique.set(s.id, { signal: s, fingerprint })
    }
  }

  const groups = new Map<string, EvolutionSignal[]>()
  for (const { signal: s } of unique.values()) {
    if (!s.npcId || !s.opportunityKey || !Array.isArray(s.provenanceRefs) ||
        !s.provenanceRefs.length || !Number.isFinite(s.tick)) continue
    if (s.channel === 'real_world_discussion' && (!s.worldProjection || !s.worldProjection.licensed || !s.worldProjection.accessible || s.worldProjection.availableFromYear > s.worldProjection.worldYear)) continue
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
    .slice(0, Number.isSafeInteger(input.maxProposals)
      ? Math.max(0, Math.min(100, input.maxProposals as number)) : 20)
}
