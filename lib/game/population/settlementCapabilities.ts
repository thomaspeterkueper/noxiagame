// Canonical settlement capability vocabulary imported from OTA-SCI-0086 v1.2.
// This module is descriptive only: it contains no fertility, mortality, birth-rate,
// safe-gravity, cost, unlock, or population-growth values.

export const SETTLEMENT_HUMAN_CAPABILITIES = [
  'adult-survival-capable',
  'pregnancy-and-birth-capable',
  'child-development-capable',
  'multigenerational-capable',
] as const

export type SettlementHumanCapability =
  (typeof SETTLEMENT_HUMAN_CAPABILITIES)[number]

export const GRAVITY_ARCHITECTURE_MODES = [
  'native-only',
  'intermittent-ag',
  'mixed-gravity',
  'continuous-rotating-family-zone',
] as const

export type GravityArchitectureMode =
  (typeof GRAVITY_ARCHITECTURE_MODES)[number]

export interface SettlementHumanCapabilityProfile {
  /** World/location identifier owned by NOXIA. */
  locationId: string
  /** Capabilities are independent; lower levels never imply higher levels. */
  capabilities: SettlementHumanCapability[]
  gravityArchitecture: GravityArchitectureMode
  /** Read-only provenance; currently OTA-SCI-0086-2026-DE v1.2. */
  evidenceSourceDocumentId: string
  /** Engineering profile reference, not a NOXIA gameplay identifier. */
  engineeringProfileRevision: string | null
}

export const OTA_SCI_0086_V12 = 'OTA-SCI-0086-2026-DE'
export const ENG_GRAVITY_HUMAN_ENVIRONMENT_R1 =
  'ENG-GRAVITY-HUMAN-ENVIRONMENT-r1'

export function hasSettlementHumanCapability(
  profile: SettlementHumanCapabilityProfile,
  capability: SettlementHumanCapability,
): boolean {
  return profile.capabilities.includes(capability)
}

export function createUnassessedHumanCapabilityProfile(
  locationId: string,
): SettlementHumanCapabilityProfile {
  return {
    locationId,
    capabilities: [],
    gravityArchitecture: 'native-only',
    evidenceSourceDocumentId: OTA_SCI_0086_V12,
    engineeringProfileRevision: ENG_GRAVITY_HUMAN_ENVIRONMENT_R1,
  }
}
