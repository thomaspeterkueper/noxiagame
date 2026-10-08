// lib/game/population/relationshipDynamics.ts
// NOXIA-LIVING-0008 — how relationships grow, saturate and fade.
//
// Before this, every neutral encounter added a fixed amount, so every pair that
// kept meeting ended at the maximum within weeks and nothing ever faded.
// Now:
// - growth is an exponential approach to a ceiling, so the hundredth encounter
//   adds far less than the first;
// - the ceiling depends on the tier: most people stay acquaintances, only a few
//   slots per person allow a deep friendship, a partner can go all the way;
// - without contact, values fade back towards neutral.
// Everything is pure and deterministic.

import type { PersonRelationship } from './types'

export type RelationshipTier = 'acquaintance' | 'close' | 'partner'

/** How many deep friendships one person can sustain besides a partner. */
export const CLOSE_SLOTS = 4

export const TIER_CEILING: Record<RelationshipTier, { trust: number; affinity: number }> = {
  // Deliberately below the friendship thresholds of population/socialLife.ts (0.56 / 0.58).
  acquaintance: { trust: 0.55, affinity: 0.55 },
  close: { trust: 0.85, affinity: 0.85 },
  partner: { trust: 1, affinity: 1 },
}

/** Ticks (game hours) without contact until half of the distance to neutral is lost. */
export const FADE_HALF_LIFE_TICKS: Record<RelationshipTier, number> = {
  acquaintance: 24 * 30,
  close: 24 * 120,
  partner: 24 * 360,
}
const FAMILIARITY_HALF_LIFE_TICKS = 24 * 180
/** A value above its ceiling (after losing a close slot) settles back this fast. */
const OVER_CEILING_HALF_LIFE_TICKS = 24 * 7

const NEUTRAL_TRUST = 0.5
const NEUTRAL_AFFINITY = 0.5
/** Converts the linear deltas of personSocialMemory into a share of the remaining headroom. */
const TRUST_GAIN = 4
const AFFINITY_GAIN = 10

const clamp01 = (value: number): number => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
const round = (value: number): number => Math.round(value * 1_000_000) / 1_000_000

function hash(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * 0..1, symmetric and stable per pair: how well two people get on. It scales how
 * fast affinity grows, so some colleagues click and others stay polite, and it
 * decides who gets a close slot when several relationships are otherwise equal.
 */
export function pairCompatibility(a: string, b: string): number {
  const [first, second] = a.localeCompare(b) <= 0 ? [a, b] : [b, a]
  return (hash(`compat:${first}|${second}`) % 1001) / 1000
}

export function bondScore(relation: Pick<PersonRelationship, 'familiarity' | 'trust' | 'affinity'>): number {
  return relation.affinity * 0.5 + relation.trust * 0.3 + relation.familiarity * 0.2
}

function ranked(relations: readonly PersonRelationship[]): PersonRelationship[] {
  return relations
    .filter((relation) => relation.relationshipType !== 'partner')
    .map((relation) => ({ relation, score: bondScore(relation), compatibility: pairCompatibility(relation.personId, relation.otherPersonId) }))
    .sort((a, b) => (b.score - a.score) || (b.compatibility - a.compatibility) || a.relation.otherPersonId.localeCompare(b.relation.otherPersonId))
    .map((entry) => entry.relation)
}

/** A close slot also needs real acquaintance: a stranger does not become a close friend by default. */
const CLOSE_MIN_FAMILIARITY = 0.3

/**
 * Tiers of all relationships of one person, keyed by the other person's id.
 * The strongest bonds take the close slots; everyone else stays an acquaintance.
 */
export function relationshipTiers(relations: readonly PersonRelationship[]): Map<string, RelationshipTier> {
  const tiers = new Map<string, RelationshipTier>()
  for (const relation of relations) if (relation.relationshipType === 'partner') tiers.set(relation.otherPersonId, 'partner')
  ranked(relations).forEach((relation, rank) => {
    tiers.set(relation.otherPersonId, rank < CLOSE_SLOTS && relation.familiarity >= CLOSE_MIN_FAMILIARITY ? 'close' : 'acquaintance')
  })
  return tiers
}

/**
 * Tier of one directed relationship among all relationships of the same person.
 * `peers` may or may not contain `relation` itself. Without peers a relationship
 * can only be a partner, or close once it is familiar enough.
 */
export function relationshipTier(relation: PersonRelationship, peers: readonly PersonRelationship[] = []): RelationshipTier {
  if (relation.relationshipType === 'partner') return 'partner'
  const others = peers.filter((peer) => peer.otherPersonId !== relation.otherPersonId)
  return relationshipTiers([...others, relation]).get(relation.otherPersonId) ?? 'acquaintance'
}

/** All relationships of one person as they stand at `tick`. */
export function fadeRelationships(relations: readonly PersonRelationship[], tick: number): PersonRelationship[] {
  const tiers = relationshipTiers(relations)
  return relations.map((relation) => fadeRelationship(relation, tick, tiers.get(relation.otherPersonId) ?? 'acquaintance'))
}

const retained = (elapsed: number, halfLife: number): number => Math.pow(0.5, elapsed / halfLife)

/**
 * The relationship as it stands at `tick`, given the time since the last contact.
 * Stored rows are only rewritten on contact; readers call this to see the faded state.
 */
export function fadeRelationship(relation: PersonRelationship, tick: number, tier: RelationshipTier = relationshipTier(relation)): PersonRelationship {
  if (relation.lastInteractionTick == null || tick <= relation.lastInteractionTick) return relation
  const elapsed = tick - relation.lastInteractionTick
  const keep = retained(elapsed, FADE_HALF_LIFE_TICKS[tier])
  const settle = (value: number, neutral: number, ceiling: number): number => {
    const faded = neutral + (value - neutral) * keep
    return faded > ceiling ? ceiling + (faded - ceiling) * retained(elapsed, OVER_CEILING_HALF_LIFE_TICKS) : faded
  }
  return {
    ...relation,
    familiarity: round(clamp01(relation.familiarity * retained(elapsed, FAMILIARITY_HALF_LIFE_TICKS))),
    trust: round(clamp01(settle(relation.trust, NEUTRAL_TRUST, TIER_CEILING[tier].trust))),
    affinity: round(clamp01(settle(relation.affinity, NEUTRAL_AFFINITY, TIER_CEILING[tier].affinity))),
  }
}

/** Positive change: exponential approach to the ceiling. Negative change: applied in full. */
function towards(value: number, delta: number, ceiling: number, gain: number): number {
  if (delta <= 0) return clamp01(value + delta)
  if (value >= ceiling) return value
  return value + (ceiling - value) * (1 - Math.exp(-gain * delta))
}

export interface RelationshipExperience {
  tick: number
  salience: number
  /** Linear deltas as produced by personSocialMemory (already weighted by salience). */
  trustDelta: number
  affinityDelta: number
}

/**
 * Applies one shared experience. `relation` must already be faded to `experience.tick`.
 * Good experiences saturate; a conflict or betrayal always lands with full force.
 */
export function growRelationship(relation: PersonRelationship, experience: RelationshipExperience, tier: RelationshipTier): PersonRelationship {
  const salience = clamp01(experience.salience)
  const compatibility = pairCompatibility(relation.personId, relation.otherPersonId)
  const affinityDelta = experience.affinityDelta > 0 ? experience.affinityDelta * (0.5 + compatibility) : experience.affinityDelta
  return {
    ...relation,
    familiarity: round(clamp01(relation.familiarity + (1 - relation.familiarity) * (0.04 + salience * 0.12))),
    trust: round(towards(relation.trust, experience.trustDelta, TIER_CEILING[tier].trust, TRUST_GAIN)),
    affinity: round(towards(relation.affinity, affinityDelta, TIER_CEILING[tier].affinity, AFFINITY_GAIN)),
    lastInteractionTick: Math.max(relation.lastInteractionTick ?? 0, experience.tick),
  }
}
