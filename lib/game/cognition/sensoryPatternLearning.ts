import type { SensoryReception } from './sensoryLayer'

export interface SensoryPattern {
  key: string
  modality: SensoryReception['modality']
  sourceRef: string
  sourceClass: string
  occurrences: number
  familiarity: number
  meanIntensity: number
  meanClarity: number
  meanNovelty: number
  firstTick: number
  lastTick: number
}

export interface SensoryPatternState {
  patterns: SensoryPattern[]
}

const unit = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))

function sourceClass(reception: SensoryReception) {
  const value = reception.features.sourceClass
  return typeof value === 'string' && value ? value : 'unspecified'
}

export function sensoryPatternKey(reception: SensoryReception) {
  return [reception.modality, reception.sourceRef, sourceClass(reception)].join('|')
}

/**
 * Cheap statistical learning path for recurring sensory structure.
 * It runs before episodic habituation: "not worth a new episode" does not mean
 * "the nervous system learned nothing from this repetition".
 */
export function learnSensoryPatterns(
  state: SensoryPatternState,
  receptions: readonly SensoryReception[],
): SensoryPatternState {
  const byKey = new Map(state.patterns.map(pattern => [pattern.key, { ...pattern }]))

  for (const reception of receptions) {
    const key = sensoryPatternKey(reception)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, {
        key,
        modality: reception.modality,
        sourceRef: reception.sourceRef,
        sourceClass: sourceClass(reception),
        occurrences: 1,
        familiarity: unit(0.08 + reception.clarity * 0.12),
        meanIntensity: reception.receivedIntensity,
        meanClarity: reception.clarity,
        meanNovelty: reception.novelty,
        firstTick: reception.atTick,
        lastTick: reception.atTick,
      })
      continue
    }

    const n = existing.occurrences + 1
    const familiarityGain = (1 - existing.familiarity) * (0.025 + reception.clarity * 0.035)
    byKey.set(key, {
      ...existing,
      occurrences: n,
      familiarity: unit(existing.familiarity + familiarityGain),
      meanIntensity: existing.meanIntensity + (reception.receivedIntensity - existing.meanIntensity) / n,
      meanClarity: existing.meanClarity + (reception.clarity - existing.meanClarity) / n,
      meanNovelty: existing.meanNovelty + (reception.novelty - existing.meanNovelty) / n,
      lastTick: reception.atTick,
    })
  }

  return {
    patterns: [...byKey.values()].sort((a, b) =>
      b.familiarity - a.familiarity
        || b.occurrences - a.occurrences
        || a.key.localeCompare(b.key),
    ),
  }
}
