// lib/game/population/socialFriction.ts
// NOXIA-LIVING-0009 — where friction and help between people come from.
//
// A meeting is not always pleasant. How it goes depends on the state of the two
// people (tired, hungry, bored, in pain, angry), on how well they get on, and on
// whether the settlement is short of supplies. The outcome is deterministic:
// the "draw" is a hash of tick and pair, so the same state replays identically.

import type { AffectState } from '../cognition/personAffect'
import type { NeedCode } from './types'

export type EncounterOutcome =
  | { kind: 'neutral' }
  | { kind: 'conflict'; tension: number }
  | { kind: 'assistance'; helperId: string; recipientId: string }

export interface FrictionPerson {
  id: string
  /** Satisfaction 0..1 per need. Missing needs count as satisfied. */
  needs: Partial<Record<NeedCode, number>>
  /** Felt affect, decayed to the current tick. */
  affect?: Pick<AffectState, 'anger' | 'pain' | 'mood' | 'fear'> | null
}

const clamp01 = (value: number | undefined, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback
const round = (value: number): number => Math.round(value * 1_000_000) / 1_000_000
const pressure = (person: FrictionPerson, code: NeedCode): number => 1 - clamp01(person.needs[code], 1)

function hash(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Deterministic number in [0, 1) for a tick and an unordered pair. */
export function pairDraw(tick: number, a: string, b: string, salt = 'encounter'): number {
  const [first, second] = a.localeCompare(b) <= 0 ? [a, b] : [b, a]
  return hash(`${salt}:${tick}:${first}|${second}`) / 4294967296
}

/**
 * 0..1: how thin-skinned a person is right now. Exhaustion, hunger, monotony,
 * pain, anger and a low mood add up; scarcity makes everyone tenser.
 */
export function irritability(person: FrictionPerson, supply = 1): number {
  const affect = person.affect
  const value =
    0.22 * pressure(person, 'rest') +
    0.22 * pressure(person, 'sustenance') +
    0.18 * pressure(person, 'variety') +
    0.15 * pressure(person, 'safety') +
    0.2 * clamp01(affect?.anger) +
    0.2 * clamp01(affect?.pain) +
    0.2 * clamp01(-(affect?.mood ?? 0)) +
    0.2 * (1 - clamp01(supply, 1))
  return round(clamp01(value))
}

/** The strongest bodily need of a person: someone who could use help. */
export function neediness(person: FrictionPerson): number {
  return round(Math.max(pressure(person, 'rest'), pressure(person, 'sustenance'), clamp01(person.affect?.pain)))
}

export interface EncounterOutcomeInput {
  tick: number
  a: FrictionPerson
  b: FrictionPerson
  /** relationshipDynamics.pairCompatibility */
  compatibility: number
  /** Faded affinity of each towards the other; 0.5 when they do not know each other. */
  affinityAB?: number
  affinityBA?: number
  /** 0..1 supply of the settlement. */
  supply?: number
}

export interface EncounterOdds {
  conflict: number
  assistance: number
}

/** Probabilities behind `encounterOutcome`, exposed for the decision trace and for tests. */
export function encounterOdds(input: EncounterOutcomeInput): EncounterOdds {
  const supply = clamp01(input.supply, 1)
  const tension = (irritability(input.a, supply) + irritability(input.b, supply)) / 2
  const incompatibility = 1 - clamp01(input.compatibility, 0.5)
  const closeness = clamp01(((clamp01(input.affinityAB, 0.5) + clamp01(input.affinityBA, 0.5)) / 2 - 0.5) * 2)
  // People who already dislike each other clash more easily.
  const dislike = clamp01((0.5 - (clamp01(input.affinityAB, 0.5) + clamp01(input.affinityBA, 0.5)) / 2) * 2)
  const conflict = clamp01(
    (0.004 + 0.6 * tension * tension) * (0.4 + incompatibility) * (1 - 0.6 * closeness) * (1 + dislike) +
    0.3 * (1 - supply) * tension,
  )
  const need = Math.max(neediness(input.a), neediness(input.b))
  const goodwill = 0.3 + 0.4 * clamp01(input.compatibility, 0.5) + 0.3 * closeness
  // Under scarcity people have less to give.
  const assistance = need >= 0.4 ? clamp01(0.45 * need * goodwill * (0.4 + 0.6 * supply)) : 0
  return { conflict: round(conflict), assistance: round(Math.min(assistance, 1 - conflict)) }
}

/** How a meeting of two people goes. Deterministic for equal input. */
export function encounterOutcome(input: EncounterOutcomeInput): EncounterOutcome {
  const odds = encounterOdds(input)
  const draw = pairDraw(input.tick, input.a.id, input.b.id)
  if (draw < odds.conflict) {
    const supply = clamp01(input.supply, 1)
    return { kind: 'conflict', tension: round((irritability(input.a, supply) + irritability(input.b, supply)) / 2) }
  }
  if (draw < odds.conflict + odds.assistance) {
    const aNeedy = neediness(input.a), bNeedy = neediness(input.b)
    const recipient = aNeedy > bNeedy || (aNeedy === bNeedy && input.a.id.localeCompare(input.b.id) <= 0) ? input.a : input.b
    const helper = recipient === input.a ? input.b : input.a
    return { kind: 'assistance', helperId: helper.id, recipientId: recipient.id }
  }
  return { kind: 'neutral' }
}

/** Event type each side records for an outcome. */
export function encounterEventType(outcome: EncounterOutcome, actorId: string): 'social_interaction' | 'person_conflict' | 'person_assistance' {
  if (outcome.kind === 'conflict') return 'person_conflict'
  if (outcome.kind === 'assistance' && outcome.recipientId === actorId) return 'person_assistance'
  return 'social_interaction'
}

/** All event types an encounter between two people can be stored as. */
export const ENCOUNTER_EVENT_TYPES: readonly string[] = ['social_interaction', 'person_conflict', 'person_assistance']
