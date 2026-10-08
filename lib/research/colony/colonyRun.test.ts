import { daysToCsv, runColony, syntheticColony, type ScenarioEvent } from './colonyRun'

let failures = 0
const check = (ok: boolean, label: string) => { if (!ok) { failures++; console.error('FAIL: ' + label) } }

const colony = syntheticColony({ people: 12 })
const month = runColony(colony, { ticks: 24 * 30 })
check(month.days.length === 30 && month.people === 12, 'one row per game day')
check(JSON.stringify(runColony(colony, { ticks: 24 * 30 })) === JSON.stringify(month), 'equal snapshot and scenario give an identical run')

const settled = month.days.slice(7)
check(settled.every((day) => day.sleepHours > 7 && day.sleepHours <= 8), 'people sleep about eight hours a day')
check(settled.every((day) => day.workHours >= 8 && day.workHours <= 10), 'people work a shift a day, plus some of their free time')
check(settled.every((day) => day.restAvg > 0.4 && day.sustenanceAvg > 0.3), 'needs stay in a liveable range over a month')
check(month.days[29].relationships > 0 && month.days[29].familiarityAvg > month.days[0].familiarityAvg, 'acquaintance grows from encounters')
check(month.days[29].trustAvg < 0.9 && month.days[29].closeTiesMaxPerPerson <= 4, 'relationships no longer all end at the maximum')
check(month.days.every((day) => day.joyAvg >= 0 && day.joyAvg <= 1 && day.moodAvg <= 1), 'affect stays bounded')
check(month.days.reduce((sum, day) => sum + day.encounters, 0) > 0, 'people meet')

// A "what if": the same colony with one serious conflict on day 10.
// Two people who do meet in the undisturbed run.
const pairSeed = month.final.relationships[0]
const a = pairSeed.personId, b = pairSeed.otherPersonId
const conflict: ScenarioEvent[] = [{ tick: 24 * 10 + 12, type: 'person_conflict', personId: a, otherPersonId: b }]
const withConflict = runColony(colony, { ticks: 24 * 30, scenario: conflict })
const trust = (run: typeof month, from: string, to: string) => run.final.relationships.find((r) => r.personId === from && r.otherPersonId === to)?.trust ?? null
check(withConflict.days[10].angerAvg > month.days[10].angerAvg, 'the conflict shows up as anger on that day')
check(JSON.stringify(withConflict.days.slice(0, 10)) === JSON.stringify(month.days.slice(0, 10)), 'days before the intervention are identical')
const shortly = (scenario: ScenarioEvent[]) => runColony(colony, { ticks: 24 * 11, scenario })
check(trust(shortly(conflict), a, b)! < trust(shortly([]), a, b)! && trust(shortly(conflict), b, a)! < trust(shortly([]), b, a)!, 'the conflict lowers trust on both sides')
check(withConflict.days[29].angerAvg < withConflict.days[10].angerAvg, 'anger fades within days')

// Pain and one-sided events.
const accident = runColony(colony, { ticks: 24 * 3, scenario: [{ tick: 30, type: 'workplace_accident', personId: a, severity: 0.9 }] })
check(accident.days[1].painAvg > 0 && accident.days[1].fearAvg > 0, 'an accident registers as pain and fear')
const oneSided = shortly([{ ...conflict[0], mutual: false } as ScenarioEvent])
check(trust(oneSided, a, b)! < trust(shortly([]), a, b)! && trust(oneSided, b, a) === trust(shortly([]), b, a), 'a one-sided event changes only the affected person')

// Separation: someone moves to another workplace and home; old ties fade.
const mover = pairSeed.personId, former = pairSeed.otherPersonId
const apart: ScenarioEvent[] = [
  { tick: 24 * 30, type: 'reassign', personId: mover, assignment: 'work', tileEntityId: 'elsewhere:work' },
  { tick: 24 * 30, type: 'reassign', personId: mover, assignment: 'home', tileEntityId: 'elsewhere:home' },
]
const stayed = runColony(colony, { ticks: 24 * 150 })
const moved = runColony(colony, { ticks: 24 * 150, scenario: apart })
const tie = (run: typeof month, from: string, to: string) => run.final.relationships.find((r) => r.personId === from && r.otherPersonId === to)!
check(tie(moved, mover, former).trust < tie(stayed, mover, former).trust && tie(moved, former, mover).affinity < tie(stayed, former, mover).affinity, 'without contact a relationship fades on both sides')
check(tie(moved, mover, former).familiarity < tie(stayed, mover, former).familiarity && tie(moved, mover, former).familiarity > 0.4, 'people do not forget each other that fast')
check(JSON.stringify(moved.days.slice(0, 30)) === JSON.stringify(stayed.days.slice(0, 30)), 'the run is identical until the move')

// Snapshot input: unknown relationship partners are ignored, tick continues from the snapshot.
const fromSnapshot = runColony({ ...colony, tick: 2103, relationships: [
  { personId: a, otherPersonId: b, familiarity: 1, trust: 0.9, affinity: 0.7, lastInteractionTick: 2100 },
  { personId: a, otherPersonId: 'gone', familiarity: 1, trust: 0.9, affinity: 0.7, lastInteractionTick: 2100 },
] }, { ticks: 24 })
check(fromSnapshot.final.relationships.some((r) => r.personId === a && r.otherPersonId === b) && !fromSnapshot.final.relationships.some((r) => r.otherPersonId === 'gone'), 'snapshot relationships are carried over, dangling ones dropped')

// Friction, variety and movement keep the colony changing (NOXIA-LIVING-0009).
const towns = syntheticColony({ people: 18, settlements: 3 })
const alive = runColony(towns, { ticks: 24 * 365 * 2 })
const sum = (run: typeof alive, key: 'conflicts' | 'assists' | 'visits' | 'moves' | 'encounters', from = 0, to = run.days.length) => run.days.slice(from, to).reduce((total, day) => total + day[key], 0)
check(sum(alive, 'conflicts') > 0 && sum(alive, 'assists') > 0, 'everyday life produces conflicts and help')
check(sum(alive, 'conflicts') < sum(alive, 'encounters') * 0.1, 'but conflict stays the exception')
check(alive.moves.length > 0 && alive.moves.every((move) => move.reason !== 'none'), 'some people move, each for a reason')
check(alive.days[729].relationships > alive.days[60].relationships, 'the network keeps growing after the first weeks')
check(JSON.stringify(alive.days.slice(-30)) !== JSON.stringify(alive.days.slice(-60, -30)), 'the colony does not settle into a fixed state')
const frozen = runColony(towns, { ticks: 24 * 365, friction: false, relocation: false })
check(sum(frozen, 'conflicts') === 0 && frozen.moves.length === 0, 'both mechanisms can be switched off for comparison')
check(JSON.stringify(runColony(towns, { ticks: 24 * 120 })) === JSON.stringify(runColony(towns, { ticks: 24 * 120 })), 'runs with friction and movement are still deterministic')
const shortage: ScenarioEvent[] = [{ tick: 24 * 200, type: 'supply', locationId: 'settlement-0', level: 0.3 }, { tick: 24 * 300, type: 'supply', locationId: 'settlement-0', level: 1 }]
const starved = runColony(towns, { ticks: 24 * 365, scenario: shortage })
const fed = runColony(towns, { ticks: 24 * 365 })
check(sum(starved, 'conflicts', 200, 300) > sum(fed, 'conflicts', 200, 300), 'a shortage raises conflict while it lasts')
check(starved.moves.some((move) => move.reason === 'scarcity' && move.fromLocationId === 'settlement-0' && move.toLocationId !== 'settlement-0'), 'and drives people out of the affected settlement')
check(JSON.stringify(starved.days.slice(0, 200)) === JSON.stringify(fed.days.slice(0, 200)), 'until the shortage both runs are identical')

// Spielraum is measured, never acted on (NOXIA-OMNI-0001).
check(alive.days.every((day) => day.spielraumAvg >= 0 && day.spielraumAvg <= 1 && day.spielraumMin <= day.spielraumAvg), 'Spielraum stays between none and full')
check(alive.days[400].spielraumRelationalAvg > alive.days[0].spielraumRelationalAvg, 'relational room grows as people get to know each other')
const s0 = (run: typeof alive, from: number, to: number) => { const v = run.spielraumBySettlement['settlement-0'].slice(from, to).filter((x): x is number => x !== null); return v.reduce((a, b) => a + b, 0) / v.length }
check(s0(starved, 200, 300) < s0(fed, 200, 300), 'a shortage narrows the Spielraum of the affected settlement')
check(Object.keys(alive.final.spielraum).length === alive.people && Object.keys(alive.spielraumBySettlement).length === 3, 'Spielraum is reported per person and per settlement')
check(alive.spielraumBySettlement['settlement-0'].length === alive.days.length, 'the settlement series has one value per day')

check(daysToCsv(month.days).split('\n').length === 32 && daysToCsv(month.days).startsWith('day,sleepHours'), 'days export as csv')
check(syntheticColony({ people: 9, settlements: 3 }).people.filter((p) => p.locationId === 'settlement-0').length === 3, 'synthetic people are spread over settlements')

if (failures) throw new Error(String(failures) + ' colony run test(s) failed')
console.log('Colony research run: tests passed; database_calls=0; external_llm_calls=0')
