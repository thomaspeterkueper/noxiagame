// lib/game/cognition/personAffect.ts
// ADR: NOXIA-LIVING-0006 — deterministic affect layer (emotion, mood, pain)
//
// Affect sits between an authoritative event and a decision. It is a small
// numeric state per person, updated only by causal events and decayed lazily
// from `updatedTick`. No randomness, no LLM, no world truth is written here.
// Dialogue may read the *expressed* affect as a tone parameter; it never sets it.

import type {
  NeedCode,
  PersonNeed,
  PersonRelationship,
  PopulationAction,
  PopulationEvent,
} from '../population/types'

export const EMOTION_CODES = ['joy', 'fear', 'anger', 'sadness'] as const
export type EmotionCode = (typeof EMOTION_CODES)[number]

export interface AffectState {
  personId: string
  /** 0..1 each. Mixed emotions are allowed and expected. */
  joy: number
  fear: number
  anger: number
  sadness: number
  /** -1..1. Slow background average; survives individual emotions. */
  mood: number
  /** 0..1. Bodily signal, not an appraised emotion. */
  pain: number
  updatedTick: number | null
}

export interface AffectProfile {
  /** How strongly events register. */
  reactivity: number
  /** How quickly emotions fade. */
  recovery: number
  /** How much of the felt state is shown to others. */
  expressiveness: number
  /** Dampens pain intensity and its behavioural cost. */
  painTolerance: number
}

export type AffectDelta = Record<EmotionCode, number>

// One production tick is one hour (see population/socialLife.ts).
const EMOTION_HALF_LIFE_TICKS = 6
const MOOD_HALF_LIFE_TICKS = 96
const PAIN_HALF_LIFE_TICKS = 24
const MOOD_COUPLING = 0.18
const ROUTINE_ENCOUNTER_FLOOR = 0.15

const clamp01 = (value: number | undefined, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback
const clampSigned = (value: number): number =>
  Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0
const round = (value: number): number => Math.round(value * 1_000_000) / 1_000_000

export function affectProfileFromTraits(traits: Record<string, unknown> | null | undefined): AffectProfile {
  const read = (key: string, fallback: number) =>
    clamp01(typeof traits?.[key] === 'number' ? Number(traits[key]) : undefined, fallback)
  return {
    reactivity: read('affect_reactivity', 0.5),
    recovery: read('affect_recovery', 0.5),
    expressiveness: read('affect_expressiveness', 0.5),
    painTolerance: read('pain_tolerance', 0.5),
  }
}

export function neutralAffect(personId: string): AffectState {
  return { personId, joy: 0, fear: 0, anger: 0, sadness: 0, mood: 0, pain: 0, updatedTick: null }
}

function retained(elapsedTicks: number, halfLifeTicks: number): number {
  return Math.pow(0.5, elapsedTicks / halfLifeTicks)
}

/**
 * Lazy decay: state is only stored when an event changes it. Readers call this
 * with the current tick, so idle persons cost no writes.
 */
export function decayAffect(state: AffectState, tick: number, profile: AffectProfile): AffectState {
  if (state.updatedTick === null || tick <= state.updatedTick) return state
  const elapsed = tick - state.updatedTick
  // recovery 0 → twice the half-life, recovery 1 → half of it.
  const emotionHalfLife = EMOTION_HALF_LIFE_TICKS * Math.pow(2, 1 - 2 * clamp01(profile.recovery, 0.5))
  const keep = retained(elapsed, emotionHalfLife)
  return {
    ...state,
    joy: round(state.joy * keep),
    fear: round(state.fear * keep),
    anger: round(state.anger * keep),
    sadness: round(state.sadness * keep),
    mood: round(state.mood * retained(elapsed, MOOD_HALF_LIFE_TICKS)),
    pain: round(state.pain * retained(elapsed, PAIN_HALF_LIFE_TICKS)),
    updatedTick: tick,
  }
}

// ── Appraisal ───────────────────────────────────────────────────────────────

export interface AppraisalInput {
  /** -1..1: how far the event thwarts (-) or advances (+) what the person wants. */
  goalImpact: number
  /** 0..1: how much the person has at stake in it. */
  stakes: number
  /** 0..1: anticipated future harm, independent of harm already done. */
  threat?: number
  /** Another person brought it about. */
  causedByOther?: boolean
  /** That person meant to. Accidents frustrate; intent angers. */
  intentional?: boolean
  /** The loss cannot be recovered. Shifts anger towards sadness. */
  irreversible?: boolean
  /** Directed relationship towards the causer, if any. */
  causerTrust?: number
  causerAffinity?: number
  /** A previously feared outcome did not happen. */
  threatResolved?: boolean
}

/**
 * Appraisal is relative to the person: the same event yields different
 * emotions depending on stakes and on who caused it. Returns intensities to add.
 */
export function appraiseEvent(input: AppraisalInput, profile: AffectProfile): AffectDelta {
  const gain = 0.6 + 0.8 * clamp01(profile.reactivity, 0.5)
  const stakes = clamp01(input.stakes)
  const impact = clampSigned(input.goalImpact)
  const delta: AffectDelta = { joy: 0, fear: 0, anger: 0, sadness: 0 }

  if (impact > 0) delta.joy += impact * stakes
  if (input.threatResolved) delta.joy += 0.25 * stakes
  delta.fear += clamp01(input.threat) * stakes

  if (impact < 0) {
    const loss = -impact * stakes
    if (input.causedByOther && input.intentional) {
      const trust = clamp01(input.causerTrust, 0.5)
      const affinity = clamp01(input.causerAffinity, 0.5)
      // Harm from someone trusted weighs more than harm from a stranger.
      delta.anger += loss * (0.6 + 0.4 * trust) * (input.irreversible ? 0.7 : 1)
      delta.sadness += loss * (0.3 * affinity + (input.irreversible ? 0.6 : 0.1))
    } else {
      delta.sadness += loss * (input.irreversible ? 1 : 0.45)
      delta.anger += input.irreversible ? 0 : loss * 0.2
    }
  }

  return {
    joy: round(clamp01(delta.joy * gain)),
    fear: round(clamp01(delta.fear * gain)),
    anger: round(clamp01(delta.anger * gain)),
    sadness: round(clamp01(delta.sadness * gain)),
  }
}

export interface EventAppraisalContext {
  needs: Pick<PersonNeed, 'needCode' | 'satisfaction'>[]
  /** Directed relationship from the experiencing person to `relatedPersonId`. */
  relationship?: Pick<PersonRelationship, 'familiarity' | 'trust' | 'affinity'> | null
}

/**
 * 0..1: how much a meeting means. A new face or a close friend means a lot,
 * the daily meeting with a well-known colleague is routine.
 */
export function encounterMeaning(relationship: Pick<PersonRelationship, 'familiarity' | 'affinity'> | null | undefined): number {
  const { novelty, closeness } = encounterQualities(relationship)
  return Math.max(ROUTINE_ENCOUNTER_FLOOR, novelty, closeness)
}

/** The two things a meeting can give: something new, or someone close. Both 0..1. */
export function encounterQualities(relationship: Pick<PersonRelationship, 'familiarity' | 'affinity'> | null | undefined): { novelty: number; closeness: number } {
  return {
    novelty: 1 - clamp01(relationship?.familiarity),
    closeness: clamp01((clamp01(relationship?.affinity, 0.5) - 0.5) * 2),
  }
}

function pressure(needs: EventAppraisalContext['needs'], code: NeedCode): number {
  return 1 - clamp01(needs.find((need) => need.needCode === code)?.satisfaction, 1)
}

/**
 * Maps the event types already known to personSocialMemory onto an appraisal.
 * Unknown events deliberately produce no affect, mirroring the memory projection.
 */
export function appraisalFromPopulationEvent(
  event: Pick<PopulationEvent, 'eventType' | 'relatedPersonId' | 'payload'>,
  context: EventAppraisalContext,
): AppraisalInput | null {
  const rel = context.relationship ?? null
  const payload = event.payload ?? {}
  const num = (key: string, fallback: number) =>
    typeof payload[key] === 'number' ? clamp01(Number(payload[key])) : fallback
  const maxPressure = Math.max(0, ...context.needs.map((need) => 1 - clamp01(need.satisfaction, 1)))

  switch (event.eventType) {
    case 'npc_social_interaction':
    case 'social_interaction':
    case 'npc_met_person': {
      // NOXIA-LIVING-0008: a new face or a close friend is a pleasure; the daily
      // meeting with a well-known colleague is routine and brings little.
      return { goalImpact: 0.3 * encounterMeaning(rel), stakes: 0.3 + 0.7 * pressure(context.needs, 'social') }
    }
    case 'person_assistance':
    case 'npc_assistance':
      // Help matters most to someone who needed it.
      return { goalImpact: 0.65, stakes: 0.4 + 0.6 * maxPressure, threatResolved: maxPressure >= 0.5 }
    case 'shared_work':
      return { goalImpact: 0.3, stakes: 0.4 + 0.6 * pressure(context.needs, 'purpose') }
    case 'person_conflict':
    case 'npc_conflict':
      return {
        goalImpact: -0.65,
        stakes: 0.5 + 0.5 * clamp01(rel?.familiarity),
        causedByOther: Boolean(event.relatedPersonId),
        intentional: true,
        causerTrust: rel?.trust,
        causerAffinity: rel?.affinity,
      }
    case 'crisis_experience':
      return {
        goalImpact: -0.3,
        stakes: 0.5 + 0.5 * pressure(context.needs, 'safety'),
        threat: num('severity', 0.7),
      }
    case 'loss_experience':
      return {
        goalImpact: -1,
        stakes: Math.max(0.4, clamp01(rel?.affinity, 0.6)),
        irreversible: true,
      }
    default:
      return null
  }
}

/** Decays to `tick`, then adds the delta. Mood follows net valence slowly. */
export function applyAffect(state: AffectState, delta: AffectDelta, tick: number, profile: AffectProfile): AffectState {
  const base = decayAffect(state, tick, profile)
  const netValence = delta.joy - (delta.fear + delta.anger + delta.sadness) / 1.5
  return {
    ...base,
    joy: round(clamp01(base.joy + delta.joy)),
    fear: round(clamp01(base.fear + delta.fear)),
    anger: round(clamp01(base.anger + delta.anger)),
    sadness: round(clamp01(base.sadness + delta.sadness)),
    mood: round(clampSigned(base.mood + netValence * MOOD_COUPLING)),
    updatedTick: tick,
  }
}

// ── Pain ────────────────────────────────────────────────────────────────────

export type PainSource = 'workplace_accident' | 'environmental_exposure' | 'exhaustion'

const PAIN_FACTOR: Record<PainSource, number> = {
  workplace_accident: 1,
  environmental_exposure: 0.7,
  exhaustion: 0.35,
}

/** Pain is a signal from an explicit health event; nothing hurts without a cause. */
export function painFromHealthEvent(
  event: { eventType: PainSource; severity: number },
  profile: AffectProfile,
): number {
  const tolerance = clamp01(profile.painTolerance, 0.5)
  return round(clamp01(clamp01(event.severity) * PAIN_FACTOR[event.eventType] * (1 - 0.4 * tolerance)))
}

/**
 * Registers pain and its emotional echo. The echo runs through the normal
 * appraisal, so a person hurt by someone they trusted reacts differently from
 * one hurt by a machine.
 */
export function applyPain(
  state: AffectState,
  pain: number,
  tick: number,
  profile: AffectProfile,
  cause: Pick<AppraisalInput, 'causedByOther' | 'intentional' | 'causerTrust' | 'causerAffinity'> = {},
): AffectState {
  const intensity = clamp01(pain)
  const echo = appraiseEvent({ goalImpact: -intensity, stakes: 0.8, threat: intensity * 0.6, ...cause }, profile)
  const next = applyAffect(state, echo, tick, profile)
  return { ...next, pain: round(Math.max(next.pain, intensity)) }
}

export interface PainEffects {
  /** Multiplier for work output, 0.4..1. */
  workCapacity: number
  /** Added to rest pressure, 0..0.3. */
  restPressureBoost: number
  /** Feed into cognition/personReflex.evaluateReflex while pain is acute. */
  reflexStimulus: { kind: 'pain'; intensity: number; immediacy: number } | null
}

export function painEffects(state: AffectState, tick: number, profile: AffectProfile): PainEffects {
  const pain = decayAffect(state, tick, profile).pain
  const acute = state.updatedTick !== null && tick - state.updatedTick <= 1 && pain >= 0.2
  return {
    workCapacity: round(1 - 0.6 * pain),
    restPressureBoost: round(0.3 * pain),
    reflexStimulus: acute ? { kind: 'pain', intensity: pain, immediacy: 1 } : null,
  }
}

export interface PlaceAversion {
  locationId: string
  /** 0..1 at `learnedTick`. */
  strength: number
  learnedTick: number
}

const AVERSION_HALF_LIFE_TICKS = 720

/** A place where it hurt is remembered; weak pain teaches nothing. */
export function learnPlaceAversion(pain: number, locationId: string | null, tick: number): PlaceAversion | null {
  const strength = clamp01(pain)
  if (!locationId || strength < 0.3) return null
  return { locationId, strength: round(strength), learnedTick: tick }
}

/** Safety-pressure penalty (0..0.4) for being at a place that hurt before. */
export function placeSafetyPenalty(aversions: PlaceAversion[], locationId: string, tick: number): number {
  const strongest = aversions
    .filter((entry) => entry.locationId === locationId)
    .reduce((best, entry) => {
      const elapsed = Math.max(0, tick - entry.learnedTick)
      return Math.max(best, entry.strength * retained(elapsed, AVERSION_HALF_LIFE_TICKS))
    }, 0)
  return round(0.4 * strongest)
}

// ── Felt vs. shown ──────────────────────────────────────────────────────────

export interface ExpressedAffect {
  joy: number
  fear: number
  anger: number
  sadness: number
  pain: number
  dominant: EmotionCode | 'pain' | 'neutral'
}

/**
 * What an observer can perceive. Other persons and dialogue must use this, not
 * the felt state: hidden fear and misread calm are what make it read as human.
 */
export function expressedAffect(state: AffectState, profile: AffectProfile, audienceTrust = 0.5): ExpressedAffect {
  const expressiveness = clamp01(profile.expressiveness, 0.5)
  const trust = clamp01(audienceTrust, 0.5)
  const shown = 1 - (1 - expressiveness) * (1 - trust)
  const out = {
    joy: round(state.joy * (0.5 + 0.5 * shown)),
    fear: round(state.fear * shown),
    anger: round(state.anger * shown),
    sadness: round(state.sadness * shown),
    // The body gives pain away even when the person tries to hide it.
    pain: round(state.pain * (0.5 + 0.5 * shown)),
  }
  const ranked = (Object.entries(out) as [ExpressedAffect['dominant'], number][])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  return { ...out, dominant: ranked[0][1] >= 0.2 ? ranked[0][0] : 'neutral' }
}

// ── Effect on decisions and cognition ───────────────────────────────────────

/**
 * Bounded additive modifiers for population/decision.ts. Affect tilts a
 * choice; it does not override needs or domain validation.
 */
export function affectActionModifiers(state: AffectState): Partial<Record<PopulationAction, number>> {
  const { joy, fear, anger, sadness, pain, mood } = state
  return {
    work: round(0.08 * joy + 0.05 * mood - 0.18 * sadness - 0.3 * pain - 0.1 * fear),
    rest: round(0.15 * sadness + 0.3 * pain),
    travel_home: round(0.3 * fear + 0.1 * sadness + 0.1 * pain),
    travel_work: round(-0.15 * fear - 0.2 * pain),
    social_interaction: round(0.12 * sadness + 0.08 * joy - 0.15 * anger),
    seek_medical_care: round(0.35 * pain),
    inspect_problem: round(-0.15 * fear + 0.05 * joy),
    report_problem: round(0.12 * fear + 0.1 * anger),
  }
}

/** Input for personCognition.CognitiveStimulus.emotionalSalience. */
export function affectSalience(state: AffectState): number {
  return round(Math.max(state.joy, state.fear, state.anger, state.sadness, state.pain))
}
