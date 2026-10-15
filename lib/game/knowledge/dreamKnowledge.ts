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
}>
export type DreamMemory = Readonly<{ id: string; summary: string; emotionalWeight: number }>
export type DreamEpisode = Readonly<{
  id: string
  npcId: string
  atTick: number
  motifs: readonly string[]
  sourceIds: readonly string[]
  memoryIds: readonly string[]
  interpretation: string
  epistemicStatus: 'subjective-dream'
}>
export type DreamBudget = Readonly<{ maxSources: number; maxMemories: number; maxTextLength: number }>

function positiveInt(n: number, label: string): void {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('Invalid ' + label)
}
function hash(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619)
  return h >>> 0
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
}): DreamEpisode | null {
  const { npcId, tick, worldYear, sleeping } = input
  if (!npcId.trim()) throw new Error('Missing NPC')
  positiveInt(tick, 'tick')
  if (!Number.isSafeInteger(worldYear)) throw new Error('Invalid world year')
  if (!sleeping) return null
  const budget = input.budget ?? { maxSources: 2, maxMemories: 3, maxTextLength: 180 }
  positiveInt(budget.maxSources, 'source budget')
  positiveInt(budget.maxMemories, 'memory budget')
  positiveInt(budget.maxTextLength, 'text budget')
  const memories = [...input.memories]
    .filter(m => m.id.trim() && m.summary.trim() && Number.isFinite(m.emotionalWeight))
    .sort((a, b) => b.emotionalWeight - a.emotionalWeight || a.id.localeCompare(b.id))
    .slice(0, budget.maxMemories)
  const sources = [...input.sources]
    .filter(s => s.id.trim() && s.sourceUri.trim() && s.license.trim() &&
      s.availableFromYear <= worldYear && s.observedAtTick <= tick && s.text.trim())
    .sort((a, b) => hash(npcId + ':' + tick + ':' + a.id) - hash(npcId + ':' + tick + ':' + b.id) || a.id.localeCompare(b.id))
    .slice(0, budget.maxSources)
  if (!memories.length && !sources.length) return null
  // External text is inspiration only: truncate and never mark as factual knowledge.
  const motifs = [...memories.map(m => m.summary), ...sources.map(s => s.text)]
    .map(s => s.slice(0, budget.maxTextLength))
  return Object.freeze({
    id: 'dream:' + npcId + ':' + tick,
    npcId, atTick: tick,
    motifs: Object.freeze(motifs),
    sourceIds: Object.freeze(sources.map(s => s.id)),
    memoryIds: Object.freeze(memories.map(m => m.id)),
    interpretation: 'Subjective associations; requires independent verification.',
    epistemicStatus: 'subjective-dream' as const,
  })
}
