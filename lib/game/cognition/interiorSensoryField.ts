import type { InteriorInstance, InteriorRoomDef } from '../buildings/interiors/types'
import type { SensoryStimulus } from './sensoryLayer'

const unit = (value: number | undefined, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback

function roomAcousticProfile(room: InteriorRoomDef): {
  intensity: number
  periodicity: number
  complexity: number
  sourceClass: string
} {
  switch (room.kind) {
    case 'workshop':
      return { intensity: 0.62, periodicity: 0.68, complexity: 0.58, sourceClass: 'workshop_machinery' }
    case 'laboratory':
      return { intensity: 0.34, periodicity: 0.52, complexity: 0.46, sourceClass: 'laboratory_equipment' }
    case 'technical':
    case 'utility':
      return { intensity: 0.46, periodicity: 0.74, complexity: 0.35, sourceClass: 'life_support_machinery' }
    case 'hospitality':
      return { intensity: 0.28, periodicity: 0.2, complexity: 0.7, sourceClass: 'human_activity' }
    case 'habitation':
      return { intensity: 0.18, periodicity: 0.18, complexity: 0.52, sourceClass: 'domestic_ambience' }
    default:
      return { intensity: 0.16, periodicity: 0.24, complexity: 0.34, sourceClass: 'interior_ambience' }
  }
}

/**
 * Converts already-authoritative interior room state into local physical stimuli.
 * The room is treated as a local field, not as a point source.
 */
export function buildInteriorSensoryField(input: {
  instance: InteriorInstance
  room: InteriorRoomDef
  tick: number
}): SensoryStimulus[] {
  const state = input.instance.roomStates[input.room.id]
  if (!state) return []

  const sourceRef = `interior:${input.instance.id}:room:${input.room.id}`
  const refs = [input.instance.id, input.room.id]
  const stimuli: SensoryStimulus[] = []

  if (state.temperatureC != null) {
    const deviation = Math.abs(state.temperatureC - 21)
    stimuli.push({
      id: `${sourceRef}:thermal:${input.tick}`,
      sourceRef,
      modality: 'thermal',
      vector: {
        intensity: Math.max(0.06, unit(deviation / 20)),
        novelty: unit(deviation / 18),
        features: {
          sourceClass: 'room_temperature',
          temperatureC: state.temperatureC,
          operationalState: state.operationalState,
        },
      },
      emittedAtTick: input.tick,
      provenanceRefs: refs,
    })
  }

  if (state.pressureKPa != null) {
    stimuli.push({
      id: `${sourceRef}:pressure:${input.tick}`,
      sourceRef,
      modality: 'interoceptive',
      vector: {
        intensity: unit(Math.abs(state.pressureKPa - 101.3) / 60),
        novelty: unit(Math.abs(state.pressureKPa - 101.3) / 50),
        features: {
          sourceClass: 'ambient_pressure',
          pressureKPa: state.pressureKPa,
        },
      },
      emittedAtTick: input.tick,
      provenanceRefs: refs,
    })
  }

  const acoustic = roomAcousticProfile(input.room)
  if (state.powerAvailable !== false) {
    stimuli.push({
      id: `${sourceRef}:ambient-sound:${input.tick}`,
      sourceRef,
      modality: 'auditory',
      vector: {
        intensity: acoustic.intensity,
        novelty: state.operationalState === 'operational' ? 0.1 : 0.55,
        periodicity: acoustic.periodicity,
        complexity: acoustic.complexity,
        features: {
          sourceClass: acoustic.sourceClass,
          roomKind: input.room.kind,
          operationalState: state.operationalState,
        },
      },
      emittedAtTick: input.tick,
      provenanceRefs: refs,
    })
  }

  if (state.oxygenFraction != null) {
    const deviation = Math.abs(state.oxygenFraction - 0.2095)
    // Oxygen has no dedicated human sensory channel. We therefore do not create
    // an "oxygen smell". Only marked deviation contributes a generic bodily cue.
    if (deviation >= 0.025) {
      stimuli.push({
        id: `${sourceRef}:oxygen-body-cue:${input.tick}`,
        sourceRef: 'body-environment:' + input.instance.id + ':' + input.room.id,
        modality: 'interoceptive',
        vector: {
          intensity: unit(deviation / 0.12),
          novelty: unit(deviation / 0.08),
          features: {
            sourceClass: 'respiratory_environment',
            oxygenFraction: state.oxygenFraction,
          },
        },
        emittedAtTick: input.tick,
        provenanceRefs: refs,
      })
    }
  }

  return stimuli
}
