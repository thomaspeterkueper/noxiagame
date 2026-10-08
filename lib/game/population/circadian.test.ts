import { circadianProfile, circadianState, isAsleepAction } from './circadian'
import { decidePopulationAction, type PopulationDecisionContext } from './decision'
import { derivePopulationEncounters, ENCOUNTER_COOLDOWN_TICKS, isFreshEncounter } from './encounters'
import { resolvedPresenceCandidates } from './presence'
import { namedPersonSleeps } from '../personBrain'
import type { Person, PersonActivityState, PersonAssignment, PopulationAction } from './types'

let failures = 0
const check = (ok: boolean, label: string) => { if (!ok) { failures++; console.error('FAIL: ' + label) } }

// Profile and state.
const early = circadianProfile('x', { chronotype: 0 })
const late = circadianProfile('x', { chronotype: 1 })
check(early.sleepStartHour === 21 && late.sleepStartHour === 1 && early.sleepHours === 8, 'chronotype spreads bedtime from 21:00 to 01:00')
check(circadianProfile('x', { chronotype: 0, work_shift: 'night' }).sleepStartHour === 9, 'night shift moves the rhythm by twelve hours')
check(JSON.stringify(circadianProfile('p-1')) === JSON.stringify(circadianProfile('p-1')), 'the profile is stable per person')
const bedtimes = new Set(Array.from({ length: 40 }, (_, i) => circadianProfile(`person-${i}`).sleepStartHour))
check(bedtimes.size >= 4, 'a settlement does not go to bed in the same hour')
const asleepHours = Array.from({ length: 24 }, (_, h) => circadianState(h, early)).filter((s) => s.inSleepWindow)
check(asleepHours.length === 8, 'the sleep window covers eight hours a day')
check(circadianState(20, early).sleepDrive > 0 && circadianState(20, early).sleepDrive < 1 && circadianState(19, early).sleepDrive === 0, 'drive rises in the hour before bed')
check(circadianState(2, early).workObligation === 0 && circadianState(7, early).workObligation === 0.85 && circadianState(18, early).workObligation === 0.2, 'no work at night, a shift after waking, leisure in the evening')
check(circadianState(21 + 24 * 50, early).inSleepWindow && circadianState(-3, early).inSleepWindow, 'the rhythm repeats daily and tolerates negative ticks')
check(isAsleepAction('sleep') && isAsleepAction('sleep_and_consolidate') && !isAsleepAction('rest') && !isAsleepAction(null), 'only sleep actions count as asleep')

// Decision.
const WORK = 'loc', HOME_TILE = 'tile:home', WORK_TILE = 'tile:work'
const assignmentsFor = (id: string): PersonAssignment[] => [
  { id: `${id}:w`, personId: id, assignmentType: 'work', locationId: WORK, tileEntityId: WORK_TILE, employerActorId: null, roleCode: null, startsTick: null, endsTick: null, isActive: true },
  { id: `${id}:h`, personId: id, assignmentType: 'home', locationId: WORK, tileEntityId: HOME_TILE, employerActorId: null, roleCode: null, startsTick: null, endsTick: null, isActive: true },
]
const personOf = (id: string, activityState: PersonActivityState = 'working', lastAction: string | null = null): Person =>
  ({ id, displayName: id, birthYear: null, currentLocationId: WORK, simulationTier: 'active', activityState, lastAction, lastDecisionFactors: {}, lastTick: null })
const contextOf = (id: string, needs: Record<string, number>, extra: Partial<PopulationDecisionContext> = {}): PopulationDecisionContext => ({
  person: personOf(id),
  needs: Object.entries(needs).map(([needCode, satisfaction]) => ({ personId: id, needCode: needCode as any, satisfaction, updatedTick: null })),
  assignments: assignmentsFor(id), skills: [], relationships: [], knowledge: [], travelCostHome: 0.1, travelCostWork: 0.1, ...extra,
})
const fine = { sustenance: 0.8, rest: 0.8, safety: 1, social: 1, purpose: 1 }

const night = decidePopulationAction(contextOf('a', fine, { workObligation: 0, sleepDrive: 1 }))
check(night.action === 'rest' && night.factors.asleep === true, 'a rested person still sleeps at night')
const day = decidePopulationAction(contextOf('a', fine, { workObligation: 0.85, sleepDrive: 0 }))
check(day.action === 'work' && !('sleepDrive' in day.factors), 'by day the decision is unchanged and carries no sleep factor')
check(decidePopulationAction(contextOf('a', { ...fine, sustenance: 0.1 }, { workObligation: 0, sleepDrive: 1 })).action === 'satisfy_basic_need', 'severe hunger wakes a person')
check(decidePopulationAction(contextOf('a', { ...fine, safety: 0.2 }, { workObligation: 0, sleepDrive: 1 })).action === 'satisfy_basic_need', 'danger wakes a person')
check(decidePopulationAction(contextOf('a', fine, { workObligation: 0.85, sleepDrive: 1 })).action === 'rest', 'sleep wins even if work were due')

// Presence: sleepers meet nobody.
const sleepers = resolvedPresenceCandidates([personOf('a', 'resting', 'sleep'), personOf('b', 'resting', 'sleep'), personOf('c', 'resting', 'rest')], ['a', 'b', 'c'].flatMap(assignmentsFor))
check(sleepers.length === 1 && sleepers[0].person.id === 'c', 'sleeping persons are not encounter candidates')

// A simulated week: eight people, needs evolving with the engine's deltas.
const NEED_DELTA: Record<string, Record<string, number>> = {
  work: { rest: -0.05, sustenance: -0.025, purpose: 0.04, social: 0.01 },
  rest: { rest: 0.12, sustenance: -0.015, purpose: -0.01 },
  satisfy_basic_need: { sustenance: 0.16, safety: 0.05 },
  travel_home: { rest: -0.015, sustenance: -0.01 },
  travel_work: { rest: -0.015, sustenance: -0.01 },
}
const ACTIVITY: Record<string, PersonActivityState> = { work: 'working', rest: 'resting', travel_home: 'travelling', travel_work: 'travelling', satisfy_basic_need: 'idle' }
function simulate(withRhythm: boolean, withCooldown = false) {
  const lastMet = new Map<string, number>()
  const ids = Array.from({ length: 8 }, (_, i) => `sim-${i}`)
  const needs = new Map(ids.map((id) => [id, { ...fine }]))
  let people = ids.map((id) => personOf(id))
  const assignments = ids.flatMap(assignmentsFor)
  let encounters = 0
  const sleepRuns: number[] = []
  const run = new Map(ids.map((id) => [id, 0]))
  let minRest = 1
  for (let tick = 0; tick < 24 * 7; tick++) {
    const previous = resolvedPresenceCandidates(people, assignments)
    people = people.map((person) => {
      const state = circadianState(tick, circadianProfile(person.id))
      const n = needs.get(person.id)!
      const decision = decidePopulationAction({
        ...contextOf(person.id, n),
        person,
        workObligation: withRhythm ? state.workObligation : (tick % 4 === 3 ? 0.35 : 0.85),
        sleepDrive: withRhythm ? state.sleepDrive : undefined,
      })
      for (const [code, delta] of Object.entries(NEED_DELTA[decision.action as PopulationAction] ?? {})) (n as any)[code] = Math.max(0, Math.min(1, (n as any)[code] + delta))
      if (tick >= 48) minRest = Math.min(minRest, n.rest)
      const asleep = decision.factors.asleep === true
      if (asleep) run.set(person.id, run.get(person.id)! + 1)
      else if (run.get(person.id)! > 0) { sleepRuns.push(run.get(person.id)!); run.set(person.id, 0) }
      return { ...person, activityState: ACTIVITY[decision.action] ?? 'idle', lastAction: asleep ? 'sleep' : decision.action }
    })
    for (const encounter of derivePopulationEncounters({ tick, candidates: resolvedPresenceCandidates(people, assignments), previousCandidates: previous })) {
      const key = `${encounter.personAId}|${encounter.personBId}`
      if (withCooldown && !isFreshEncounter(lastMet.get(key), tick)) continue
      lastMet.set(key, tick)
      encounters += 1
    }
  }
  return { encounters, sleepRuns, minRest }
}
const before = simulate(false)
const rhythm = simulate(true)
const after = simulate(true, true)
check(before.sleepRuns.length === 0, 'without a rhythm nobody ever sleeps')
// The simulation starts mid-night, so each person's first stretch is cut short.
check(rhythm.sleepRuns.length >= 8 * 6 && rhythm.sleepRuns.slice(8).every((length) => length === 8), 'with a rhythm everyone sleeps eight hours in one stretch')
check(rhythm.minRest > 0.25, 'nobody runs chronically exhausted')
check(rhythm.encounters < before.encounters, `sleep alone lowers encounters (before ${before.encounters}, with sleep ${rhythm.encounters})`)
check(after.encounters < before.encounters * 0.6, `sleep plus cooldown roughly halves encounters (before ${before.encounters}, after ${after.encounters})`)
check(after.encounters > 0, 'people still meet')
check(JSON.stringify(simulate(true, true)) === JSON.stringify(after), 'the simulation is deterministic')

// Cooldown rule.
check(isFreshEncounter(null, 100) && isFreshEncounter(100 - ENCOUNTER_COOLDOWN_TICKS, 100) && !isFreshEncounter(99, 100), 'a reunion inside the cooldown is not a new encounter')

// Named persons.
const sleepy = { personId: 'lead', traits: { chronotype: 0 }, pressures: [] as any[] }
check(namedPersonSleeps({ ...sleepy, tick: 23 }) && !namedPersonSleeps({ ...sleepy, tick: 12 }), 'a named person sleeps at night, not by day')
check(!namedPersonSleeps({ ...sleepy, tick: 23, pressures: [{ code: 'water', severity: 0.8 }] }), 'a serious colony pressure keeps a lead awake')
check(namedPersonSleeps({ ...sleepy, tick: 23, pressures: [{ code: 'water', severity: 0.4 }] }), 'a mild pressure does not')
check(!namedPersonSleeps({ ...sleepy, tick: 23, sustenance: 0.1 }), 'severe hunger keeps a named person awake')

if (failures) throw new Error(String(failures) + ' circadian test(s) failed')
console.log(`Circadian rhythm: tests passed; encounters/week for 8 people: before=${before.encounters}, with sleep=${rhythm.encounters}, with sleep+cooldown=${after.encounters}`)
