import { memoryFromPopulationEvent, projectRelationship } from '../personSocialMemory'
import { appraisalFromPopulationEvent } from '../cognition/personAffect'
import { CLOSE_SLOTS, FADE_HALF_LIFE_TICKS, TIER_CEILING, fadeRelationship, fadeRelationships, pairCompatibility, relationshipTier, relationshipTiers } from './relationshipDynamics'
import type { PersonRelationship, PopulationEvent } from './types'

let failures = 0
const check = (ok: boolean, label: string) => { if (!ok) { failures++; console.error('FAIL: ' + label) } }

const event = (tick: number, eventType = 'social_interaction', other = 'b'): PopulationEvent =>
  ({ id: `e${tick}:${eventType}:${other}`, tick, eventType, actorPersonId: 'a', relatedPersonId: other, locationId: 'loc', subjectType: 'person', subjectRef: other, payload: {} })
const meet = (current: PersonRelationship | null, tick: number, peers: PersonRelationship[] = [], eventType = 'social_interaction', other = 'b') =>
  projectRelationship(current, memoryFromPopulationEvent(event(tick, eventType, other))!, peers)!
const rel = (other: string, values: Partial<PersonRelationship> = {}): PersonRelationship =>
  ({ id: `r:a:${other}`, personId: 'a', otherPersonId: other, relationshipType: 'acquaintance', familiarity: 0.9, trust: 0.5, affinity: 0.5, lastInteractionTick: 0, ...values })

// Diminishing returns: exponential approach to a ceiling.
const stronger = Array.from({ length: CLOSE_SLOTS }, (_, i) => rel(`friend-${i}`, { trust: 0.8, affinity: 0.8 }))
let acquaintance: PersonRelationship | null = null
const gains: number[] = []
for (let i = 0; i < 200; i++) {
  const before: number = acquaintance?.trust ?? 0.5
  acquaintance = meet(acquaintance, i * 12, stronger)
  gains.push(acquaintance.trust - before)
}
check(gains[0] > 0 && gains[20] < gains[0] * 0.5 && gains[100] < gains[0] * 0.05, 'the hundredth encounter adds far less than the first')
check(gains.every((gain, i) => i === 0 || gain <= gains[i - 1] + 1e-9), 'each further encounter adds no more than the one before')
check(acquaintance!.trust < TIER_CEILING.acquaintance.trust + 1e-9 && acquaintance!.affinity < TIER_CEILING.acquaintance.affinity + 1e-9, 'an acquaintance never exceeds the acquaintance ceiling')
check(acquaintance!.trust > 0.52 && acquaintance!.familiarity > 0.95, 'but becomes well known and mildly trusted')

// Deep friendship: only a few slots.
let close: PersonRelationship | null = null
for (let i = 0; i < 200; i++) close = meet(close, i * 12)
check(close!.trust > TIER_CEILING.acquaintance.trust && close!.trust <= TIER_CEILING.close.trust + 1e-9, 'a close tie grows past the acquaintance ceiling up to the close ceiling')
const many = Array.from({ length: 12 }, (_, i) => rel(`p-${i}`, { trust: 0.5 + i * 0.01, affinity: 0.5 + i * 0.01 }))
const tiers = relationshipTiers(many)
check([...tiers.values()].filter((tier) => tier === 'close').length === CLOSE_SLOTS, 'only a few relationships can be close at once')
check(tiers.get('p-11') === 'close' && tiers.get('p-0') === 'acquaintance', 'the strongest bonds hold the close slots')
check(relationshipTier(rel('new', { familiarity: 0.1, trust: 0.9, affinity: 0.9 })) === 'acquaintance', 'a near stranger cannot be a close friend')
const equal = Array.from({ length: 8 }, (_, i) => rel(`q-${i}`))
const equalClose = [...relationshipTiers(equal).entries()].filter(([, tier]) => tier === 'close').map(([id]) => id)
const byCompat = [...equal].sort((x, y) => pairCompatibility('a', y.otherPersonId) - pairCompatibility('a', x.otherPersonId)).slice(0, CLOSE_SLOTS).map((r) => r.otherPersonId)
check(JSON.stringify([...equalClose].sort()) === JSON.stringify([...byCompat].sort()), 'between equal bonds, compatibility decides')
check(pairCompatibility('a', 'b') === pairCompatibility('b', 'a') && pairCompatibility('a', 'b') >= 0 && pairCompatibility('a', 'b') <= 1, 'compatibility is mutual and bounded')

// Partner.
let partner: PersonRelationship | null = rel('b', { relationshipType: 'partner' })
for (let i = 0; i < 400; i++) partner = meet(partner, i * 12, many, 'person_assistance')
check(partner!.trust > 0.95 && relationshipTier(partner!, many) === 'partner', 'a partner can go beyond the close ceiling')
check([...relationshipTiers([...many, partner!]).values()].filter((tier) => tier === 'close').length === CLOSE_SLOTS, 'a partner does not use up a close slot')

// Bad experiences are not damped.
const hurt = meet(close, 2400, [], 'person_conflict')
check(close!.trust - hurt.trust > 0.1 && hurt.affinity < close!.affinity, 'a conflict lands with full force on a saturated relationship')

// Fading without contact.
const old = rel('b', { trust: 0.55, affinity: 0.55, familiarity: 1, lastInteractionTick: 100 })
const after = fadeRelationship(old, 100 + FADE_HALF_LIFE_TICKS.acquaintance, 'acquaintance')
check(Math.abs(after.trust - 0.525) < 1e-6 && Math.abs(after.affinity - 0.525) < 1e-6, 'after one half-life half of the gain is gone')
check(after.familiarity < 1 && after.familiarity > 0.8, 'you forget how well you knew someone more slowly')
check(fadeRelationship(old, 100, 'acquaintance') === old && fadeRelationship(rel('b', { lastInteractionTick: null }), 500) !== null, 'no contact time, no fading')
const grudge = fadeRelationship(rel('b', { trust: 0.2, lastInteractionTick: 0 }), FADE_HALF_LIFE_TICKS.acquaintance, 'acquaintance')
check(Math.abs(grudge.trust - 0.35) < 1e-6, 'a grudge fades towards neutral too')
const friendFade = fadeRelationship(rel('b', { trust: 0.85, lastInteractionTick: 0 }), FADE_HALF_LIFE_TICKS.acquaintance, 'close')
const acquFade = fadeRelationship(rel('b', { trust: 0.55, lastInteractionTick: 0 }), FADE_HALF_LIFE_TICKS.acquaintance, 'acquaintance')
check((0.85 - friendFade.trust) / 0.35 < (0.55 - acquFade.trust) / 0.05, 'a deep friendship fades more slowly')
const demoted = fadeRelationship(rel('b', { trust: 0.85, affinity: 0.85, lastInteractionTick: 0 }), 24 * 21, 'acquaintance')
check(demoted.trust < 0.6 && demoted.trust >= TIER_CEILING.acquaintance.trust, 'a tie that lost its close slot settles back to the acquaintance ceiling within weeks')
check(fadeRelationships(many, 24 * 400).every((relation, i) => relation.trust <= many[i].trust), 'fading a whole circle never raises trust')

// Resumed contact starts from the faded state.
const resumed = meet(old, 100 + FADE_HALF_LIFE_TICKS.acquaintance, stronger)
check(resumed.trust < old.trust && resumed.trust > after.trust, 'meeting again builds on what is left, not on the old peak')

// Routine meetings bring little joy; new faces and close friends bring more.
const needs = [{ needCode: 'social' as const, satisfaction: 0.5 }]
const impact = (relationship: { familiarity: number; trust: number; affinity: number } | null) => appraisalFromPopulationEvent(event(1), { needs, relationship })!.goalImpact
check(impact(null) > impact({ familiarity: 1, trust: 0.54, affinity: 0.54 }) * 3, 'a first meeting means more than the daily one with a colleague')
check(impact({ familiarity: 1, trust: 0.85, affinity: 0.85 }) > impact({ familiarity: 1, trust: 0.54, affinity: 0.54 }) * 3, 'meeting a close friend still means something')
check(impact({ familiarity: 1, trust: 0.5, affinity: 0.5 }) > 0, 'even routine contact is mildly positive')

if (failures) throw new Error(String(failures) + ' relationship dynamics test(s) failed')
console.log('Relationship dynamics: tests passed; external_llm_calls=0')
