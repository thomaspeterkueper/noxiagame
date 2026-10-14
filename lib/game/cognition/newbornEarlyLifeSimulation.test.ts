import { simulateNewbornEarlyLife } from './newbornEarlyLifeSimulation'

let failures = 0
const check = (ok: boolean, label: string) => {
  if (!ok) {
    failures += 1
    console.error('FAIL: ' + label)
  }
}

const month = simulateNewbornEarlyLife(30)
const day1 = month.snapshots.find(snapshot => snapshot.day === 1)!
const week = month.snapshots.find(snapshot => snapshot.day === 7)!
const end = month.snapshots.find(snapshot => snapshot.day === 30)!

check(day1.totalReceptions > 0, 'first day has physical sensory receptions')
check(week.totalReceptions > day1.totalReceptions, 'sensory experience accumulates across first week')
check(end.totalReceptions > week.totalReceptions, 'sensory experience accumulates across first month')
check(end.episodicObservations < end.totalReceptions, 'habituation prevents every reception becoming a fresh episode')
check(end.memories < end.episodicObservations, 'memory salience filter further limits persistence')

const caregiverSpeech = end.patterns.find(pattern =>
  pattern.sourceRef === 'person:caregiver' && pattern.sourceClass === 'human_speech',
)
const caregiverSong = end.patterns.find(pattern =>
  pattern.sourceRef === 'person:caregiver' && pattern.sourceClass === 'human_singing',
)
const visitorSpeech = end.patterns.find(pattern =>
  pattern.sourceRef === 'person:visitor' && pattern.sourceClass === 'human_speech',
)

check((caregiverSpeech?.occurrences ?? 0) > (visitorSpeech?.occurrences ?? 0), 'caregiver voice becomes more recurrent than occasional visitor')
check((caregiverSpeech?.familiarity ?? 0) > 0.5, 'caregiver speech becomes strongly familiar within repeated exposure')
check((caregiverSong?.occurrences ?? 0) >= 50, 'twice-daily singing leaves a recurring pattern without requiring 50 episodic memories')
check(end.dreamAssociations > 0, 'nightly sleep can produce noncanonical association candidates from lived material')
check(end.dreamAssociations >= week.dreamAssociations, 'dream associations accumulate across the month without becoming memories')

const caregiverSocial = end.socialAssociations.find(source => source.sourceRef === 'person:caregiver')
const visitorSocial = end.socialAssociations.find(source => source.sourceRef === 'person:visitor')
check((caregiverSocial?.familiarity ?? 0) > (visitorSocial?.familiarity ?? 0), 'caregiver becomes more familiar than visitor')
check((caregiverSocial?.soothingExpectation ?? 0) > (visitorSocial?.soothingExpectation ?? 0), 'caregiver gains stronger learned soothing expectation')
check((caregiverSocial?.safetyAssociation ?? 0) > (visitorSocial?.safetyAssociation ?? 0), 'caregiver becomes more strongly associated with safety')
check((caregiverSocial?.approachPreference ?? 0) > (visitorSocial?.approachPreference ?? 0), 'social preference emerges from co-regulation history')
check(end.expectationProbe.events.some(event => event.kind === 'expected_source_absent' && event.sourceRef === 'person:caregiver'), 'missing caregiver during distress produces learned expectation violation')
check(end.expectationProbe.activeSearch?.targetRef === 'person:caregiver', 'one-month-old actively orients toward missing preferred regulation source')
check(end.expectationProbe.activeSearch?.mode === 'orient', 'one-month-old social search remains developmentally non-locomotor')
check(end.expectationProbe.events.some(event => event.kind === 'expected_source_absent' && event.sourceRef === 'person:caregiver'), 'missing caregiver during distress produces learned expectation violation')
check(end.expectationProbe.activeSearch?.targetRef === 'person:caregiver', 'one-month-old actively orients toward missing preferred regulation source')
check(end.expectationProbe.activeSearch?.mode === 'orient', 'one-month-old social search remains developmentally non-locomotor')

if (failures) throw new Error(String(failures) + ' newborn early-life simulation test(s) failed')
console.log(JSON.stringify({
  day1: { receptions: day1.totalReceptions, episodes: day1.episodicObservations, memories: day1.memories },
  week1: { receptions: week.totalReceptions, episodes: week.episodicObservations, memories: week.memories },
  month1: {
    receptions: end.totalReceptions,
    episodes: end.episodicObservations,
    memories: end.memories,
    dreamAssociations: end.dreamAssociations,
    distress: Number(end.distress.toFixed(3)),
  },
  expectationProbe: {
    events: end.expectationProbe.events.map(event => ({ kind: event.kind, source: event.sourceRef, surprise: Number(event.surprise.toFixed(3)) })),
    activeSearch: end.expectationProbe.activeSearch,
  },
  socialAssociations: end.socialAssociations.map(source => ({
    source: source.sourceRef,
    familiarity: Number(source.familiarity.toFixed(3)),
    soothingExpectation: Number(source.soothingExpectation.toFixed(3)),
    safetyAssociation: Number(source.safetyAssociation.toFixed(3)),
    responseReliability: Number(source.responseReliability.toFixed(3)),
    approachPreference: Number(source.approachPreference.toFixed(3)),
  })),
  strongestPatterns: end.patterns.slice(0, 8).map(pattern => ({
    source: pattern.sourceRef,
    class: pattern.sourceClass,
    occurrences: pattern.occurrences,
    familiarity: Number(pattern.familiarity.toFixed(3)),
  })),
}, null, 2))
