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

if (failures) throw new Error(String(failures) + ' newborn early-life simulation test(s) failed')
console.log(JSON.stringify({
  day1: { receptions: day1.totalReceptions, episodes: day1.episodicObservations, memories: day1.memories },
  week1: { receptions: week.totalReceptions, episodes: week.episodicObservations, memories: week.memories },
  month1: { receptions: end.totalReceptions, episodes: end.episodicObservations, memories: end.memories },
  strongestPatterns: end.patterns.slice(0, 8).map(pattern => ({
    source: pattern.sourceRef,
    class: pattern.sourceClass,
    occurrences: pattern.occurrences,
    familiarity: Number(pattern.familiarity.toFixed(3)),
  })),
}, null, 2))
