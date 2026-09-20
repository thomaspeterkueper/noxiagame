// Shared launch-system architecture contract for NOXIA.
//
// A launch system selects how a spacecraft/payload reaches the existing Ascent Core.
// It does not replace ascent-control, orbit insertion, arrival-control or docking.
// Physical performance and quantitative economics remain authority-owned.

export type LaunchArchitecture =
  | 'vehicle-native-ascent'
  | 'carrier-rocket'

export type LaunchVehicleReusability =
  | 'expendable'
  | 'partially-reusable'
  | 'fully-reusable'
  | 'not-applicable'

export type LaunchServiceOwnership =
  | 'player-owned'
  | 'third-party-service'
  | 'public-service'
  | 'unresolved'

export interface LaunchEngineeringAuthority {
  architecture: LaunchArchitecture
  authorityId: string
  sourceRepository: string
  sourceReference: string
}

export interface LaunchSystemSelection {
  architecture: LaunchArchitecture
  spacecraftId: string
  carrierVehicleId?: string | null
  launchSiteId?: string | null
  reusability: LaunchVehicleReusability
  ownership: LaunchServiceOwnership
}

export type LaunchReadinessEvidenceState = 'ready' | 'blocked' | 'unresolved'

export interface LaunchSystemReadinessEvidence {
  spacecraft: LaunchReadinessEvidenceState
  launchArchitecture: LaunchReadinessEvidenceState
  carrierVehicle: LaunchReadinessEvidenceState
  launchSite: LaunchReadinessEvidenceState
  payloadIntegration: LaunchReadinessEvidenceState
  engineering: LaunchReadinessEvidenceState
}

export interface LaunchSystemReadiness {
  selection: LaunchSystemSelection
  evidence: LaunchSystemReadinessEvidence
  engineering: LaunchEngineeringAuthority | null
}

export interface LaunchEconomicAuthority {
  authorityId: string
  sourceRepository: string
  sourceReference: string
}

/**
 * Economic dimensions are deliberately structural, not numeric defaults.
 * They allow different launch technologies to coexist economically without
 * inventing costs before an owning economy/engineering source supplies them.
 */
export interface LaunchEconomicDimensions {
  launchServicePrice: number | null
  propellantAndConsumablesCost: number | null
  expendableHardwareCost: number | null
  refurbishmentCost: number | null
  padAndGroundOperationsCost: number | null
  payloadIntegrationCost: number | null
  recoveryOperationsCost: number | null
  insuranceAndRiskCost: number | null
  turnaroundTimeSeconds: number | null
  expectedAvailabilityWindowSeconds: number | null
  currency: string | null
  authority: LaunchEconomicAuthority | null
}

export function assessLaunchSystemReadiness(input: LaunchSystemReadiness) {
  const blockers: string[] = []
  const unresolved: string[] = []

  for (const [key, state] of Object.entries(input.evidence)) {
    if (state === 'blocked') blockers.push(key)
    if (state === 'unresolved') unresolved.push(key)
  }

  if (!input.engineering) unresolved.push('engineering-authority')

  return {
    ready: blockers.length === 0 && unresolved.length === 0,
    blockers,
    unresolved: [...new Set(unresolved)],
  }
}

export function carrierVehicleRequired(architecture: LaunchArchitecture): boolean {
  return architecture === 'carrier-rocket'
}

export function defaultLaunchEconomicDimensions(): LaunchEconomicDimensions {
  return {
    launchServicePrice: null,
    propellantAndConsumablesCost: null,
    expendableHardwareCost: null,
    refurbishmentCost: null,
    padAndGroundOperationsCost: null,
    payloadIntegrationCost: null,
    recoveryOperationsCost: null,
    insuranceAndRiskCost: null,
    turnaroundTimeSeconds: null,
    expectedAvailabilityWindowSeconds: null,
    currency: null,
    authority: null,
  }
}
