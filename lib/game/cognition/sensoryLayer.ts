import type { Observation, ObservationModality } from './observation'

export type SensoryModality =
  | 'visual'
  | 'auditory'
  | 'tactile'
  | 'proprioceptive'
  | 'interoceptive'
  | 'thermal'
  | 'olfactory'
  | 'gustatory'

export interface SensoryVector {
  /** Normalized physical intensity at the source, before attenuation. */
  intensity: number
  /** 0..1: how unusual the stimulus is in the current environment. */
  novelty?: number
  /** Optional generic periodicity, useful for rhythm/vibration. */
  periodicity?: number
  /** Optional variation/complexity of the physical signal. */
  complexity?: number
  /** Optional human-readable but non-semantic physical descriptors. */
  features?: Record<string, number | string | boolean>
}

export interface SensoryStimulus {
  id: string
  sourceRef: string
  modality: SensoryModality
  vector: SensoryVector
  emittedAtTick: number
  position?: { xM: number; yM: number }
  /** Maximum useful physical reach. Touch/taste should normally be near zero. */
  rangeM?: number
  provenanceRefs?: string[]
}

export interface SensoryObserverProfile {
  observerId: string
  position?: { xM: number; yM: number }
  sensitivity?: Partial<Record<SensoryModality, number>>
  attention?: Partial<Record<SensoryModality, number>>
  blockedModalities?: SensoryModality[]
}

export interface SensoryReception {
  stimulusId: string
  observerId: string
  sourceRef: string
  modality: SensoryModality
  receivedIntensity: number
  clarity: number
  novelty: number
  features: Record<string, number | string | boolean>
  atTick: number
  provenanceRefs: string[]
}

const unit = (value: number | undefined, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback

function distance(
  a: { xM: number; yM: number } | undefined,
  b: { xM: number; yM: number } | undefined,
): number | null {
  if (!a || !b) return null
  return Math.hypot(a.xM - b.xM, a.yM - b.yM)
}

function attenuation(stimulus: SensoryStimulus, observer: SensoryObserverProfile): number {
  if (stimulus.modality === 'tactile' || stimulus.modality === 'gustatory') {
    const d = distance(stimulus.position, observer.position)
    return d == null ? 1 : d <= Math.max(0.2, stimulus.rangeM ?? 0.5) ? 1 : 0
  }

  if (stimulus.modality === 'proprioceptive') {
    return stimulus.sourceRef === observer.observerId || stimulus.sourceRef === 'body:' + observer.observerId ? 1 : 0
  }

  if (stimulus.modality === 'interoceptive') {
    // Interoceptive signals are already body-integrated cues produced by a body/
    // physiology adapter. They are observer-local and do not attenuate spatially.
    return 1
  }

  const d = distance(stimulus.position, observer.position)
  if (d == null) return 1
  const range = Math.max(0.5, stimulus.rangeM ?? defaultRange(stimulus.modality))
  if (d >= range) return 0
  const ratio = d / range

  switch (stimulus.modality) {
    case 'auditory':
      return unit(1 - ratio * ratio)
    case 'olfactory':
      return unit(1 - ratio)
    case 'thermal':
      return unit(1 - ratio * 0.85)
    case 'visual':
      return unit(1 - ratio * 0.72)
    default:
      return unit(1 - ratio)
  }
}

function defaultRange(modality: SensoryModality): number {
  switch (modality) {
    case 'visual': return 60
    case 'auditory': return 35
    case 'olfactory': return 8
    case 'thermal': return 2
    case 'tactile': return 0.5
    case 'gustatory': return 0.1
    case 'proprioceptive': return 0
    case 'interoceptive': return 0
  }
}

/**
 * Physical reception only. It deliberately does not infer meaning.
 * A voice may arrive as sound structure; it is not yet "mother speaking".
 */
export function receiveSensoryStimulus(
  stimulus: SensoryStimulus,
  observer: SensoryObserverProfile,
): SensoryReception | null {
  if (observer.blockedModalities?.includes(stimulus.modality)) return null

  const sensitivity = unit(observer.sensitivity?.[stimulus.modality], 1)
  const attention = unit(observer.attention?.[stimulus.modality], 1)
  const receivedIntensity = unit(unit(stimulus.vector.intensity) * attenuation(stimulus, observer) * sensitivity)
  if (receivedIntensity <= 0.01) return null

  // Attention affects clarity much more than raw physical arrival.
  const clarity = unit(receivedIntensity * (0.55 + attention * 0.45))

  return {
    stimulusId: stimulus.id,
    observerId: observer.observerId,
    sourceRef: stimulus.sourceRef,
    modality: stimulus.modality,
    receivedIntensity,
    clarity,
    novelty: unit(stimulus.vector.novelty, 0.5),
    features: { ...(stimulus.vector.features ?? {}), ...(stimulus.vector.periodicity == null ? {} : { periodicity: unit(stimulus.vector.periodicity) }), ...(stimulus.vector.complexity == null ? {} : { complexity: unit(stimulus.vector.complexity) }) },
    atTick: stimulus.emittedAtTick,
    provenanceRefs: [...(stimulus.provenanceRefs ?? [])],
  }
}

const observationModality = (modality: SensoryModality): ObservationModality => modality

/**
 * Converts physical reception into epistemic evidence without semantic inflation.
 */
export function sensoryReceptionObservation(reception: SensoryReception): Observation<{
  intensity: number
  clarity: number
  novelty: number
  features: Record<string, number | string | boolean>
}> {
  return {
    id: 'sensory:' + reception.observerId + ':' + reception.stimulusId + ':' + reception.atTick,
    observerId: reception.observerId,
    subjectRef: reception.sourceRef,
    attribute: 'sensory_signal',
    value: {
      intensity: reception.receivedIntensity,
      clarity: reception.clarity,
      novelty: reception.novelty,
      features: reception.features,
    },
    source: {
      id: 'sensory-stimulus:' + reception.stimulusId,
      type: 'simulation',
      provenanceRefs: reception.provenanceRefs,
    },
    modality: observationModality(reception.modality),
    observedAtTick: reception.atTick,
    confidence: reception.clarity,
    salience: unit(reception.receivedIntensity * 0.55 + reception.novelty * 0.25 + reception.clarity * 0.20),
  }
}

export function receiveSensoryField(input: {
  stimuli: SensoryStimulus[]
  observer: SensoryObserverProfile
}): SensoryReception[] {
  return input.stimuli
    .map(stimulus => receiveSensoryStimulus(stimulus, input.observer))
    .filter((value): value is SensoryReception => value !== null)
    .sort((a, b) => b.receivedIntensity - a.receivedIntensity || a.stimulusId.localeCompare(b.stimulusId))
}
