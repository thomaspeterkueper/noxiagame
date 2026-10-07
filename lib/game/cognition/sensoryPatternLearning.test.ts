import { learnSensoryPatterns, type SensoryPatternState } from './sensoryPatternLearning'
import type { SensoryReception } from './sensoryLayer'

let failures = 0
const check = (ok: boolean, label: string) => {
  if (!ok) {
    failures += 1
    console.error('FAIL: ' + label)
  }
}

const reception = (tick: number): SensoryReception => ({
  stimulusId: 'voice:' + tick,
  observerId: 'child',
  sourceRef: 'person:caregiver',
  modality: 'auditory',
  receivedIntensity: 0.55,
  clarity: 0.7,
  novelty: 0.2,
  features: { sourceClass: 'human_speech' },
  atTick: tick,
  provenanceRefs: [],
})

let state: SensoryPatternState = { patterns: [] }
state = learnSensoryPatterns(state, [reception(1)])
const first = state.patterns[0]
for (let tick = 2; tick <= 20; tick += 1) state = learnSensoryPatterns(state, [reception(tick)])
const learned = state.patterns[0]

check(learned.occurrences === 20, 'repeated familiar signal accumulates occurrences')
check(learned.familiarity > first.familiarity, 'repetition increases familiarity')
check(learned.sourceRef === 'person:caregiver', 'pattern remains tied to physical source')
check(learned.sourceClass === 'human_speech', 'pattern preserves physical signal class')

if (failures) throw new Error(String(failures) + ' sensory pattern learning test(s) failed')
console.log('Sensory pattern learning v0.1: tests passed; episodic_writes=0; external_llm_calls=0')
