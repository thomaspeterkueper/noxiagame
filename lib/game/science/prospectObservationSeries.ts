import { observablesForResource } from './scientificInterpretation'

export type ObservationSeriesConfidence = 'low' | 'medium' | 'high'

export function observationSeriesConfidence(measurementCount: number): ObservationSeriesConfidence {
  if (measurementCount >= 3) return 'high'
  if (measurementCount >= 2) return 'medium'
  return 'low'
}

export function prospectObservationDescriptor(resourceType: string) {
  const observables = observablesForResource(resourceType)
  return {
    signalKind: observables.join('+'),
    sourceType: 'stickney_rover_sensor_suite_v1',
    interpretationLabel: `${resourceType}_prospect_candidate`,
    evidenceKind: 'indirect_surface_observation',
    observables,
  }
}

export function prospectGroundTruthKey(regionResourceId: string) {
  return `region_resource:${regionResourceId}`
}
