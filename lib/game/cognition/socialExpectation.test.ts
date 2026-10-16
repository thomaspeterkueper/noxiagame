import type { SensoryReception } from './sensoryLayer'
import type { EarlySocialLearningState } from './earlySocialLearning'
import { activeSocialSearch, evaluateSocialExpectations, strangerResponseCapacity } from './socialExpectation'

let failures = 0
const check = (ok: boolean, label: string) => {
  if (!ok) {
    failures += 1
    console.error('FAIL: ' + label)
  }
}

const learned: EarlySocialLearningState = {
  sources: [{
    sourceRef: 'person:caregiver',
    familiarity: 0.92,
    coRegulationCount: 30,
    responseOpportunities: 34,
    responseReliability: 0.91,
    soothingExpectation: 0.82,
    safetyAssociation: 0.78,
    attentionBias: 0.84,
    approachPreference: 0.86,
    lastUpdatedTick: 100,
  }],
}

const reception = (sourceRef: string): SensoryReception => ({
  stimulusId: sourceRef + ':x',
  observerId: 'child',
  sourceRef,
  modality: 'visual',
  receivedIntensity: 0.5,
  clarity: 0.8,
  novelty: 0.4,
  features: { sourceClass: 'person_presence' },
  atTick: 101,
  provenanceRefs: [],
})

const absent = evaluateSocialExpectations({
  state: learned,
  receptions: [],
  distressed: true,
  ageDays: 30,
})
check(absent.some(event => event.kind === 'expected_source_absent'), 'distress plus missing reliable caregiver creates expectation violation')
const search = activeSocialSearch(absent, 30)
check(search?.targetRef === 'person:caregiver', 'absence can trigger search for learned regulation source')
check(search?.mode === 'orient', 'one-month-old search remains orienting rather than locomotor approach')

const changed = evaluateSocialExpectations({
  state: learned,
  receptions: [reception('person:caregiver')],
  distressed: false,
  ageDays: 180,
  changedSourceRefs: ['person:caregiver'],
})
check(changed.some(event => event.kind === 'familiar_source_changed'), 'changed familiar signal creates prediction error')

const newbornStranger = evaluateSocialExpectations({
  state: learned,
  receptions: [reception('person:stranger')],
  distressed: false,
  ageDays: 30,
})
const olderStranger = evaluateSocialExpectations({
  state: learned,
  receptions: [reception('person:stranger')],
  distressed: false,
  ageDays: 240,
})
const n = newbornStranger.find(event => event.kind === 'unfamiliar_person_present')!
const o = olderStranger.find(event => event.kind === 'unfamiliar_person_present')!
check(o.avoidanceBias > n.avoidanceBias, 'stranger caution is developmentally gated rather than imposed on newborns')
check(strangerResponseCapacity(240) > strangerResponseCapacity(30), 'stranger-response capacity grows over early infancy')

if (failures) throw new Error(String(failures) + ' social expectation test(s) failed')
console.log('Social expectation v0.1: tests passed; newborn_stranger_anxiety_hardcode=0; active_search=true')
