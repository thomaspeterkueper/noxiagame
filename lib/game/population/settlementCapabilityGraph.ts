import type {
  GravityArchitectureMode,
  SettlementHumanCapability,
  SettlementHumanCapabilityProfile,
} from './settlementCapabilities'
import {
  ENG_GRAVITY_HUMAN_ENVIRONMENT_R1,
  OTA_SCI_0086_V12,
} from './settlementCapabilities'

export const SETTLEMENT_SUPPORT_CAPABILITIES = [
  'habitation',
  'eclss',
  'general-medical-care',
  'pregnancy-monitoring',
  'operative-obstetrics',
  'neonatal-care',
  'radiation-safe-haven',
  'child-development-space',
  'schooling',
  'developmental-monitoring',
  'gravity-transition-support',
  'artificial-gravity-access',
] as const

export type SettlementSupportCapability =
  (typeof SETTLEMENT_SUPPORT_CAPABILITIES)[number]

export interface SettlementCapabilityEvidence {
  support: SettlementSupportCapability
  sourceRef: string
  operational: boolean
}

export interface SettlementCapabilityAssessment {
  profile: SettlementHumanCapabilityProfile
  missingByCapability: Partial<
    Record<SettlementHumanCapability, SettlementSupportCapability[]>
  >
}

/**
 * Runtime policy, not biological evidence. Requirements express which
 * infrastructure/service capabilities must be present before NOXIA may label
 * a settlement with an OTA capability class.
 *
 * AG is deliberately not a hard requirement here: OTA-SCI-0086 does not
 * establish a safe-g threshold or a mandatory AG dose. Gravity architecture
 * is recorded separately and can later participate in evidence-driven rules.
 */
export const SETTLEMENT_CAPABILITY_REQUIREMENTS: Record<
  SettlementHumanCapability,
  readonly SettlementSupportCapability[]
> = {
  'adult-survival-capable': ['habitation', 'eclss', 'general-medical-care', 'radiation-safe-haven'],
  'pregnancy-and-birth-capable': [
    'habitation',
    'eclss',
    'general-medical-care',
    'pregnancy-monitoring',
    'operative-obstetrics',
    'neonatal-care',
    'radiation-safe-haven',
  ],
  'child-development-capable': [
    'habitation',
    'eclss',
    'general-medical-care',
    'radiation-safe-haven',
    'child-development-space',
    'schooling',
    'developmental-monitoring',
    'gravity-transition-support',
  ],
  'multigenerational-capable': [
    'habitation',
    'eclss',
    'general-medical-care',
    'pregnancy-monitoring',
    'operative-obstetrics',
    'neonatal-care',
    'radiation-safe-haven',
    'child-development-space',
    'schooling',
    'developmental-monitoring',
    'gravity-transition-support',
  ],
}

export function assessSettlementHumanCapabilities(
  locationId: string,
  evidence: readonly SettlementCapabilityEvidence[],
  gravityArchitecture: GravityArchitectureMode = 'native-only',
): SettlementCapabilityAssessment {
  const available = new Set(
    evidence.filter(item => item.operational).map(item => item.support),
  )
  const capabilities: SettlementHumanCapability[] = []
  const missingByCapability: SettlementCapabilityAssessment['missingByCapability'] = {}

  for (const [capability, requirements] of Object.entries(
    SETTLEMENT_CAPABILITY_REQUIREMENTS,
  ) as [SettlementHumanCapability, readonly SettlementSupportCapability[]][]) {
    const missing = requirements.filter(required => !available.has(required))
    if (missing.length === 0) capabilities.push(capability)
    else missingByCapability[capability] = [...missing]
  }

  return {
    profile: {
      locationId,
      capabilities,
      gravityArchitecture,
      evidenceSourceDocumentId: OTA_SCI_0086_V12,
      engineeringProfileRevision: ENG_GRAVITY_HUMAN_ENVIRONMENT_R1,
    },
    missingByCapability,
  }
}
