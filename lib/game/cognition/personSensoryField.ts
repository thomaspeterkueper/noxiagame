import type { Person, PersonActivityState } from '../population/types'
import type { LocalSurfacePoint } from '../spatial/localSurfaceScene'
import type { SensoryStimulus } from './sensoryLayer'

export type VocalExpression =
  | 'silent'
  | 'speech'
  | 'laughter'
  | 'crying'
  | 'singing'
  | 'calling'

export interface PersonExpressiveState {
  person: Person
  point: LocalSurfacePoint
  vocalExpression?: VocalExpression
  vocalIntensity?: number
  gazeTargetId?: string | null
  moving?: boolean
  speedMps?: number
  contactTargetIds?: string[]
  emotionalArousal?: number
}

const unit = (value: number | undefined, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback

function expressionDefaults(expression: VocalExpression): {
  intensity: number
  periodicity: number
  complexity: number
  sourceClass: string
} {
  switch (expression) {
    case 'speech':
      return { intensity: 0.34, periodicity: 0.38, complexity: 0.82, sourceClass: 'human_speech' }
    case 'laughter':
      return { intensity: 0.48, periodicity: 0.52, complexity: 0.58, sourceClass: 'human_laughter' }
    case 'crying':
      return { intensity: 0.56, periodicity: 0.62, complexity: 0.55, sourceClass: 'human_crying' }
    case 'singing':
      return { intensity: 0.42, periodicity: 0.82, complexity: 0.74, sourceClass: 'human_singing' }
    case 'calling':
      return { intensity: 0.62, periodicity: 0.28, complexity: 0.5, sourceClass: 'human_calling' }
    case 'silent':
      return { intensity: 0, periodicity: 0, complexity: 0, sourceClass: 'silence' }
  }
}

function activityMovement(activity: PersonActivityState) {
  return activity === 'travelling'
}

export function buildPersonSensoryStimuli(input: {
  state: PersonExpressiveState
  tick: number
}): SensoryStimulus[] {
  const { state, tick } = input
  const stimuli: SensoryStimulus[] = []
  const sourceRef = 'person:' + state.person.id

  stimuli.push({
    id: `${sourceRef}:visual:${tick}`,
    sourceRef,
    modality: 'visual',
    vector: {
      intensity: 0.5,
      novelty: 0.34,
      complexity: 0.72,
      features: {
        sourceClass: 'person_presence',
        activityState: state.person.activityState,
        moving: state.moving ?? activityMovement(state.person.activityState),
      },
    },
    emittedAtTick: tick,
    position: state.point,
    rangeM: 55,
  })

  const expression = state.vocalExpression ?? (state.person.activityState === 'socialising' ? 'speech' : 'silent')
  if (expression !== 'silent') {
    const defaults = expressionDefaults(expression)
    stimuli.push({
      id: `${sourceRef}:voice:${expression}:${tick}`,
      sourceRef,
      modality: 'auditory',
      vector: {
        intensity: unit(state.vocalIntensity, defaults.intensity),
        novelty: expression === 'speech' ? 0.26 : 0.48,
        periodicity: defaults.periodicity,
        complexity: defaults.complexity,
        features: {
          sourceClass: defaults.sourceClass,
          expression,
          emotionalArousal: unit(state.emotionalArousal, 0.3),
        },
      },
      emittedAtTick: tick,
      position: state.point,
      rangeM: expression === 'calling' ? 30 : 16,
    })
  }

  const moving = state.moving ?? activityMovement(state.person.activityState)
  if (moving) {
    const speed = Math.max(0, state.speedMps ?? 1.2)
    stimuli.push({
      id: `${sourceRef}:steps:${tick}`,
      sourceRef,
      modality: 'auditory',
      vector: {
        intensity: unit(0.16 + Math.min(2.5, speed) * 0.1),
        novelty: 0.12,
        periodicity: unit(0.45 + Math.min(2, speed) * 0.18),
        complexity: 0.25,
        features: {
          sourceClass: 'footsteps',
          speedMps: speed,
        },
      },
      emittedAtTick: tick,
      position: state.point,
      rangeM: 10,
    })
  }

  if (state.gazeTargetId) {
    stimuli.push({
      id: `${sourceRef}:gaze:${state.gazeTargetId}:${tick}`,
      sourceRef,
      modality: 'visual',
      vector: {
        intensity: 0.42,
        novelty: 0.36,
        complexity: 0.4,
        features: {
          sourceClass: 'directed_gaze',
          targetId: state.gazeTargetId,
        },
      },
      emittedAtTick: tick,
      position: state.point,
      rangeM: 12,
    })
  }

  for (const targetId of state.contactTargetIds ?? []) {
    stimuli.push({
      id: `${sourceRef}:touch:${targetId}:${tick}`,
      sourceRef,
      modality: 'tactile',
      vector: {
        intensity: 0.68,
        novelty: 0.22,
        complexity: 0.38,
        features: {
          sourceClass: 'person_contact',
          targetId,
          warmth: 0.72,
          pressure: 0.42,
        },
      },
      emittedAtTick: tick,
      position: state.point,
      rangeM: 0.6,
    })
  }

  return stimuli
}

export function socialStimuliForObserver(input: {
  people: PersonExpressiveState[]
  observerId: string
  tick: number
}): SensoryStimulus[] {
  return input.people
    .filter(state => state.person.id !== input.observerId)
    .flatMap(state => buildPersonSensoryStimuli({ state, tick: input.tick }))
    .filter(stimulus => {
      if (stimulus.modality !== 'tactile') return true
      return stimulus.vector.features?.targetId === input.observerId
    })
    .sort((a, b) => a.sourceRef.localeCompare(b.sourceRef) || a.id.localeCompare(b.id))
}
