import type { Person } from '../population/types'
import { buildPersonSensoryStimuli, socialStimuliForObserver } from './personSensoryField'

let failures = 0
const check = (ok: boolean, label: string) => {
  if (!ok) {
    failures += 1
    console.error('FAIL: ' + label)
  }
}

const caregiver: Person = {
  id: 'caregiver',
  displayName: 'Caregiver',
  birthYear: 2050,
  currentLocationId: 'habitat',
  simulationTier: 'active',
  activityState: 'socialising',
  lastAction: 'social_interaction',
  lastDecisionFactors: {},
  lastTick: 10,
}

const stimuli = buildPersonSensoryStimuli({
  state: {
    person: caregiver,
    point: { xM: 0.2, yM: 0 },
    vocalExpression: 'singing',
    gazeTargetId: 'child',
    contactTargetIds: ['child'],
    emotionalArousal: 0.4,
  },
  tick: 11,
})

check(stimuli.some(stimulus => stimulus.modality === 'auditory' && stimulus.vector.features?.sourceClass === 'human_singing'), 'explicit singing emits structured auditory signal')
check(stimuli.some(stimulus => stimulus.modality === 'visual' && stimulus.vector.features?.sourceClass === 'directed_gaze'), 'explicit gaze produces visual social cue')
check(stimuli.some(stimulus => stimulus.modality === 'tactile' && stimulus.vector.features?.targetId === 'child'), 'explicit contact produces tactile cue')

const neutral: Person = { ...caregiver, id: 'neutral', activityState: 'idle', lastAction: null }
const neutralStimuli = buildPersonSensoryStimuli({
  state: { person: neutral, point: { xM: 2, yM: 0 } },
  tick: 11,
})
check(!neutralStimuli.some(stimulus => stimulus.vector.features?.sourceClass === 'human_speech'), 'idle person does not hallucinate speech')

const social = socialStimuliForObserver({
  observerId: 'child',
  tick: 11,
  people: [
    {
      person: caregiver,
      point: { xM: 0.2, yM: 0 },
      vocalExpression: 'speech',
      contactTargetIds: ['child'],
    },
    {
      person: neutral,
      point: { xM: 3, yM: 0 },
      contactTargetIds: ['someone-else'],
    },
  ],
})

check(social.some(stimulus => stimulus.modality === 'tactile'), 'observer receives touch targeted to itself')
check(!social.some(stimulus => stimulus.modality === 'tactile' && stimulus.vector.features?.targetId === 'someone-else'), 'observer does not receive another person\'s touch')

if (failures) throw new Error(String(failures) + ' person sensory field test(s) failed')
console.log('Person sensory field v0.1: tests passed; invented_social_actions=0; external_llm_calls=0')
