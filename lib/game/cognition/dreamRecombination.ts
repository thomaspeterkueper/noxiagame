import { memoriesAreIndependent, type NpcMemory, type NpcMemoryState } from './npcRelationalMemory'
import type { RelationalTrace } from './relationalWorldRuntime'
import type { SensoryPattern } from './sensoryPatternLearning'
import type { CreativityProfile } from '../personCognition'

export interface DreamAssociation {
  id: string
  npcId: string
  sourceMemoryIds: string[]
  sourceTraceIds: string[]
  sourcePatternKeys: string[]
  motifs: string[]
  associationStrength: number
  novelty: number
  createdAtTick: number
  provenance: 'dream_recombination'
  canonical: false
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

function memoryMotifs(memory: NpcMemory): string[] {
  const value = memory.rememberedValue
  const motifs = [memory.attribute, memory.subjectRef]
  if (typeof value === 'string' && value.trim()) motifs.push(value.trim())
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const object = value as Record<string, unknown>
    const features = object.features
    if (features && typeof features === 'object' && !Array.isArray(features)) {
      for (const [key, feature] of Object.entries(features as Record<string, unknown>)) {
        if (typeof feature === 'string' || typeof feature === 'number' || typeof feature === 'boolean') {
          motifs.push(key + ':' + String(feature))
        }
      }
    }
  }
  return [...new Set(motifs)].slice(0, 8)
}

function patternMotifs(pattern: SensoryPattern): string[] {
  return [pattern.modality, pattern.sourceClass, pattern.sourceRef]
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

  const memories = input.memoryState.memories
    .filter(memory => memory.state !== 'forgotten')
    .slice()
    .sort((a, b) => memoryScore(b) - memoryScore(a) || a.id.localeCompare(b.id))
    .slice(0, maxMemories)

  const patterns = input.patterns
    .slice()
    .sort((a, b) => patternScore(b) - patternScore(a) || a.key.localeCompare(b.key))
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

  const candidates = sources
    .filter(source => source.rawScore >= threshold)
    .sort((a, b) => b.rawScore - a.rawScore || a.key.localeCompare(b.key))
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

      return {
        id: 'dream-association:' + input.memoryState.npcId + ':' + input.atTick + ':' + stableHash01(source.key).toFixed(5),
        npcId: input.memoryState.npcId,
        sourceMemoryIds,
        sourceTraceIds,
        sourcePatternKeys,
        motifs: [...new Set(motifs)].slice(0, 12),
        associationStrength: source.rawScore,
        novelty,
        createdAtTick: input.atTick,
        provenance: 'dream_recombination' as const,
        canonical: false as const,
      }
    })

  return {
    candidates,
    consideredMemoryIds: memories.map(memory => memory.id),
    consideredPatternKeys: patterns.map(pattern => pattern.key),
  }
}
