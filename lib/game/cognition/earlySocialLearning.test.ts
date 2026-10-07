import type { SensoryReception } from './sensoryLayer'
import type { SensoryPattern } from './sensoryPatternLearning'
import { preferredSocialSource, updateEarlySocialLearning, type EarlySocialLearningState } from './earlySocialLearning'

let failures = 0
const check = (ok: boolean, label: string) => {
  if (!ok) {
    failures += 1
    console.error('FAIL: ' + label)
  }
}

const reception = (sourceRef: string, tick: number): SensoryReception => ({
  stimulusId: sourceRef + ':' + tick,
  observerId: 'child',
  sourceRef,
  modality: 'auditory',
  receivedIntensity: 0.5,
  clarity: 0.8,
  novelty: 0.2,
  features: { sourceClass: 'human_speech' },
  atTick: tick,
  provenanceRefs: [],
})

const patterns: SensoryPattern[] = [
  {
    key: 'caregiver',
    modality: 'auditory',
    sourceRef: 'person:caregiver',
    sourceClass: 'human_speech',
    occurrences: 30,
    familiarity: 0.9,
    meanIntensity: 0.5,
    meanClarity: 0.8,
    meanNovelty: 0.2,
    firstTick: 1,
    lastTick: 30,
  },
  {
    key: 'visitor',
    modality: 'auditory',
    sourceRef: 'person:visitor',
    sourceClass: 'human_speech',
    occurrences: 8,
    familiarity: 0.55,
    meanIntensity: 0.5,
    meanClarity: 0.8,
    meanNovelty: 0.4,
    firstTick: 5,
    lastTick: 28,
  },
]

let state: EarlySocialLearningState = { sources: [] }
for (let tick = 1; tick <= 20; tick += 1) {
  state = updateEarlySocialLearning({
    state,
    receptions: [reception('person:caregiver', tick)],
    patterns,
    distressed: true,
    regulationEpisodes: [{
      tick,
      sourceRef: 'person:caregiver',
      distressBefore: 0.75,
      distressAfter: 0.35,
      safetyBefore: 0.55,
      safetyAfter: 0.72,
      needRelief: 0.4,
    }],
    atTick: tick,
  })
}

for (let tick = 21; tick <= 28; tick += 1) {
  state = updateEarlySocialLearning({
    state,
    receptions: [reception('person:visitor', tick)],
    patterns,
    distressed: true,
    regulationEpisodes: [],
    atTick: tick,
  })
}

const caregiver = state.sources.find(source => source.sourceRef === 'person:caregiver')!
const visitor = state.sources.find(source => source.sourceRef === 'person:visitor')!

check(caregiver.familiarity > visitor.familiarity, 'repeated caregiver becomes more familiar than occasional visitor')
check(caregiver.soothingExpectation > visitor.soothingExpectation, 'actual calming history builds soothing expectation')
check(caregiver.safetyAssociation > visitor.safetyAssociation, 'repeated successful regulation builds safety association')
check(caregiver.responseReliability > visitor.responseReliability, 'reliable response differentiates caregiver from mere presence')
check(caregiver.approachPreference > visitor.approachPreference, 'preference emerges from history rather than source label')
check(preferredSocialSource(state)?.sourceRef === 'person:caregiver', 'strongest learned social preference is caregiver')
check(!('attachmentStyle' in caregiver), 'model does not overclaim an attachment-style diagnosis')

if (failures) throw new Error(String(failures) + ' early social learning test(s) failed')
console.log('Early social learning v0.1: tests passed; hardcoded_parent_bonus=0; attachment_diagnosis=0')
