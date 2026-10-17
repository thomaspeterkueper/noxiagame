import { createDreamAssociation, selectDreamSourceMotifs, type DreamAssociation } from '../cognition/dreamRecombination'

/**
 * Experimental offline NPC dream synthesis. No network, persistence or canonical knowledge writes.
 * A dream is a subjective association, never a verified claim.
 */
export type DreamSource = Readonly<{
  id: string
  text: string
  sourceUri: string
  observedAtTick: number
  availableFromYear: number
  license: string
  emotionalIntensity?: number // optional cached source classification, 0..1
  worldProjection?: Readonly<{ availableFromYear: number; accessible: boolean; location?: string }> // approved in-world availability
}>
export type DreamMemory = Readonly<{ id: string; summary: string; emotionalWeight: number }>
/** Compatibility view: one authoritative dream identity and provenance model. */
export type DreamEpisode = Readonly<DreamAssociation & {
  atTick: number
  sourceIds: readonly string[]
  memoryIds: readonly string[]
  interpretation: string
  emotionalTone: 'neutral' | 'uneasy' | 'nightmare'
  distressScore: number
  epistemicStatus: 'subjective-dream'
}>
export type DreamBudget = Readonly<{ maxSources: number; maxMemories: number; maxTextLength: number }>

function positiveInt(n: number, label: string): void {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('Invalid ' + label)
}
function motifKeys(value: string): string[] {
  return [...new Set((value.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []).slice(0, 32))]
    .filter(key => !['about', 'there', 'their', 'would', 'could', 'from', 'with', 'have', 'that', 'this'].includes(key))
}
/** Explicit opt-in caller, e.g. sleep event; deterministic and side-effect free. */
export function synthesizeNpcDream(input: {
  npcId: string
  tick: number
  worldYear: number
  sleeping: boolean
  memories: readonly DreamMemory[]
  sources: readonly DreamSource[]
  budget?: DreamBudget
  emotionalSensitivity?: number // NPC trait 0..1; affects subjective response, not source truth
  allowForeignImpulse?: boolean // explicitly opt-in; at most one marked, lore-approved source
}): DreamEpisode | null {
  const { npcId, tick, worldYear, sleeping } = input
  if (!npcId.trim()) throw new Error('Missing NPC')
  positiveInt(tick, 'tick')
  if (!Number.isSafeInteger(worldYear)) throw new Error('Invalid world year')
  if (input.emotionalSensitivity !== undefined && (!Number.isFinite(input.emotionalSensitivity) || input.emotionalSensitivity < 0 || input.emotionalSensitivity > 1)) throw new Error('Invalid emotional sensitivity')
  if (!sleeping) return null
  const budget = input.budget ?? { maxSources: 2, maxMemories: 3, maxTextLength: 180 }
  positiveInt(budget.maxSources, 'source budget')
  positiveInt(budget.maxMemories, 'memory budget')
  positiveInt(budget.maxTextLength, 'text budget')
  const memories = [...input.memories]
    .filter(m => m.id.trim() && m.summary.trim() && Number.isFinite(m.emotionalWeight))
    .sort((a, b) => b.emotionalWeight - a.emotionalWeight || a.id.localeCompare(b.id))
    .slice(0, budget.maxMemories)
  const memoryKeys = [...new Set(memories.flatMap(m => motifKeys(m.summary)))]
  const eligibleSources = [...input.sources]
    .filter(s => s.id.trim() && s.sourceUri.trim() && s.license.trim() &&
      s.availableFromYear <= worldYear && s.observedAtTick <= tick && s.text.trim() &&
      s.worldProjection?.accessible === true && s.worldProjection.availableFromYear <= worldYear &&
      (s.emotionalIntensity === undefined || (Number.isFinite(s.emotionalIntensity) && s.emotionalIntensity >= 0 && s.emotionalIntensity <= 1)))
  const selectedSources = selectDreamSourceMotifs({
    npcId, atTick: tick, motifKeys: memoryKeys,
    sources: eligibleSources.map(s => ({ id: s.id, motifs: motifKeys(s.text) })),
    limit: budget.maxSources,
    allowForeignImpulse: input.allowForeignImpulse === true,
  })
  const chosenIds = selectedSources.map(selection => selection.id)
  const byId = new Map(eligibleSources.map(s => [s.id, s]))
  const sources = chosenIds.map(id => byId.get(id)!).filter(Boolean)
  if (!memories.length && !sources.length) return null
  // Keep abstract motif keys only; never replicate source or memory prose into a dream.
  const motifs = [...new Set([...memories.flatMap(m => motifKeys(m.summary)),
    ...sources.flatMap(s => motifKeys(s.text))])].slice(0, 24)
  const sourceIntensity = sources.length ? Math.max(...sources.map(s => s.emotionalIntensity ?? 0)) : 0
  const memoryIntensity = memories.length ? Math.max(...memories.map(m => Math.max(0, Math.min(1, Math.abs(m.emotionalWeight))))) : 0
  // Heuristic only; do not infer psychiatric diagnoses or make claims about human nightmares.
  const distressScore = Math.min(1, sourceIntensity * 0.65 + memoryIntensity * 0.2 +
    (input.emotionalSensitivity ?? 0) * 0.15)
  const emotionalTone = distressScore >= 0.75 ? 'nightmare' as const :
    distressScore >= 0.4 ? 'uneasy' as const : 'neutral' as const
  const association = createDreamAssociation({
    npcId,
    atTick: tick,
    memoryIds: memories.map(m => m.id),
    sourceIds: sources.map(s => s.id),
    motifs,
    strength: memoryIntensity,
    novelty: sources.length ? 0.5 : 0,
    maxMotifs: 24,
  })
  return Object.freeze({
    ...association,
    atTick: tick,
    motifs: Object.freeze([...association.motifs]),
    sourceIds: Object.freeze(sources.map(s => s.id)),
    sourceImpulseKinds: Object.freeze(selectedSources.map(selection => ({ ...selection }))),
    memoryIds: Object.freeze(memories.map(m => m.id)),
    interpretation: 'Subjective associations; requires independent verification.',
    emotionalTone,
    distressScore,
    epistemicStatus: 'subjective-dream' as const,
  })
}
