import type { SensoryReception } from './sensoryLayer'
import type { SensoryPattern } from './sensoryPatternLearning'

export interface RegulationEpisode {
  tick: number
  sourceRef: string
  distressBefore: number
  distressAfter: number
  safetyBefore?: number
  safetyAfter?: number
  needRelief?: number
}

export interface SocialSourceAssociation {
  sourceRef: string
  familiarity: number
  coRegulationCount: number
  responseOpportunities: number
  responseReliability: number
  soothingExpectation: number
  safetyAssociation: number
  attentionBias: number
  approachPreference: number
  lastUpdatedTick: number
}

export interface EarlySocialLearningState {
  sources: SocialSourceAssociation[]
}

const unit = (value: number | undefined, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback

function isPersonSource(sourceRef: string) {
  return sourceRef.startsWith('person:')
}

function sourceFamiliarity(patterns: readonly SensoryPattern[], sourceRef: string) {
  const relevant = patterns.filter(pattern => pattern.sourceRef === sourceRef)
  if (!relevant.length) return 0
  const weighted = relevant.reduce((sum, pattern) => {
    const recurrenceWeight = Math.min(1, pattern.occurrences / 20)
    return sum + pattern.familiarity * (0.55 + recurrenceWeight * 0.45)
  }, 0)
  return unit(weighted / relevant.length)
}

function presentPersonSources(receptions: readonly SensoryReception[]) {
  return [...new Set(
    receptions
      .map(reception => reception.sourceRef)
      .filter(isPersonSource),
  )]
}

/**
 * Learns source-specific early social expectations from lived co-regulation.
 *
 * This is intentionally not an attachment-style diagnosis. It models only the
 * preconditions that later attachment behaviour may build on: familiarity,
 * reliable response, soothing, safety association and attention preference.
 */
export function updateEarlySocialLearning(input: {
  state: EarlySocialLearningState
  receptions: readonly SensoryReception[]
  patterns: readonly SensoryPattern[]
  regulationEpisodes?: readonly RegulationEpisode[]
  distressed?: boolean
  atTick: number
}): EarlySocialLearningState {
  const previous = new Map(input.state.sources.map(source => [source.sourceRef, { ...source }]))
  const presentSources = presentPersonSources(input.receptions)
  const episodes = input.regulationEpisodes ?? []

  for (const sourceRef of presentSources) {
    const old = previous.get(sourceRef) ?? {
      sourceRef,
      familiarity: 0,
      coRegulationCount: 0,
      responseOpportunities: 0,
      responseReliability: 0.5,
      soothingExpectation: 0,
      safetyAssociation: 0,
      attentionBias: 0,
      approachPreference: 0,
      lastUpdatedTick: input.atTick,
    }

    const familiarity = Math.max(old.familiarity, sourceFamiliarity(input.patterns, sourceRef))
    const relevantEpisodes = episodes.filter(episode => episode.sourceRef === sourceRef)
    const positive = relevantEpisodes.filter(episode =>
      episode.distressAfter < episode.distressBefore
      || unit(episode.needRelief) > 0
      || unit(episode.safetyAfter) > unit(episode.safetyBefore),
    )

    const opportunities = old.responseOpportunities + (input.distressed ? 1 : 0)
    const coRegulationCount = old.coRegulationCount + positive.length

    let responseReliability = old.responseReliability
    if (input.distressed) {
      const responded = positive.length > 0
      const observationWeight = 1 / Math.min(12, Math.max(2, opportunities + 1))
      responseReliability = unit(old.responseReliability * (1 - observationWeight) + (responded ? 1 : 0) * observationWeight)
    }

    let soothingExpectation = old.soothingExpectation
    let safetyAssociation = old.safetyAssociation
    for (const episode of relevantEpisodes) {
      const relief = unit(
        Math.max(0, episode.distressBefore - episode.distressAfter)
          + unit(episode.needRelief) * 0.45,
      )
      const safetyGain = unit(Math.max(0, unit(episode.safetyAfter) - unit(episode.safetyBefore)))
      soothingExpectation = unit(soothingExpectation + (1 - soothingExpectation) * relief * 0.22)
      safetyAssociation = unit(safetyAssociation + (1 - safetyAssociation) * (relief * 0.12 + safetyGain * 0.28))
    }

    // Attention preference is derived, not independently awarded.
    const attentionBias = unit(
      familiarity * 0.34
        + soothingExpectation * 0.30
        + safetyAssociation * 0.20
        + responseReliability * 0.16,
    )
    const approachPreference = unit(
      familiarity * 0.24
        + soothingExpectation * 0.32
        + safetyAssociation * 0.26
        + responseReliability * 0.18,
    )

    previous.set(sourceRef, {
      sourceRef,
      familiarity,
      coRegulationCount,
      responseOpportunities: opportunities,
      responseReliability,
      soothingExpectation,
      safetyAssociation,
      attentionBias,
      approachPreference,
      lastUpdatedTick: input.atTick,
    })
  }

  // Distress creates a weak negative prediction update for already-familiar
  // person sources that were expected but absent. This lets reliability depend
  // on actual history rather than familiarity alone.
  if (input.distressed) {
    const present = new Set(presentSources)
    for (const [sourceRef, old] of previous.entries()) {
      if (present.has(sourceRef) || old.familiarity < 0.35) continue
      previous.set(sourceRef, {
        ...old,
        responseOpportunities: old.responseOpportunities + 1,
        responseReliability: unit(old.responseReliability * 0.985),
        soothingExpectation: unit(old.soothingExpectation * 0.997),
        attentionBias: unit(old.attentionBias * 0.998),
        approachPreference: unit(old.approachPreference * 0.998),
        lastUpdatedTick: input.atTick,
      })
    }
  }

  return {
    sources: [...previous.values()].sort((a, b) =>
      b.approachPreference - a.approachPreference
        || b.familiarity - a.familiarity
        || a.sourceRef.localeCompare(b.sourceRef),
    ),
  }
}

export function preferredSocialSource(state: EarlySocialLearningState): SocialSourceAssociation | null {
  return state.sources
    .slice()
    .sort((a, b) => b.approachPreference - a.approachPreference || a.sourceRef.localeCompare(b.sourceRef))[0] ?? null
}
