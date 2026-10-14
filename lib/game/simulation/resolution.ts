// Shared adaptive-resolution contract for NOXIA.
//
// This module does not materialize detail, mutate world state or grant knowledge.
// It only states whether a requested depth is physically available, whether the
// current simulation must refine, and whether an observer could epistemically
// access that depth.

export const RESOLUTION_DEPTHS = [
  'macro',
  'object',
  'component',
  'material',
  'molecular',
  'atomic',
  'subatomic',
] as const

export type ResolutionDepth = typeof RESOLUTION_DEPTHS[number]

export type ResolutionTrigger =
  | 'none'
  | 'causal'
  | 'observation'
  | 'interaction'
  | 'failure'
  | 'research'

export interface ResolutionAssessmentInput {
  /** Deepest layer the world's rules permit for this subject. */
  ontologicalDepth: ResolutionDepth
  /** Deepest layer currently represented explicitly by the simulation. */
  simulatedDepth: ResolutionDepth
  /** Deepest layer the observer can in principle measure/understand now. */
  epistemicDepth: ResolutionDepth
  /** Layer needed by the current operation. */
  requestedDepth: ResolutionDepth
  /** Why finer state is being requested. */
  trigger: ResolutionTrigger
}

export interface ResolutionAssessment {
  physicallyAvailable: boolean
  needsRefinement: boolean
  refinementJustified: boolean
  observerCanAccess: boolean
  /**
   * True only when the current explicit simulation is already sufficient for
   * the requested operation. This says nothing about what an observer knows.
   */
  coarseStateSufficient: boolean
}

export function resolutionRank(depth: ResolutionDepth): number {
  return RESOLUTION_DEPTHS.indexOf(depth)
}

export function isAtLeastResolution(actual: ResolutionDepth, required: ResolutionDepth): boolean {
  return resolutionRank(actual) >= resolutionRank(required)
}

export function assessResolution(input: ResolutionAssessmentInput): ResolutionAssessment {
  const physicallyAvailable = isAtLeastResolution(input.ontologicalDepth, input.requestedDepth)
  const alreadySimulated = isAtLeastResolution(input.simulatedDepth, input.requestedDepth)
  const needsRefinement = physicallyAvailable && !alreadySimulated
  const refinementJustified = needsRefinement && input.trigger !== 'none'
  const observerCanAccess = physicallyAvailable && isAtLeastResolution(input.epistemicDepth, input.requestedDepth)

  return {
    physicallyAvailable,
    needsRefinement,
    refinementJustified,
    observerCanAccess,
    coarseStateSufficient: physicallyAvailable && alreadySimulated,
  }
}

/**
 * Caps an observer-facing result at epistemic depth even when the engine has
 * resolved deeper state for causal reasons. This is the anti-omniscience rule.
 */
export function observerVisibleDepth(
  simulatedDepth: ResolutionDepth,
  epistemicDepth: ResolutionDepth,
): ResolutionDepth {
  return resolutionRank(simulatedDepth) <= resolutionRank(epistemicDepth)
    ? simulatedDepth
    : epistemicDepth
}
