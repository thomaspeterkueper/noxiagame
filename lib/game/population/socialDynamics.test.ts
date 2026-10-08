import { encounterNeedDelta, needDelta, passiveNeedDrift, varietyFloor } from './actionEffects'
import { decidePopulationAction, type PopulationDecisionContext } from './decision'
import { decideRelocation, RELOCATION_COOLDOWN_TICKS, type RelocationInput, type RelocationOption } from './relocation'
import { encounterEventType, encounterOdds, encounterOutcome, irritability, pairDraw, type FrictionPerson } from './socialFriction'
import { chooseVisitTarget } from './visitTarget'
import type { PersonRelationship } from './types'

let failures = 0
const check = (ok: boolean, label: string) => { if (!ok) { failures++; console.error('FAIL: ' + label) } }

const content: FrictionPerson = { id: 'a', needs: { rest: 0.9, sustenance: 0.9, variety: 0.8, safety: 1 }, affect: { anger: 0, pain: 0, mood: 0.2, fear: 0 } }
const worn: FrictionPerson = { id: 'a', needs: { rest: 0.2, sustenance: 0.3, variety: 0.1, safety: 0.6 }, affect: { anger: 0.5, pain: 0.2, mood: -0.4, fear: 0 } }
const other = (person: FrictionPerson): FrictionPerson => ({ ...person, id: 'b' })

// Irritability.
check(irritability(content) < 0.1 && irritability(worn) > 0.6, 'tired, hungry, bored and angry people are thin-skinned')
check(irritability({ ...content, needs: { ...content.needs, variety: 0 } }) > irritability(content) + 0.1, 'monotony alone makes people irritable')
check(irritability(content, 0.3) > irritability(content, 1) + 0.1, 'a shortage makes everyone tenser')
check(irritability({ id: 'x', needs: {} }) === 0, 'a person without recorded needs is not irritable')

// Odds.
const calm = encounterOdds({ tick: 1, a: content, b: other(content), compatibility: 0.5 })
const tense = encounterOdds({ tick: 1, a: worn, b: other(worn), compatibility: 0.5 })
check(calm.conflict < 0.02 && tense.conflict > calm.conflict * 10, 'conflict is rare between content people and common between worn-out ones')
check(encounterOdds({ tick: 1, a: worn, b: other(worn), compatibility: 0.1 }).conflict > encounterOdds({ tick: 1, a: worn, b: other(worn), compatibility: 0.9 }).conflict, 'people who do not get on clash more')
check(encounterOdds({ tick: 1, a: worn, b: other(worn), compatibility: 0.5, affinityAB: 0.85, affinityBA: 0.85 }).conflict < tense.conflict, 'close friends put up with more')
check(encounterOdds({ tick: 1, a: worn, b: other(worn), compatibility: 0.5, affinityAB: 0.2, affinityBA: 0.2 }).conflict > tense.conflict, 'people who already dislike each other clash more easily')
check(encounterOdds({ tick: 1, a: content, b: other(content), compatibility: 0.5, supply: 0.3 }).conflict > calm.conflict * 3, 'scarcity raises conflict even among otherwise content people')
check(calm.assistance === 0 && encounterOdds({ tick: 1, a: content, b: other(worn), compatibility: 0.8 }).assistance > 0.1, 'help happens when someone needs it')
check(encounterOdds({ tick: 1, a: content, b: other(worn), compatibility: 0.8, supply: 0.3 }).assistance < encounterOdds({ tick: 1, a: content, b: other(worn), compatibility: 0.8 }).assistance, 'under scarcity people have less to give')
const all = encounterOdds({ tick: 1, a: worn, b: other(worn), compatibility: 0, supply: 0 })
check(all.conflict + all.assistance <= 1 + 1e-9, 'odds never exceed certainty')

// Outcome: deterministic, frequency matches the odds.
check(pairDraw(5, 'a', 'b') === pairDraw(5, 'b', 'a') && pairDraw(5, 'a', 'b') !== pairDraw(6, 'a', 'b'), 'the draw is the same for both sides and differs per tick')
const outcomes = Array.from({ length: 4000 }, (_, tick) => encounterOutcome({ tick, a: worn, b: other(worn), compatibility: 0.5 }).kind)
const share = outcomes.filter((kind) => kind === 'conflict').length / outcomes.length
check(Math.abs(share - tense.conflict) < 0.03, `conflicts occur as often as the odds say (${share.toFixed(3)} vs ${tense.conflict.toFixed(3)})`)
check(JSON.stringify(encounterOutcome({ tick: 7, a: worn, b: other(worn), compatibility: 0.5 })) === JSON.stringify(encounterOutcome({ tick: 7, a: worn, b: other(worn), compatibility: 0.5 })), 'equal state gives the same outcome')
const helped = Array.from({ length: 400 }, (_, tick) => encounterOutcome({ tick, a: content, b: other(worn), compatibility: 0.9 })).find((o) => o.kind === 'assistance')
check(helped?.kind === 'assistance' && helped.recipientId === 'b' && helped.helperId === 'a', 'the one in need receives the help')
check(encounterEventType({ kind: 'conflict', tension: 0.5 }, 'a') === 'person_conflict' && encounterEventType(helped!, 'b') === 'person_assistance' && encounterEventType(helped!, 'a') === 'social_interaction' && encounterEventType({ kind: 'neutral' }, 'a') === 'social_interaction', 'each side records its own view of the meeting')

// Needs.
check(needDelta('satisfy_basic_need', 'sustenance', { supply: 0.5 }) === needDelta('satisfy_basic_need', 'sustenance') / 2, 'under scarcity a meal restores less')
check(needDelta('work', 'rest') === -0.05 && needDelta('rest', 'rest', { supply: 0.2 }) === 0.12, 'other effects are unchanged')
check(passiveNeedDrift('social') < 0 && passiveNeedDrift('rest') === 0, 'contact wears off by itself, rest does not')
check(passiveNeedDrift('variety', { varietyFloor: 0.3 }, 0.8) < 0 && passiveNeedDrift('variety', { varietyFloor: 0.3 }, 0.3) === 0 && passiveNeedDrift('variety', { varietyFloor: 0.3 }, 0.1) === 0, 'routine wears variety down to the personal floor, not further')
check(passiveNeedDrift('safety', { supply: 0.2 }) < 0 && passiveNeedDrift('safety', { supply: 0.8 }) === 0, 'a badly supplied settlement feels unsafe')
check(varietyFloor('p', { novelty_seeking: 1 }) < 0.11 && varietyFloor('p', { novelty_seeking: 0 }) === 0.5 && varietyFloor('p') === varietyFloor('p'), 'novelty seekers tolerate less routine than homebodies')
const floors = new Set(Array.from({ length: 30 }, (_, i) => varietyFloor(`person-${i}`).toFixed(2)))
check(floors.size > 10, 'people differ in how much routine they tolerate')
check(encounterNeedDelta('variety', { novelty: 1, closeness: 0 }) > 0.2 && encounterNeedDelta('variety', { novelty: 0.05, closeness: 1 }) === 0, 'only someone new brings variety')
check(encounterNeedDelta('social', { novelty: 0, closeness: 1 }) > encounterNeedDelta('social', { novelty: 1, closeness: 0 }) * 5, 'someone close answers the need for contact')

// Whom to visit.
const rel = (otherPersonId: string, values: Partial<PersonRelationship>): PersonRelationship =>
  ({ id: otherPersonId, personId: 'a', otherPersonId, relationshipType: 'acquaintance', familiarity: 1, trust: 0.5, affinity: 0.5, lastInteractionTick: 100, ...values })
const circle = [rel('friend', { trust: 0.85, affinity: 0.85 }), rel('colleague', {}), rel('newcomer', { familiarity: 0.2, affinity: 0.55 }), rel('rival', { familiarity: 0.1, affinity: 0.2 })]
check(chooseVisitTarget(circle, { socialPressure: 0.8, varietyPressure: 0.2 }) === 'friend', 'the lonely seek their strongest bond')
check(chooseVisitTarget(circle, { socialPressure: 0.2, varietyPressure: 0.8 }) === 'newcomer', 'the bored seek someone they like but hardly know')
check(chooseVisitTarget([], { socialPressure: 1, varietyPressure: 1 }) === null, 'nobody to visit without relationships')

// Decision: boredom only pulls outward if there is someone new to see.
const context = (relationships: PersonRelationship[], variety: number): PopulationDecisionContext => ({
  person: { id: 'a', displayName: 'a', birthYear: null, currentLocationId: 'loc', simulationTier: 'active', activityState: 'idle', lastAction: null, lastDecisionFactors: {}, lastTick: null },
  needs: [['sustenance', 0.7], ['rest', 0.95], ['safety', 1], ['social', 0.9], ['purpose', 1], ['variety', variety]].map(([needCode, satisfaction]) => ({ personId: 'a', needCode: needCode as any, satisfaction: satisfaction as number, updatedTick: null })),
  assignments: [{ id: 'h', personId: 'a', assignmentType: 'home', locationId: 'loc', tileEntityId: 't', employerActorId: null, roleCode: null, startsTick: null, endsTick: null, isActive: true }],
  skills: [], relationships, knowledge: [], workObligation: 0,
})
check(decidePopulationAction(context(circle, 0.05)).action === 'social_interaction', 'a bored person with someone new to see goes out')
check(decidePopulationAction(context([circle[0], circle[1]], 0.05)).action !== 'social_interaction', 'a bored person who knows everyone does not go visiting for it')
check(decidePopulationAction(context(circle, 0.9)).action !== 'social_interaction', 'a person with enough variety stays in')

// Relocation.
const option = (values: Partial<RelocationOption> = {}): RelocationOption => ({ locationId: 'other', tileEntityId: 'home-9', freePlaces: 1, supply: 1, affinityToResidents: 0.5, closeTies: 0, ...values })
const base: RelocationInput = {
  personId: 'a', tick: 10000, kind: 'home', needs: { variety: 0.8 },
  current: { locationId: 'here', tileEntityId: 'home-1', supply: 1, affinityToResidents: 0.55, closeTies: 1 }, lastMoveTick: null, options: [option()],
}
check(!decideRelocation(base).move, 'a content person stays')
const bored = decideRelocation({ ...base, needs: { variety: 0.05 } })
check(bored.move && bored.reason === 'monotony' && bored.target?.locationId === 'other', 'lasting monotony makes a person move on')
check(!decideRelocation({ ...base, needs: { variety: 0.45 } }).move, 'a homebody at their floor does not move for monotony')
const hostile = decideRelocation({ ...base, current: { ...base.current, affinityToResidents: 0.15, closeTies: 0 } })
check(hostile.move && hostile.reason === 'bad_company', 'bad company at home makes a person move')
check(!decideRelocation({ ...base, current: { ...base.current, affinityToResidents: 0.15, closeTies: 0 }, options: [option({ affinityToResidents: 0.1 })] }).move, 'but not to somewhere worse')
const hungry = decideRelocation({ ...base, current: { ...base.current, supply: 0.2 }, options: [option({ supply: 0.2, locationId: 'also-poor' }), option({ supply: 1, locationId: 'supplied' })] })
check(hungry.move && hungry.reason === 'scarcity' && hungry.target?.locationId === 'supplied', 'scarcity drives people to a supplied settlement')
check(!decideRelocation({ ...base, needs: { variety: 0.05 }, options: [option({ freePlaces: 0 })] }).move, 'nobody moves where there is no room')
check(!decideRelocation({ ...base, needs: { variety: 0.05 }, lastMoveTick: 10000 - RELOCATION_COOLDOWN_TICKS + 1 }).move, 'people do not move again right away')
check(decideRelocation({ ...base, current: { ...base.current, supply: 0.2 }, lastMoveTick: 9990, options: [option({ supply: 1 })] }).move, 'a serious shortage overrides the wish to stay put')
check(decideRelocation({ ...base, needs: { variety: 0.05 }, options: [option({ closeTies: 2, tileEntityId: 'with-friends' }), option({ tileEntityId: 'strangers' })] }).target?.tileEntityId === 'with-friends', 'people prefer to move near their friends')
check(JSON.stringify(decideRelocation({ ...base, needs: { variety: 0.05 } })) === JSON.stringify(bored), 'the decision is deterministic')

if (failures) throw new Error(String(failures) + ' social dynamics test(s) failed')
console.log('Social dynamics (friction, variety, relocation): tests passed; external_llm_calls=0')
