import { memoriesAreIndependent, type NpcMemory, type NpcMemoryState } from './npcRelationalMemory'
import type { RelationalTrace } from './relationalWorldRuntime'
import type { SensoryPattern } from './sensoryPatternLearning'
import type { CreativityProfile } from '../personCognition'

export interface DreamAssociation {
  id: string
  npcId: string
  sourceMemoryIds: string[]
  sourceIds: readonly string[]
  sourceTraceIds: string[]
  sourcePatternKeys: string[]
  motifs: readonly string[]
  associationStrength: number
  novelty: number
  createdAtTick: number
  provenance: 'dream_recombination'
  canonical: false
}

/** Common provenance-preserving association constructor for internal and cached-source dreams. */
export function createDreamAssociation(input: {
  npcId: string
  atTick: number
  memoryIds: readonly string[]
  traceIds?: readonly string[]
  patternKeys?: readonly string[]
  sourceIds?: readonly string[]
  motifs: readonly string[]
  strength: number
  novelty: number
  maxMotifs?: number
}): DreamAssociation {
  const sourceIds = input.sourceIds ?? []
  const key = [...input.memoryIds, ...(input.traceIds ?? []), ...(input.patternKeys ?? []), ...sourceIds].join('|')
  return {
    id: 'dream-association:' + input.npcId + ':' + input.atTick + ':' + stableHash01(key).toFixed(5),
    npcId: input.npcId,
    createdAtTick: input.atTick,
    sourceMemoryIds: [...input.memoryIds],
    sourceTraceIds: [...input.traceIds ?? []],
    sourcePatternKeys: [...input.patternKeys ?? []],
    sourceIds: [...sourceIds],
    motifs: [...new Set(input.motifs)].slice(0, Math.max(0, Math.min(24, input.maxMotifs ?? 12))),
    associationStrength: unit(input.strength),
    novelty: unit(input.novelty),
    provenance: 'dream_recombination',
    canonical: false,
  }
}

/** One deterministic ranking policy for memory, pattern and external source candidates.
 * A source may use the hashed tie-break; lived memories retain lexical ties.
 */
function rankDreamSignals<T>(items: readonly T[], options: {
  score: (item: T) => number
  key: (item: T) => string
  tieSeed?: string
}): T[] {
  return [...items].sort((a, b) => options.score(b) - options.score(a) ||
    (options.tieSeed === undefined ? 0 :
      stableHash01(options.tieSeed + options.key(a)) -
      stableHash01(options.tieSeed + options.key(b))) ||
    options.key(a).localeCompare(options.key(b)))
}

function rankExternalSources(input: {
  npcId: string
  atTick: number
  motifKeys: readonly string[]
  sources: readonly { id: string; motifs: readonly string[] }[]
}): { id: string; score: number }[] {
  const keys = new Set(input.motifKeys.flatMap(abstractMotifKeys))
  return rankDreamSignals(input.sources.map(source => ({
    id: source.id,
    score: source.motifs.flatMap(abstractMotifKeys).filter(key => keys.has(key)).length,
  })), { score: source => source.score, key: source => source.id,
    tieSeed: input.npcId + ':' + input.atTick + ':' })
}

/** Optional, at most one explicitly marked unrelated impulse from already-approved sources. */
export function selectDreamSourceMotifs(input: {
  npcId: string
  atTick: number
  motifKeys: readonly string[]
  sources: readonly { id: string; motifs: readonly string[] }[]
  limit: number
  allowForeignImpulse?: boolean
}): readonly { id: string; kind: 'related' | 'foreign-impulse' }[] {
  const limit = Math.max(0, Math.min(12, input.limit))
  if (!limit) return []
  const ranked = rankExternalSources(input)
  const selected: { id: string; kind: 'related' | 'foreign-impulse' }[] = ranked.filter(s => s.score > 0).slice(0, limit)
    .map(s => ({ id: s.id, kind: 'related' as const }))
  if (input.allowForeignImpulse && selected.length < limit) {
    const unrelated = ranked.find(s => s.score === 0 && !selected.some(item => item.id === s.id))
    if (unrelated) selected.push({ id: unrelated.id, kind: 'foreign-impulse' as const })
  }
  return selected
}

export interface DreamRecombinationResult {
  candidates: DreamAssociation[]
  consideredMemoryIds: string[]
  consideredPatternKeys: string[]
}

const unit = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))

function stableHash01(value: string) {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 100000) / 100000
}

/** Shared bounded Unicode motif normalization; prose is never retained verbatim. */
export function abstractMotifKeys(value: string): string[] {
  const stop = new Set(['about', 'there', 'their', 'would', 'could', 'from', 'with', 'have', 'that', 'this',
    'eine', 'einer', 'eines', 'einem', 'einen', 'auch', 'aber', 'oder', 'nicht', 'dass',
    'sind', 'wird', 'werden', 'und', 'der', 'die', 'das', 'dem', 'den', 'des', 'für', 'mit', 'von'])
  return [...new Set((value.toLowerCase().match(/[\p{L}\p{N}_:-]{4,}/gu) ?? [])
    .filter(word => word.length <= 48 && !stop.has(word))
    .map(word => {
      if (/^reparat(?:ur|uren)$|^reparier(?:en|t|te|ten)$/.test(word)) return 'repar'
      if (/^repair(?:ed|ing|s)?$/.test(word)) return 'repair'
      return word
    }))].slice(0, 32)
}

function memoryMotifs(memory: NpcMemory): string[] {
  const keys = [memory.attribute, memory.subjectRef]
  const value = memory.rememberedValue
  if (typeof value === 'string') keys.push(...abstractMotifKeys(value))
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const features = (value as Record<string, unknown>).features
    if (features && typeof features === 'object' && !Array.isArray(features)) {
      for (const [key, feature] of Object.entries(features as Record<string, unknown>)) {
        keys.push(key)
        if (typeof feature === 'string') keys.push(...abstractMotifKeys(feature))
      }
    }
  }
  return [...new Set(keys.flatMap(abstractMotifKeys))].slice(0, 8)
}

function patternMotifs(pattern: SensoryPattern): string[] {
  return [...new Set([pattern.modality, pattern.sourceClass, pattern.sourceRef].flatMap(abstractMotifKeys))]
}

function memoryScore(memory: NpcMemory) {
  const stateBonus = memory.state === 'consolidated' ? 0.16 : memory.state === 'fresh' ? 0.1 : 0
  return unit(memory.salience * 0.5 + memory.subjectiveConfidence * 0.28 + Math.min(1, memory.rehearsalCount / 4) * 0.06 + stateBonus)
}

function patternScore(pattern: SensoryPattern) {
  const recurrence = unit(pattern.occurrences / 30)
  return unit(pattern.familiarity * 0.58 + recurrence * 0.28 + pattern.meanClarity * 0.14)
}

/**
 * Deterministic, bounded dream recombination.
 *
 * It never creates world facts, memories or actions. It only returns ephemeral,
 * non-canonical association candidates derived from already-lived material.
 */
export function recombineDuringDream(input: {
  memoryState: NpcMemoryState
  patterns: SensoryPattern[]
  creativity: CreativityProfile
  atTick: number
  maxMemories?: number
  maxPatterns?: number
  maxCandidates?: number
}): DreamRecombinationResult {
  const maxMemories = Math.max(1, Math.min(12, input.maxMemories ?? 6))
  const maxPatterns = Math.max(0, Math.min(12, input.maxPatterns ?? 4))
  const maxCandidates = Math.max(0, Math.min(12, input.maxCandidates ?? 4))

  const memories = rankDreamSignals(
    input.memoryState.memories.filter(memory => memory.state !== 'forgotten'),
    { score: memoryScore, key: memory => memory.id },
  )
    .slice(0, maxMemories)

  const patterns = rankDreamSignals(input.patterns,
    { score: patternScore, key: pattern => pattern.key },
  )
    .slice(0, maxPatterns)

  type CandidateSource = {
    memoryA: NpcMemory
    memoryB?: NpcMemory
    pattern?: SensoryPattern
    rawScore: number
    key: string
  }

  const sources: CandidateSource[] = []

  for (let i = 0; i < memories.length; i += 1) {
    for (let j = i + 1; j < memories.length; j += 1) {
      const a = memories[i]
      const b = memories[j]
      if (!memoriesAreIndependent(a, b, input.memoryState.traces)) continue
      const distanceNoise = stableHash01(a.id + '|' + b.id)
      const breadth = unit(input.creativity.associativeRange * 0.55 + input.creativity.cognitiveFlexibility * 0.3 + input.creativity.noveltySeeking * 0.15)
      const rawScore = unit(memoryScore(a) * 0.36 + memoryScore(b) * 0.36 + distanceNoise * 0.12 + breadth * 0.16)
      sources.push({ memoryA: a, memoryB: b, rawScore, key: a.id + '|' + b.id })
    }
  }

  for (const memory of memories) {
    for (const pattern of patterns) {
      const novelty = stableHash01(memory.id + '|' + pattern.key)
      const rawScore = unit(memoryScore(memory) * 0.42 + patternScore(pattern) * 0.34 + novelty * 0.1 + input.creativity.associativeRange * 0.14)
      sources.push({ memoryA: memory, pattern, rawScore, key: memory.id + '|' + pattern.key })
    }
  }

  const threshold = unit(0.66 - input.creativity.associativeRange * 0.12 - input.creativity.cognitiveFlexibility * 0.08)

  const candidates = rankDreamSignals(
    sources.filter(source => source.rawScore >= threshold),
    { score: source => source.rawScore, key: source => source.key },
  )
    .slice(0, maxCandidates)
    .map(source => {
      const sourceMemoryIds = [source.memoryA.id, ...(source.memoryB ? [source.memoryB.id] : [])]
      const sourceTraceIds = [source.memoryA.traceId, ...(source.memoryB ? [source.memoryB.traceId] : [])]
      const sourcePatternKeys = source.pattern ? [source.pattern.key] : []
      const motifs = [
        ...memoryMotifs(source.memoryA),
        ...(source.memoryB ? memoryMotifs(source.memoryB) : []),
        ...(source.pattern ? patternMotifs(source.pattern) : []),
      ]
      const novelty = unit(
        stableHash01(source.key + ':dream:' + input.atTick) * 0.45
          + input.creativity.associativeRange * 0.35
          + input.creativity.noveltySeeking * 0.20,
      )

      return createDreamAssociation({
        npcId: input.memoryState.npcId,
        atTick: input.atTick,
        memoryIds: sourceMemoryIds,
        traceIds: sourceTraceIds,
        patternKeys: sourcePatternKeys,
        motifs,
        strength: source.rawScore,
        novelty,
        maxMotifs: 12,
      })
    })

  return {
    candidates,
    consideredMemoryIds: memories.map(memory => memory.id),
    consideredPatternKeys: patterns.map(pattern => pattern.key),
  }
}
