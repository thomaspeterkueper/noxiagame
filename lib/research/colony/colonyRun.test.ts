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

// Snapshot input: unknown relationship partners are ignored, tick continues from the snapshot.
const fromSnapshot = runColony({ ...colony, tick: 2103, relationships: [
  { personId: a, otherPersonId: b, familiarity: 1, trust: 0.9, affinity: 0.7, lastInteractionTick: 2100 },
  { personId: a, otherPersonId: 'gone', familiarity: 1, trust: 0.9, affinity: 0.7, lastInteractionTick: 2100 },
] }, { ticks: 24 })
check(fromSnapshot.final.relationships.some((r) => r.personId === a && r.otherPersonId === b) && !fromSnapshot.final.relationships.some((r) => r.otherPersonId === 'gone'), 'snapshot relationships are carried over, dangling ones dropped')

check(daysToCsv(month.days).split('\n').length === 32 && daysToCsv(month.days).startsWith('day,sleepHours'), 'days export as csv')
check(syntheticColony({ people: 9, settlements: 3 }).people.filter((p) => p.locationId === 'settlement-0').length === 3, 'synthetic people are spread over settlements')

if (failures) throw new Error(String(failures) + ' colony run test(s) failed')
console.log('Colony research run: tests passed; database_calls=0; external_llm_calls=0')
