import type { LocalSurfacePoint, LocalSurfaceScene } from '../spatial/localSurfaceScene'
import { filterPerception, type PerceptionDecision, type PerceptionFilterState } from './npcPerceptionFilter'
import { buildWorldSensoryField, type SensoryEnvironmentState } from './worldSensoryField'
import {
  receiveSensoryField,
  sensoryReceptionObservation,
  type SensoryObserverProfile,
  type SensoryReception,
} from './sensoryLayer'
import type { Observation } from './observation'

export interface SensoryScenePerceptionResult {
  receptions: SensoryReception[]
  emitted: Observation[]
  decisions: PerceptionDecision[]
  nextState: PerceptionFilterState
}

export function observeSensoryScene(input: {
  scene: LocalSurfaceScene
  observerId: string
  observerPoint: LocalSurfacePoint
  atTick: number
  state: PerceptionFilterState
  environment?: Omit<SensoryEnvironmentState, 'tick'>
  profile?: Omit<SensoryObserverProfile, 'observerId' | 'position'>
}): SensoryScenePerceptionResult {
  const stimuli = buildWorldSensoryField({
    scene: input.scene,
    environment: {
      tick: input.atTick,
      ...(input.environment ?? {}),
    },
  })

  // Prevent self-perception through world-source mobile objects. Proprioception,
  // when present, must be emitted explicitly by the body runtime instead.
  const externalStimuli = stimuli.filter(stimulus =>
    stimulus.sourceRef !== input.observerId
      && stimulus.sourceRef !== 'resident:' + input.observerId
      && stimulus.sourceRef !== 'person:' + input.observerId,
  )

  const receptions = receiveSensoryField({
    stimuli: externalStimuli,
    observer: {
      observerId: input.observerId,
      position: input.observerPoint,
      ...(input.profile ?? {}),
    },
  })

  let state = input.state
  const emitted: Observation[] = []
  const decisions: PerceptionDecision[] = []

  for (const reception of receptions) {
    const observation = sensoryReceptionObservation(reception)
    const decision = filterPerception({
      state,
      observation,
      refreshAfterTicks: 240,
      salientRepeatAfterTicks: 24,
    })
    decisions.push(decision)
    state = decision.nextState
    if (decision.emit) emitted.push(observation)
  }

  return { receptions, emitted, decisions, nextState: state }
}
