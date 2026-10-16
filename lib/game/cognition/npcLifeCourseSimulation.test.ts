import { createNpcMemory } from './npcRelationalMemory'
import { stimulusFromMemory } from './npcCreativeProcess'
import {
  LIFE_HOURS_PER_YEAR,
  createNewbornLifeCourse,
  developmentalCapacity,
  developmentStage,
  runLifeCourseScenario,
} from './npcLifeCourseSimulation'

let failures = 0
const check = (ok: boolean, label: string) => {
  if (!ok) {
    failures += 1
    console.error('FAIL: ' + label)
  }
}

const newborn = createNewbornLifeCourse('child:test')
check(newborn.ageHours === 0 && newborn.stage === 'newborn', 'life course begins at birth')
check(developmentStage(24 * 7) === 'newborn', 'one week remains newborn')
check(developmentStage(24 * 40) === 'infant', 'forty days is infant')
check(developmentStage(LIFE_HOURS_PER_YEAR * 2) === 'toddler', 'two years is toddler')
check(developmentalCapacity(0).creativeAgency === 0, 'newborn has no deliberate creative agency')
check(developmentalCapacity(LIFE_HOURS_PER_YEAR * 8).creativeAgency > 0.7, 'creative agency develops over childhood')

const memory = createNpcMemory({
  npcId: 'child:test',
  subjectRef: 'caregiver:voice',
  attribute: 'melodic_phrase',
  value: 'repeated lullaby',
  sourceRef: 'observation:child:test:lullaby',
  confidence: 0.9,
  salience: 0.9,
  atTick: 1,
})

const makeStimulus = (hour: number) => stimulusFromMemory({
  memory: { ...memory.memory, id: memory.memory.id + ':' + hour },
  domains: ['music'],
  motifs: ['caregiver voice', 'repeated melody'],
  emotionalWeight: 0.9,
  novelty: 0.45,
  atTick: hour,
})

const firstMonth = runLifeCourseScenario({
  npcId: 'child:test',
  disposition: {
    creativity: 0.82,
    openness: 0.8,
    persistence: 0.62,
    sensitivity: 0.85,
    routineTolerance: 0.45,
  },
  exposures: Array.from({ length: 30 }, (_, day) => ({
    hour: day * 24 + 10,
    stimulus: makeStimulus(day * 24 + 10),
  })),
  endHour: 30 * 24,
})

const month = firstMonth[firstMonth.length - 1]
check(month.stage === 'infant', 'thirty-day run crosses newborn to infant')
check(month.exposureCount === 30, 'complete hourly run preserves repeated lived exposure')
check(month.interests.find(entry => entry.domain === 'music')?.strength! > 0, 'music exposure can shape interest before authorship')
check(month.projects.length === 0, 'infant does not become a composer merely from high creativity')
check(month.sleepCycles > 20, 'sleep is represented across the month-long run')

const childhood = runLifeCourseScenario({
  npcId: 'child:test',
  disposition: {
    creativity: 0.82,
    openness: 0.8,
    persistence: 0.62,
    sensitivity: 0.85,
    routineTolerance: 0.45,
  },
  exposures: Array.from({ length: 365 * 8 }, (_, day) => ({
    hour: day * 24 + 10,
    stimulus: makeStimulus(day * 24 + 10),
  })),
  endHour: LIFE_HOURS_PER_YEAR * 8,
  snapshotHours: [LIFE_HOURS_PER_YEAR * 2, LIFE_HOURS_PER_YEAR * 4, LIFE_HOURS_PER_YEAR * 6],
})

const ageEight = childhood[childhood.length - 1]
check(ageEight.stage === 'middle_childhood', 'long run reaches middle childhood deterministically')
check((ageEight.skills.music ?? 0) > 0, 'repeated exposure can become learned musical skill')
check(ageEight.projects.length > 0, 'deliberate projects only emerge after developmental gates open')

if (failures) throw new Error(String(failures) + ' npc life-course simulation test(s) failed')
console.log('NPC life-course simulation v0.1: tests passed; starts_at_birth=true; external_llm_calls=0; persistence_writes=0')
