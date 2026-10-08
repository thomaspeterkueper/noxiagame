import type { SensoryReception } from './sensoryLayer'
import type { EarlySocialLearningState, SocialSourceAssociation } from './earlySocialLearning'

export type SocialExpectationEventKind =
  | 'expected_source_absent'
  | 'familiar_source_changed'
  | 'unfamiliar_person_present'

export interface SocialExpectationEvent {
  kind: SocialExpectationEventKind
  sourceRef: string
  surprise: number
  distressDelta: number
  attentionShift: number
  searchTargetRef: string | null
  avoidanceBias: number
  reason: string
}

export interface ActiveSocialSearch {
  targetRef: string
  strength: number
  mode: 'orient' | 'vocalize' | 'approach'
}

const unit = (value: number | undefined, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback

function personSources(receptions: readonly SensoryReception[]) {
  return new Set(
    receptions
      .map(reception => reception.sourceRef)
      .filter(sourceRef => sourceRef.startsWith('person:')),
  )
}

function findAssociation(
  state: EarlySocialLearningState,
  sourceRef: string,
): SocialSourceAssociation | undefined {
  return state.sources.find(source => source.sourceRef === sourceRef)
}

/**
 * Developmental gate for stranger-specific caution.
 *
 * Familiarity discrimination can exist early, but a strong behavioural
 * "stranger anxiety" response should not be projected onto a newborn.
 * This is deliberately a smooth simulation policy, not a clinical age norm.
 */
export function strangerResponseCapacity(ageDays: number): number {
  const months = Math.max(0, ageDays) / 30.4375
  if (months < 2) return 0.05
  if (months < 5) return unit(0.05 + (months - 2) / 3 * 0.25)
  if (months < 9) return unit(0.30 + (months - 5) / 4 * 0.55)
  if (months < 18) return 0.85
  return 0.65
}

export function evaluateSocialExpectations(input: {
  state: EarlySocialLearningState
  receptions: readonly SensoryReception[]
  distressed: boolean
  ageDays: number
  changedSourceRefs?: readonly string[]
}): SocialExpectationEvent[] {
  const present = personSources(input.receptions)
  const changed = new Set(input.changedSourceRefs ?? [])
  const events: SocialExpectationEvent[] = []

  for (const association of input.state.sources) {
    const expected = unit(
      association.approachPreference * 0.35
        + association.responseReliability * 0.30
        + association.soothingExpectation * 0.20
        + association.familiarity * 0.15,
    )

    if (input.distressed && expected >= 0.48 && !present.has(association.sourceRef)) {
      const surprise = unit(expected * 0.72 + association.responseReliability * 0.28)
      events.push({
        kind: 'expected_source_absent',
        sourceRef: association.sourceRef,
        surprise,
        distressDelta: unit(surprise * 0.28),
        attentionShift: unit(surprise * 0.82),
        searchTargetRef: association.sourceRef,
        avoidanceBias: 0,
        reason: 'A highly expected regulation source is absent during distress.',
      })
    }

    if (present.has(association.sourceRef) && changed.has(association.sourceRef) && association.familiarity >= 0.45) {
      const surprise = unit(association.familiarity * 0.55 + association.safetyAssociation * 0.20 + association.responseReliability * 0.25)
      events.push({
        kind: 'familiar_source_changed',
        sourceRef: association.sourceRef,
        surprise,
        distressDelta: unit(surprise * 0.18),
        attentionShift: unit(surprise * 0.72),
        searchTargetRef: null,
        avoidanceBias: unit(surprise * 0.12),
        reason: 'A familiar social source no longer matches its learned pattern.',
      })
    }
  }

  const capacity = strangerResponseCapacity(input.ageDays)
  for (const sourceRef of present) {
    const association = findAssociation(input.state, sourceRef)
    const familiarity = association?.familiarity ?? 0
    if (familiarity >= 0.3) continue

    const novelty = unit(1 - familiarity)
    const surprise = unit(novelty * (0.35 + capacity * 0.45))
    events.push({
      kind: 'unfamiliar_person_present',
      sourceRef,
      surprise,
      distressDelta: unit(novelty * capacity * (input.distressed ? 0.28 : 0.14)),
      attentionShift: unit(novelty * (0.32 + capacity * 0.38)),
      searchTargetRef: null,
      avoidanceBias: unit(novelty * capacity * 0.52),
      reason: capacity < 0.2
        ? 'Unfamiliar person is noticed, but age strongly limits stranger-specific caution.'
        : 'Low familiarity combined with developed stranger-response capacity produces caution.',
    })
  }

  return events.sort((a, b) => b.surprise - a.surprise || a.sourceRef.localeCompare(b.sourceRef))
}

export function activeSocialSearch(events: readonly SocialExpectationEvent[], ageDays: number): ActiveSocialSearch | null {
  const absence = events
    .filter(event => event.kind === 'expected_source_absent' && event.searchTargetRef)
    .sort((a, b) => b.surprise - a.surprise || a.sourceRef.localeCompare(b.sourceRef))[0]

  if (!absence?.searchTargetRef) return null

  const motorDevelopment = unit(ageDays / (365 * 1.2))
  const strength = unit(absence.surprise * 0.75 + absence.attentionShift * 0.25)
  const mode: ActiveSocialSearch['mode'] =
    motorDevelopment >= 0.55 ? 'approach'
      : ageDays >= 60 ? 'vocalize'
        : 'orient'

  return {
    targetRef: absence.searchTargetRef,
    strength,
    mode,
  }
}
