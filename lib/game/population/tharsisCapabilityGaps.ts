import type { SettlementHumanCapability } from './settlementCapabilities'
import {
  assessCanonicalTharsisHubSeed,
} from './settlementCapabilityProjection'
import type { SettlementSupportCapability } from './settlementCapabilityGraph'

export type CapabilityModuleKind =
  | 'medical-extension'
  | 'habitat-extension'
  | 'education-extension'
  | 'settlement-service'

export interface CapabilityGapModule {
  id: string
  kind: CapabilityModuleKind
  provides: readonly SettlementSupportCapability[]
  integrateWith: readonly string[]
  notes: string
}

/**
 * Functional modules needed to close Tharsis capability gaps. These are not
 * standalone building definitions and intentionally contain no gameplay cost,
 * build time, fertility, mortality, safe-g threshold or AG prescription.
 */
export const THARSIS_CAPABILITY_GAP_MODULES: readonly CapabilityGapModule[] = [
  {
    id: 'perinatal-care-suite',
    kind: 'medical-extension',
    provides: ['pregnancy-monitoring', 'operative-obstetrics', 'neonatal-care'],
    integrateWith: ['medical_core', 'medical_annex'],
    notes: 'Adds distinct antenatal, operative obstetric and neonatal functions; generic medical care alone is insufficient.',
  },
  {
    id: 'child-development-zone',
    kind: 'habitat-extension',
    provides: ['child-development-space'],
    integrateWith: ['habitat_cluster'],
    notes: 'Protected everyday movement, play, sleep and age-appropriate living space inside the inhabited pressure system.',
  },
  {
    id: 'development-services',
    kind: 'education-extension',
    provides: ['schooling', 'developmental-monitoring'],
    integrateWith: ['school', 'medical_core'],
    notes: 'Connects education with longitudinal developmental observation without treating school as a medical facility.',
  },
  {
    id: 'gravity-transition-service',
    kind: 'settlement-service',
    provides: ['gravity-transition-support'],
    integrateWith: ['medical_core', 'habitat_cluster'],
    notes: 'Assessment, conditioning and rehabilitation around gravity transitions; does not assert a safe gravity threshold.',
  },
] as const

export function getCanonicalTharsisCapabilityGaps(): Partial<
  Record<SettlementHumanCapability, readonly SettlementSupportCapability[]>
> {
  return assessCanonicalTharsisHubSeed().missingByCapability
}

export function getModulesForCapabilityGap(
  capability: SettlementHumanCapability,
): CapabilityGapModule[] {
  const missing = new Set(getCanonicalTharsisCapabilityGaps()[capability] ?? [])
  return THARSIS_CAPABILITY_GAP_MODULES.filter(module =>
    module.provides.some(provided => missing.has(provided)),
  )
}
