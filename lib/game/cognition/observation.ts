// Shared epistemic observation contract for NOXIA.
// Observations are evidence with provenance, not canonical world truth.

export type ObservationModality = 'visual' | 'auditory' | 'tactile' | 'proprioceptive' | 'thermal' | 'olfactory' | 'gustatory' | 'reported' | 'map' | 'sensor' | 'system_record'

export interface ObservationSource {
  id: string
  type: 'person' | 'sensor' | 'map' | 'record' | 'system_record' | 'network' | 'simulation'
  provenanceRefs?: string[]
}

export interface Observation<T = unknown> {
  id: string
  observerId: string
  subjectRef: string
  attribute: string
  value: T
  source: ObservationSource
  modality: ObservationModality
  observedAtTick: number
  confidence: number
  salience: number
  spatialResolutionM?: number
}

export interface WorldStateClaim<T = unknown> {
  subjectRef: string
  attribute: string
  value: T
  confidence: number
  status: 'observed' | 'inferred' | 'contradicted' | 'superseded'
  evidenceObservationIds: string[]
}

export interface EvidenceLink {
  observationId: string
  claimRef: string
  relation: 'supports' | 'contradicts' | 'supersedes'
}

const unit=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0))

export function normalizeObservation<T>(observation: Observation<T>): Observation<T> {
  return {
    ...observation,
    confidence: unit(observation.confidence),
    salience: unit(observation.salience),
    spatialResolutionM: observation.spatialResolutionM == null ? undefined : Math.max(0, observation.spatialResolutionM),
  }
}

export function observationClaimRef(observation: Pick<Observation,'subjectRef'|'attribute'>) {
  return observation.subjectRef + '#' + observation.attribute
}
