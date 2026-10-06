// lib/game/personCognition.ts
// Deterministic cognitive scheduler for persistent NOXIA persons.
// Cheap by default: routine and sleep never require an external model.

export type CognitiveMode = 'sleep' | 'routine' | 'reactive' | 'deliberative' | 'exploratory' | 'contemplative' | 'insight'

export interface CreativityProfile {
  noveltySeeking: number
  associativeRange: number
  routineStability: number
  cognitiveFlexibility: number
  ideaThreshold: number
}

export interface CognitiveStimulus {
  novelty?: number
  surprise?: number
  goalConflict?: number
  emotionalSalience?: number
  uncertainty?: number
  socialSalience?: number
}

export interface CognitiveStateInput {
  sleeping: boolean
  creativity: CreativityProfile
  stimulus?: CognitiveStimulus
  unresolvedProblem?: boolean
  expertise?: number
  reflectiveState?: 'none' | 'dream' | 'meditation' | 'deep_work'
}

export interface CognitiveState {
  mode: CognitiveMode
  triggerScore: number
  computeTier: 0 | 1 | 2 | 3
  allowExternalInference: boolean
  reason: string
}

const clamp01 = (v: number | undefined, fallback = 0) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback

export function creativityFromTraits(traits: Record<string, unknown> | null | undefined): CreativityProfile {
  const c = clamp01(Number(traits?.creativity), 0.5)
  return {
    noveltySeeking: clamp01(Number(traits?.novelty_seeking), c),
    associativeRange: clamp01(Number(traits?.associative_range), c),
    routineStability: clamp01(Number(traits?.routine_stability), 1 - c * 0.45),
    cognitiveFlexibility: clamp01(Number(traits?.cognitive_flexibility), c),
    ideaThreshold: clamp01(Number(traits?.idea_threshold), 0.78 - c * 0.28),
  }
}

export function cognitiveTriggerScore(stimulus: CognitiveStimulus = {}, creativity?: CreativityProfile): number {
  const c = creativity ?? creativityFromTraits(null)
  const weighted =
    clamp01(stimulus.novelty) * 0.22 +
    clamp01(stimulus.surprise) * 0.18 +
    clamp01(stimulus.goalConflict) * 0.20 +
    clamp01(stimulus.emotionalSalience) * 0.16 +
    clamp01(stimulus.uncertainty) * 0.14 +
    clamp01(stimulus.socialSalience) * 0.10
  // Creative persons notice novelty sooner; stable routines resist interruption.
  return clamp01(weighted * (0.85 + c.noveltySeeking * 0.30) - c.routineStability * 0.08)
}

export function selectCognitiveState(input: CognitiveStateInput): CognitiveState {
  if (input.sleeping) return { mode: 'sleep', triggerScore: 0, computeTier: 0, allowExternalInference: false, reason: 'Sleep suppresses active cognition; consolidation runs separately.' }

  const triggerScore = cognitiveTriggerScore(input.stimulus, input.creativity)
  if (triggerScore < 0.24) return { mode: 'routine', triggerScore, computeTier: 0, allowExternalInference: false, reason: 'Known situation remains below interruption threshold.' }
  if (triggerScore < 0.48) return { mode: 'reactive', triggerScore, computeTier: 1, allowExternalInference: false, reason: 'Routine interrupted; deterministic local response is sufficient.' }
  if (triggerScore < 0.70) return { mode: 'deliberative', triggerScore, computeTier: 2, allowExternalInference: false, reason: 'Competing goals or uncertainty require bounded planning.' }

  const reflectiveBoost = input.reflectiveState === 'dream' || input.reflectiveState === 'meditation' ? 0.12 : input.reflectiveState === 'deep_work' ? 0.08 : 0
  const insightScore = clamp01(
    triggerScore * 0.35 +
    input.creativity.associativeRange * 0.25 +
    input.creativity.cognitiveFlexibility * 0.15 +
    clamp01(input.expertise) * 0.20 +
    reflectiveBoost,
  )

  if (input.unresolvedProblem && insightScore >= input.creativity.ideaThreshold) {
    return { mode: 'insight', triggerScore, computeTier: 3, allowExternalInference: false, reason: 'Rare insight candidate: may request bounded inspiration, never canonical truth.' }
  }
  return { mode: 'exploratory', triggerScore, computeTier: 2, allowExternalInference: false, reason: 'Novel situation benefits from deterministic exploration before escalation.' }
}

export interface MemoryForConsolidation {
  id: string
  salience: number
  valence: number
  tick: number
  summary: string
}

export interface ConsolidatedMemory {
  id: string
  retention: number
  replayPriority: number
}

export function consolidateMemories(memories: MemoryForConsolidation[], currentTick: number): ConsolidatedMemory[] {
  return memories
    .map((m) => {
      const age = Math.max(0, currentTick - m.tick)
      const recency = 1 / (1 + age / 240)
      const emotion = Math.min(1, Math.abs(m.valence))
      const retention = clamp01(m.salience * 0.58 + emotion * 0.22 + recency * 0.20)
      return { id: m.id, retention, replayPriority: clamp01(retention * (0.8 + emotion * 0.2)) }
    })
    .sort((a, b) => b.replayPriority - a.replayPriority || a.id.localeCompare(b.id))
}

export interface InsightCandidate {
  problemRef: string
  inspirationRefs: string[]
  hypothesis: string
  confidence: number
  provenance: 'dream_recombination' | 'meditation_recombination' | 'knowledge_gateway'
  canonical: false
}

// The gateway accepts only already-selected references. It never grants direct KG/OTA truth.
export function createInsightCandidate(input: Omit<InsightCandidate, 'canonical'>): InsightCandidate {
  return { ...input, confidence: clamp01(input.confidence), canonical: false }
}
