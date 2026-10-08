export type MarsCloudState = 'unresolved' | 'inactive' | 'candidate'
export interface MarsCloudConditions {
  regionId: string
  bucket: number
  localHour: number
  saturationRatio: number | null
  nucleiAvailability: number | null
  lift: number | null
  terrainAvailable: boolean
}
export interface MarsCloudEvaluation {
  eventId: string
  state: MarsCloudState
  mechanism: 'dust-mediated' | 'homogeneous-hypothesis' | 'unknown'
}
export function evaluateMarsCloud(
  input: MarsCloudConditions,
  homogeneousHypothesis = false,
): MarsCloudEvaluation {
  const eventId = `mars-cloud:${input.regionId}:${input.bucket}:v1`
  const outcome = (state: MarsCloudState, mechanism: MarsCloudEvaluation['mechanism']): MarsCloudEvaluation =>
    ({ eventId, state, mechanism })
  if (!input.terrainAvailable || !Number.isFinite(input.localHour) ||
      input.saturationRatio == null || input.nucleiAvailability == null || input.lift == null ||
      ![input.saturationRatio, input.nucleiAvailability, input.lift].every(Number.isFinite)) {
    return outcome('unresolved', 'unknown')
  }
  if (input.localHour < 5 || input.localHour >= 12 || input.lift < 0.5) return outcome('inactive', 'unknown')
  if (input.nucleiAvailability >= 0.25 && input.saturationRatio >= 1.1) {
    return outcome('candidate', 'dust-mediated')
  }
  if (homogeneousHypothesis && input.saturationRatio >= 2) {
    return outcome('candidate', 'homogeneous-hypothesis')
  }
  return outcome('inactive', 'unknown')
}
