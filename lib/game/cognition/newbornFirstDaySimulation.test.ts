import { simulateNewbornFirstDay } from './newbornFirstDaySimulation'

let failures = 0
const check = (ok: boolean, label: string) => {
  if (!ok) {
    failures += 1
    console.error('FAIL: ' + label)
  }
}

const result = simulateNewbornFirstDay()

check(result.observations.length > 0, 'first day produces actual perceived stimuli')
check(result.observations.some(entry => entry.sourceRef === 'person:caregiver' && entry.modality === 'auditory'), 'caregiver voice reaches newborn')
check(result.observations.some(entry => entry.sourceRef === 'person:caregiver' && entry.modality === 'tactile'), 'caregiver touch reaches newborn')
check(result.memoryCount > 0, 'some sufficiently salient first-day perceptions become memories')
check(result.memoryCount < result.observations.length, 'not every perception is persisted as memory')
check(result.memoryState.memories.every(memory => memory.npcId === 'newborn:test'), 'memories remain observer-scoped')

if (failures) throw new Error(String(failures) + ' newborn first day test(s) failed')
console.log(JSON.stringify({
  observations: result.observations.length,
  memories: result.memoryCount,
  modalities: [...new Set(result.observations.map(entry => entry.modality))],
  rememberedSources: [...new Set(result.observations.filter(entry => entry.remembered).map(entry => entry.sourceRef))],
}, null, 2))
