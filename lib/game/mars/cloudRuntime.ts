import { evaluateMarsCloud, type MarsCloudConditions, type MarsCloudEvaluation } from './cloudEvents'

/**
 * Experimental Mars atmosphere integration boundary.
 * Never infer activation from the presence of the module or test fixture.
 * No database, network, map, tick or other side effects.
 */
export interface MarsCloudFeatureFlags {
  enabled?: boolean
  experimentalHomogeneousNucleation?: boolean
}

export type MarsCloudRuntimeResult =
  | { status: 'disabled' }
  | { status: 'evaluated'; evaluation: MarsCloudEvaluation }

export function evaluateMarsCloudIfEnabled(
  conditions: MarsCloudConditions,
  flags: Readonly<MarsCloudFeatureFlags> = {},
): MarsCloudRuntimeResult {
  if (flags.enabled !== true) return { status: 'disabled' }
  return {
    status: 'evaluated',
    evaluation: evaluateMarsCloud(conditions, flags.experimentalHomogeneousNucleation === true),
  }
}
