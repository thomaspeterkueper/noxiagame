import { actionSpielraum, combineSpielraum, gini, placeSpielraum, relationalSpielraum, spielraumRegeneration, viableOptions, type ScoredOption } from './spielraum'
import { decidePopulationAction, type PopulationDecisionContext } from './decision'

let failures = 0
const check = (ok: boolean, label: string) => { if (!ok) { failures++; console.error('FAIL: ' + label) } }
const options = (...scores: number[]): ScoredOption[] => scores.map((score) => ({ action: 'work', score }))

// Room to act.
check(viableOptions(options(0.9, 0.8, 0.7, 0.2, -1)) === 3, 'only options close to the best count as real alternatives')
check(viableOptions(options(1.4, 0.3, 0.2, 0.1)) === 1 && actionSpielraum(options(1.4, 0.3, 0.2, 0.1)) === 0, 'one dominant option is no choice')
check(viableOptions(options(-1, -1)) === 0 && actionSpielraum([]) === 0, 'nothing available means no room')
check(actionSpielraum(options(0.5, 0.5, 0.5, 0.5)) > actionSpielraum(options(0.5, 0.5)), 'more real alternatives mean more room')

const context = (needs: Record<string, number>): PopulationDecisionContext => ({
  person: { id: 'a', displayName: 'a', birthYear: null, currentLocationId: 'loc', simulationTier: 'active', activityState: 'idle', lastAction: null, lastDecisionFactors: {}, lastTick: null },
  needs: Object.entries(needs).map(([needCode, satisfaction]) => ({ personId: 'a', needCode: needCode as any, satisfaction, updatedTick: null })),
  assignments: [
    { id: 'h', personId: 'a', assignmentType: 'home', locationId: 'loc', tileEntityId: 'h', employerActorId: null, roleCode: null, startsTick: null, endsTick: null, isActive: true },
    { id: 'w', personId: 'a', assignmentType: 'work', locationId: 'loc', tileEntityId: 'w', employerActorId: null, roleCode: null, startsTick: null, endsTick: null, isActive: true },
  ],
  skills: [], knowledge: [], workObligation: 0.2,
  relationships: [{ id: 'r', personId: 'a', otherPersonId: 'b', relationshipType: 'acquaintance', familiarity: 0.9, trust: 0.6, affinity: 0.6, lastInteractionTick: 0 }],
})
const atEase = decidePopulationAction(context({ sustenance: 0.8, rest: 0.8, safety: 1, social: 0.7, purpose: 0.8, variety: 0.7 }))
const starving = decidePopulationAction(context({ sustenance: 0.05, rest: 0.8, safety: 1, social: 0.7, purpose: 0.8, variety: 0.7 }))
check(Array.isArray(atEase.options) && atEase.options![0].action === atEase.action, 'the decision exposes all considered options, best first')
check(actionSpielraum(atEase.options!) > 0 && actionSpielraum(starving.options!) === 0, 'acute need narrows the room to act to a single option')

// People to turn to.
const tie = (trust: number, affinity: number, familiarity = 0.9) => ({ trust, affinity, familiarity })
check(relationalSpielraum([]) === 0, 'nobody to turn to means no relational room')
check(relationalSpielraum([tie(0.85, 0.85)]) > relationalSpielraum([tie(0.54, 0.54)]), 'a close tie opens more than an acquaintance')
check(relationalSpielraum([tie(0.54, 0.54), tie(0.2, 0.2)]) < relationalSpielraum([tie(0.54, 0.54)]), 'a strained relationship closes a little')
check(relationalSpielraum([tie(0.5, 0.5, 0.05)]) === 0, 'a near stranger does not yet count')
const many = Array.from({ length: 40 }, () => tie(0.54, 0.54))
check(relationalSpielraum(many) < 1 && relationalSpielraum(many) - relationalSpielraum(many.slice(0, 20)) < relationalSpielraum(many.slice(0, 5)), 'further acquaintances add less and less')
check(relationalSpielraum([tie(0.1, 0.1), tie(0.1, 0.1)]) === 0, 'room never goes below zero')

// Places.
check(placeSpielraum(0) === 0 && placeSpielraum(6) > placeSpielraum(2), 'more open places mean more room')
check(placeSpielraum(6, 0.3) < placeSpielraum(6, 1) && placeSpielraum(6, 0) > 0, 'scarcity shrinks the room a settlement offers without removing it')

// Combination and distribution.
const full = combineSpielraum({ action: 1, relational: 1, place: 1 })
check(full.total === 1 && combineSpielraum({ action: 0, relational: 0, place: 0 }).total === 0, 'the total stays between none and full')
check(combineSpielraum({ action: 0.5, relational: 0.2, place: 0.9 }).total > combineSpielraum({ action: 0.5, relational: 0.2, place: 0.1 }).total, 'each component contributes')
check(gini([0.5, 0.5, 0.5, 0.5]) === 0 && gini([0, 0, 0, 1]) > 0.7 && gini([]) === 0 && gini([0, 0]) === 0, 'gini separates equal from concentrated room')

// Regeneration: does room come back, not does the old state return.
const series = [...Array(60).fill(0.6), ...Array(30).fill(0.4), ...Array(10).fill(0.5), ...Array(60).fill(0.6)]
const healed = spielraumRegeneration(series, { startDay: 60, endDay: 90 })
check(healed.before === 0.6 && healed.lowest === 0.4 && Math.abs(healed.loss - 1 / 3) < 0.001, 'loss is the share of earlier room lost at the lowest point')
check(healed.daysToRegenerate !== null && healed.daysToRegenerate >= 8 && healed.daysToRegenerate <= 10 && healed.after === 0.6, 'regeneration counts the days until room is back')
const scarred = spielraumRegeneration([...Array(60).fill(0.6), ...Array(100).fill(0.4)], { startDay: 60, endDay: 90 })
check(scarred.daysToRegenerate === null && scarred.after === 0.4, 'lasting damage shows as room that never comes back')
const spike = spielraumRegeneration([...Array(60).fill(0.6), ...Array(30).fill(0.4), 0.7, ...Array(60).fill(0.4)], { startDay: 60, endDay: 90 })
check(spike.daysToRegenerate === null, 'a single good day is not recovery')

if (failures) throw new Error(String(failures) + ' spielraum test(s) failed')
console.log('Spielraum measure: tests passed; decisions_changed=0')
