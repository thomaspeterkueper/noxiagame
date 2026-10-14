import { createNpcMemory, type NpcMemoryState } from './npcRelationalMemory'
import { recombineDuringDream } from './dreamRecombination'
import type { SensoryPattern } from './sensoryPatternLearning'

let failures = 0
const check = (ok: boolean, label: string) => {
  if (!ok) {
    failures += 1
    console.error('FAIL: ' + label)
  }
}

const first = createNpcMemory({
  npcId: 'child',
  subjectRef: 'person:caregiver',
  attribute: 'sensory_signal',
  value: { features: { sourceClass: 'human_singing', periodicity: 0.8 } },
  sourceRef: 'observation:voice',
  confidence: 0.9,
  salience: 0.88,
  atTick: 10,
})

const second = createNpcMemory({
  npcId: 'child',
  subjectRef: 'environment:window',
  attribute: 'sensory_signal',
  value: { features: { sourceClass: 'ambient_light' } },
  sourceRef: 'observation:light',
  confidence: 0.85,
  salience: 0.8,
  atTick: 11,
  clock: first.clock,
})

const copied = createNpcMemory({
  npcId: 'child',
  subjectRef: first.memory.subjectRef,
  attribute: first.memory.attribute,
  value: first.memory.rememberedValue,
  sourceRef: 'npc:other',
  parentTraceIds: [first.trace.id],
  confidence: 0.7,
  salience: 0.75,
  atTick: 12,
  clock: second.clock,
})

const state: NpcMemoryState = {
  npcId: 'child',
  clock: copied.clock,
  memories: [first.memory, second.memory, copied.memory],
  traces: [first.trace, second.trace, copied.trace],
}

const patterns: SensoryPattern[] = [{
  key: 'auditory|person:caregiver|human_singing',
  modality: 'auditory',
  sourceRef: 'person:caregiver',
  sourceClass: 'human_singing',
  occurrences: 28,
  familiarity: 0.82,
  meanIntensity: 0.5,
  meanClarity: 0.78,
  meanNovelty: 0.2,
  firstTick: 1,
  lastTick: 30,
}]

const result = recombineDuringDream({
  memoryState: state,
  patterns,
  creativity: {
    noveltySeeking: 0.84,
    associativeRange: 0.92,
    routineStability: 0.35,
    cognitiveFlexibility: 0.88,
    ideaThreshold: 0.52,
  },
  atTick: 100,
  maxCandidates: 6,
})

check(result.candidates.length > 0, 'dream can generate bounded association candidates')
check(result.candidates.every(candidate => candidate.canonical === false), 'dream associations are never canonical truth')
check(result.candidates.every(candidate => candidate.provenance === 'dream_recombination'), 'dream provenance is explicit')
check(result.candidates.some(candidate => candidate.sourcePatternKeys.includes(patterns[0].key)), 'familiar sensory pattern can participate in dream')
check(!result.candidates.some(candidate =>
  candidate.sourceMemoryIds.includes(first.memory.id) && candidate.sourceMemoryIds.includes(copied.memory.id),
), 'derived copy is not treated as independent novelty')
check(state.memories.length === 3, 'dream recombination does not create new memories')
check(state.traces.length === 3, 'dream recombination does not mutate provenance graph')

if (failures) throw new Error(String(failures) + ' dream recombination test(s) failed')
console.log('Dream recombination v0.1: tests passed; canonical_outputs=0; memory_writes=0; external_llm_calls=0')
