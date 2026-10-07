import { buildLocalSurfaceScene } from '../spatial/localSurfaceScene'
import { emptyPerceptionFilterState } from './npcPerceptionFilter'
import { observeSensoryScene } from './sensoryScenePerception'
import { buildWorldSensoryField } from './worldSensoryField'

let failures = 0
const check = (ok: boolean, label: string) => {
  if (!ok) {
    failures += 1
    console.error('FAIL: ' + label)
  }
}

const scene = buildLocalSurfaceScene({
  body: 'mars',
  frameId: 'test:habitat',
  radiusM: 100,
  buildings: [
    {
      id: 'reactor-a',
      center: { xM: 18, yM: 0 },
      widthM: 12,
      depthM: 10,
      rotationDeg: 0,
      provenance: 'canonical',
      label: 'Reactor',
      entityId: 'reactor_module',
    },
    {
      id: 'plants-a',
      center: { xM: 3, yM: 0 },
      widthM: 8,
      depthM: 6,
      rotationDeg: 0,
      provenance: 'canonical',
      label: 'Plants',
      entityId: 'plant_module',
    },
  ],
  mobileObjects: [
    { id: 'resident:lan', point: { xM: 4, yM: 2 }, label: 'Lan', role: 'resident' },
    { id: 'rover:1', point: { xM: 10, yM: 0 }, label: 'Rover', role: 'cargo-rover' },
  ],
})

const field = buildWorldSensoryField({
  scene,
  environment: {
    tick: 50,
    ambientLight: 0.65,
    ambientTemperatureC: -10,
    windIntensity: 0.4,
  },
})

check(field.some(stimulus => stimulus.sourceRef === 'building:reactor-a' && stimulus.modality === 'auditory'), 'production building emits machinery sound')
check(field.some(stimulus => stimulus.sourceRef === 'building:plants-a' && stimulus.modality === 'olfactory'), 'plant module emits local olfactory stimulus')
check(field.some(stimulus => stimulus.sourceRef === 'rover:1' && stimulus.modality === 'auditory'), 'vehicle-like mobile object emits movement sound')
check(field.some(stimulus => stimulus.sourceRef === 'environment:test:habitat' && stimulus.modality === 'thermal'), 'environment emits thermal stimulus')

const first = observeSensoryScene({
  scene,
  observerId: 'child',
  observerPoint: { xM: 0, yM: 0 },
  atTick: 50,
  state: emptyPerceptionFilterState(),
  environment: {
    ambientLight: 0.65,
    ambientTemperatureC: -10,
    windIntensity: 0.4,
  },
  profile: {
    sensitivity: { auditory: 0.9, visual: 0.8, olfactory: 0.7, thermal: 0.85 },
    attention: { auditory: 0.65, visual: 0.55 },
  },
})

check(first.receptions.length > 0, 'scene becomes a multimodal sensory field for the observer')
check(first.emitted.some(observation => observation.modality === 'auditory'), 'auditory world stimuli become subjective observations')
check(first.emitted.some(observation => observation.modality === 'visual'), 'visual world stimuli become subjective observations')
check(first.emitted.every(observation => observation.attribute === 'sensory_signal'), 'sensory observations remain pre-semantic')

const second = observeSensoryScene({
  scene,
  observerId: 'child',
  observerPoint: { xM: 0, yM: 0 },
  atTick: 51,
  state: first.nextState,
  environment: {
    ambientLight: 0.65,
    ambientTemperatureC: -10,
    windIntensity: 0.4,
  },
})

check(second.emitted.length < first.emitted.length, 'unchanged sensory scene habituates instead of creating memory spam')

if (failures) throw new Error(String(failures) + ' world sensory field test(s) failed')
console.log('World sensory field v0.1: tests passed; interpretation=0; external_llm_calls=0')
