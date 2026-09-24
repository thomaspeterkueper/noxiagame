import { THARSIS_HUB_BUILDINGS } from '../seeds/tharsisHubSeed'
import {
  assessSettlementHumanCapabilities,
  type SettlementCapabilityAssessment,
  type SettlementCapabilityEvidence,
  type SettlementSupportCapability,
} from './settlementCapabilityGraph'

export interface RuntimeBuildingCapabilitySource {
  id: string
  entityId: string
  operational: boolean
}

/**
 * Conservative mapping from concrete NOXIA building identities to support
 * capabilities. Only functions explicitly represented by the current object
 * model are projected. Missing specialist services remain missing.
 */
export const BUILDING_SUPPORT_CAPABILITY_MAP: Readonly<
  Partial<Record<string, readonly SettlementSupportCapability[]>>
> = {
  habitat_cluster: ['habitation', 'radiation-safe-haven'],
  eclss_hub: ['eclss'],
  medical_core: ['general-medical-care'],
  medical_annex: ['general-medical-care'],
  school: ['schooling'],
}

export function projectBuildingCapabilityEvidence(
  buildings: readonly RuntimeBuildingCapabilitySource[],
): SettlementCapabilityEvidence[] {
  return buildings.flatMap(building =>
    (BUILDING_SUPPORT_CAPABILITY_MAP[building.entityId] ?? []).map(support => ({
      support,
      sourceRef: `building:${building.id}`,
      operational: building.operational,
    })),
  )
}

/**
 * Current canonical Tharsis seed projection. This deliberately does not claim
 * obstetrics, neonatology, developmental monitoring, child-development space
 * or gravity-transition support merely because a Medical Center or school
 * exists.
 */
export function assessCanonicalTharsisHubSeed(): SettlementCapabilityAssessment {
  const evidence = projectBuildingCapabilityEvidence(
    THARSIS_HUB_BUILDINGS.map(building => ({
      id: building.id,
      entityId: building.entityId,
      operational: true,
    })),
  )
  return assessSettlementHumanCapabilities('mars:tharsis-hub', evidence, 'native-only')
}
