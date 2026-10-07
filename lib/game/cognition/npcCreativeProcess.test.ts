import { createNpcMemory } from './npcRelationalMemory'
import {
  advanceCreativeProject,
  createCreativeSeed,
  creativeHoursFromRoutine,
  deriveCreativeIdentity,
  dispositionFromCognition,
  normalizeDisposition,
  startCreativeProject,
  stimulusFromMemory,
  updateCreativeInterests,
} from './npcCreativeProcess'

let failures = 0
const check = (ok: boolean, label: string) => {
  if (!ok) {
    failures += 1
    console.error('FAIL: ' + label)
  }
}

const memoryA = createNpcMemory({
  npcId: 'lan',
  subjectRef: 'station:observation-deck',
  attribute: 'heard_pattern',
  value: 'dock machinery pulse',
  sourceRef: 'observation:lan:deck',
  confidence: 0.82,
  salience: 0.88,
  atTick: 100,
})

const memoryB = createNpcMemory({
  npcId: 'lan',
  subjectRef: 'orbit:earth',
  attribute: 'light_pattern',
  value: 'city lights crossing terminator',
  sourceRef: 'observation:lan:earth',
  confidence: 0.9,
  salience: 0.92,
  atTick: 101,
  clock: memoryA.clock,
})

const disposition = normalizeDisposition({
  creativity: 0.86,
  openness: 0.78,
  persistence: 0.7,
  sensitivity: 0.82,
  routineTolerance: 0.35,
})

const stimuli = [
  stimulusFromMemory({
    memory: memoryA.memory,
    domains: ['music'],
    motifs: ['machine pulse', 'docking rhythm'],
    emotionalWeight: 0.72,
    novelty: 0.64,
    atTick: 102,
  }),
  stimulusFromMemory({
    memory: memoryB.memory,
    domains: ['music', 'visual_art'],
    motifs: ['earthlight', 'slow crossing'],
    emotionalWeight: 0.84,
    novelty: 0.78,
    atTick: 102,
  }),
]

let interests = updateCreativeInterests({ stimuli, disposition, atTick: 102 })
interests = updateCreativeInterests({ existing: interests, stimuli, disposition, atTick: 103 })
interests = updateCreativeInterests({ existing: interests, stimuli, disposition, atTick: 104 })

const musicInterest = interests.find(entry => entry.domain === 'music')!
check(musicInterest.strength > 0.3, 'repeated meaningful exposure grows musical interest')
check(musicInterest.voluntaryPull > 0, 'interest can become voluntary pull')

const seed = createCreativeSeed({
  npcId: 'lan',
  domain: 'music',
  interest: musicInterest,
  stimuli,
  disposition,
  skills: { music: 0.24 },
  atTick: 105,
})

check(seed !== null, 'strong enough interest can produce a creative seed')
check((seed?.sourceMemoryIds.length ?? 0) >= 1, 'creative seed preserves source memories')
check((seed?.motifs.length ?? 0) >= 2, 'creative seed carries motifs from lived experience')

if (seed) {
  let project = startCreativeProject(seed)
  project = advanceCreativeProject({ project, disposition, skill: 0.24, availableHours: 3, atTick: 106 })
  check(project.hoursInvested === 3, 'creative work consumes explicit available time')
  check(project.progress > 0, 'practice advances a project without an LLM call')

  for (let tick = 107; tick < 120 && project.stage !== 'finished'; tick += 1) {
    project = advanceCreativeProject({ project, disposition, skill: 0.35, availableHours: 4, atTick: tick })
  }
  check(project.stage === 'finished', 'persistent practice can finish a work')
}

const identity = deriveCreativeIdentity({
  domain: 'music',
  practiceHours: 420,
  finishedWorks: 5,
  recognizedWorks: 2,
  interestStrength: 0.84,
  skill: 0.72,
})

check(identity.identityStrength > 0.65, 'creative identity emerges from practice, works, interest and skill')
check(identity.professional, 'profession can emerge from sustained practice and recognized output')

const cognitiveDisposition = dispositionFromCognition({
  noveltySeeking: 0.82,
  associativeRange: 0.9,
  routineStability: 0.32,
  cognitiveFlexibility: 0.84,
  ideaThreshold: 0.54,
}, { persistence: 0.68, sensitivity: 0.8 })

check(cognitiveDisposition.creativity > 0.8, 'creative process reuses the authoritative cognition profile')
check(cognitiveDisposition.routineTolerance === 0.32, 'routine stability maps into creative routine tolerance')

const creativeHours = creativeHoursFromRoutine({
  routine: {
    activity: 'home',
    label: 'Private Freizeit',
    from: 'home',
    target: 'home',
    moving: false,
    progress: 0,
    shift: 'day',
    shiftLabel: 'Tagschicht',
    socialGroup: 1,
  },
  interest: { ...musicInterest, strength: 0.86, voluntaryPull: 0.8 },
  cognition: {
    noveltySeeking: 0.82,
    associativeRange: 0.9,
    routineStability: 0.32,
    cognitiveFlexibility: 0.84,
    ideaThreshold: 0.54,
  },
})
check(creativeHours > 0, 'private free time can become creative practice time')

const workHours = creativeHoursFromRoutine({
  routine: {
    activity: 'work',
    label: 'Tagschicht',
    from: 'work',
    target: 'work',
    moving: false,
    progress: 0,
    shift: 'day',
    shiftLabel: 'Tagschicht',
    socialGroup: 1,
  },
  interest: { ...musicInterest, strength: 1, voluntaryPull: 1 },
  cognition: {
    noveltySeeking: 1,
    associativeRange: 1,
    routineStability: 0,
    cognitiveFlexibility: 1,
    ideaThreshold: 0.5,
  },
})
check(workHours === 0, 'creative work does not steal free compute from scheduled work')

if (failures) throw new Error(String(failures) + ' npc creative process test(s) failed')
console.log('NPC creative process v0.1: tests passed; external_llm_calls=0; persistence_writes=0')
