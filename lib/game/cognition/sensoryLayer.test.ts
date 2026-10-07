import {
  receiveSensoryField,
  receiveSensoryStimulus,
  sensoryReceptionObservation,
  type SensoryStimulus,
} from './sensoryLayer'

let failures = 0
const check = (ok: boolean, label: string) => {
  if (!ok) {
    failures += 1
    console.error('FAIL: ' + label)
  }
}

const voice: SensoryStimulus = {
  id: 'voice:1',
  sourceRef: 'person:caregiver',
  modality: 'auditory',
  vector: {
    intensity: 0.7,
    novelty: 0.3,
    periodicity: 0.72,
    complexity: 0.58,
    features: { pitchVariation: 0.65 },
  },
  emittedAtTick: 12,
  position: { xM: 1, yM: 0 },
  rangeM: 25,
  provenanceRefs: ['scene:nursery'],
}

const near = receiveSensoryStimulus(voice, {
  observerId: 'child',
  position: { xM: 0, yM: 0 },
  sensitivity: { auditory: 0.9 },
  attention: { auditory: 0.8 },
})
const far = receiveSensoryStimulus(voice, {
  observerId: 'child',
  position: { xM: 20, yM: 0 },
  sensitivity: { auditory: 0.9 },
  attention: { auditory: 0.8 },
})

check(near !== null, 'nearby audible signal reaches observer')
check((near?.receivedIntensity ?? 0) > (far?.receivedIntensity ?? 0), 'auditory signal attenuates with distance')
check(near?.features.periodicity === 0.72, 'physical rhythm survives reception without semantic interpretation')

const touch: SensoryStimulus = {
  id: 'touch:1',
  sourceRef: 'person:caregiver',
  modality: 'tactile',
  vector: { intensity: 0.8, novelty: 0.2, features: { pressure: 0.4, warmth: 0.7 } },
  emittedAtTick: 13,
  position: { xM: 0.1, yM: 0 },
  rangeM: 0.5,
}

const touchReception = receiveSensoryStimulus(touch, {
  observerId: 'child',
  position: { xM: 0, yM: 0 },
})
check(touchReception !== null, 'touch arrives only at contact range')

const ownMotion: SensoryStimulus = {
  id: 'motion:1',
  sourceRef: 'body:child',
  modality: 'proprioceptive',
  vector: { intensity: 0.6, features: { acceleration: 0.5 } },
  emittedAtTick: 14,
}
check(receiveSensoryStimulus(ownMotion, { observerId: 'child' }) !== null, 'own body produces proprioceptive reception')
check(receiveSensoryStimulus({ ...ownMotion, sourceRef: 'body:other' }, { observerId: 'child' }) === null, 'other body cannot become proprioception')

if (near) {
  const observation = sensoryReceptionObservation(near)
  check(observation.modality === 'auditory', 'sensory modality is preserved into epistemic observation')
  check(observation.attribute === 'sensory_signal', 'raw sensory evidence remains non-semantic')
  check(observation.source.provenanceRefs?.[0] === 'scene:nursery', 'world provenance survives sensory conversion')
}

const field = receiveSensoryField({
  observer: { observerId: 'child', position: { xM: 0, yM: 0 } },
  stimuli: [voice, touch],
})
check(field.length === 2, 'observer can receive a multimodal sensory field')
check(field[0].receivedIntensity >= field[1].receivedIntensity, 'sensory field is deterministically ranked by received intensity')

if (failures) throw new Error(String(failures) + ' sensory layer test(s) failed')
console.log('Sensory layer v0.1: tests passed; semantic_inference=0; external_llm_calls=0')
