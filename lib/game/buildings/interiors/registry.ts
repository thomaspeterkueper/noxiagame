import type { InteriorTemplate, InteriorTemplateId } from './types'
import { LABORATORY_STANDARD_INTERIOR } from './templates/laboratoryStandard'
import { ORBITAL_TRANSFER_STATION_INTERIOR } from './templates/orbitalTransferStation'
import { PRESSURIZED_HABITAT_CLUSTER_INTERIOR } from './templates/pressurizedHabitatCluster'
import { CAFE_STANDARD_INTERIOR } from './templates/cafeStandard'
import { HABITAT_STANDARD_INTERIOR } from './templates/habitatStandard'
import { MEDICAL_STANDARD_INTERIOR } from './templates/medicalStandard'
import { WORKSHOP_STANDARD_INTERIOR } from './templates/workshopStandard'
import { LOGISTICS_STANDARD_INTERIOR } from './templates/logisticsStandard'
import { ACADEMY_STANDARD_INTERIOR } from './templates/academyStandard'
import { UTILITY_STANDARD_INTERIOR } from './templates/utilityStandard'
import { CIVIC_STANDARD_INTERIOR } from './templates/civicStandard'

export interface InteriorTemplateRegistry {
  byId: Readonly<Record<InteriorTemplateId, InteriorTemplate>>
  byBuildingTypeId: Readonly<Record<string, InteriorTemplateId>>
  byStationRole: Readonly<Record<string, InteriorTemplateId>>
}

export const INTERIOR_TEMPLATE_REGISTRY: InteriorTemplateRegistry = {
  byId: {
    [LABORATORY_STANDARD_INTERIOR.id]: LABORATORY_STANDARD_INTERIOR,
    [ORBITAL_TRANSFER_STATION_INTERIOR.id]: ORBITAL_TRANSFER_STATION_INTERIOR,
    [PRESSURIZED_HABITAT_CLUSTER_INTERIOR.id]: PRESSURIZED_HABITAT_CLUSTER_INTERIOR,
    [CAFE_STANDARD_INTERIOR.id]: CAFE_STANDARD_INTERIOR,
    [HABITAT_STANDARD_INTERIOR.id]: HABITAT_STANDARD_INTERIOR,
    [MEDICAL_STANDARD_INTERIOR.id]: MEDICAL_STANDARD_INTERIOR,
    [WORKSHOP_STANDARD_INTERIOR.id]: WORKSHOP_STANDARD_INTERIOR,
    [LOGISTICS_STANDARD_INTERIOR.id]: LOGISTICS_STANDARD_INTERIOR,
    [ACADEMY_STANDARD_INTERIOR.id]: ACADEMY_STANDARD_INTERIOR,
    [UTILITY_STANDARD_INTERIOR.id]: UTILITY_STANDARD_INTERIOR,
    [CIVIC_STANDARD_INTERIOR.id]: CIVIC_STANDARD_INTERIOR,
  },
  byBuildingTypeId: {
    laboratory: LABORATORY_STANDARD_INTERIOR.id,
    habitat_cluster: PRESSURIZED_HABITAT_CLUSTER_INTERIOR.id,
    cafe: CAFE_STANDARD_INTERIOR.id,
    'café': CAFE_STANDARD_INTERIOR.id,
    habitat: HABITAT_STANDARD_INTERIOR.id,
    residential_block: HABITAT_STANDARD_INTERIOR.id,
    medical_core: MEDICAL_STANDARD_INTERIOR.id,
    medical_annex: MEDICAL_STANDARD_INTERIOR.id,
    factory: WORKSHOP_STANDARD_INTERIOR.id,
    workshop: WORKSHOP_STANDARD_INTERIOR.id,
    surface_workshop: WORKSHOP_STANDARD_INTERIOR.id,
    workshop_clean: WORKSHOP_STANDARD_INTERIOR.id,
    workshop_heavy: WORKSHOP_STANDARD_INTERIOR.id,
    warehouse: LOGISTICS_STANDARD_INTERIOR.id,
    warehouse_storage: LOGISTICS_STANDARD_INTERIOR.id,
    logistics_hub: LOGISTICS_STANDARD_INTERIOR.id,
    reserve_depot: LOGISTICS_STANDARD_INTERIOR.id,
    school: ACADEMY_STANDARD_INTERIOR.id,
    academy: ACADEMY_STANDARD_INTERIOR.id,
    solar: UTILITY_STANDARD_INTERIOR.id,
    battery_storage: UTILITY_STANDARD_INTERIOR.id,
    life_support_hub: UTILITY_STANDARD_INTERIOR.id,
    eclss_hub: UTILITY_STANDARD_INTERIOR.id,
    reactor_module: UTILITY_STANDARD_INTERIOR.id,
    black_start: UTILITY_STANDARD_INTERIOR.id,
    water_recycler: UTILITY_STANDARD_INTERIOR.id,
    water_isru: UTILITY_STANDARD_INTERIOR.id,
    radiator_field: UTILITY_STANDARD_INTERIOR.id,
    admin: CIVIC_STANDARD_INTERIOR.id,
    bank: CIVIC_STANDARD_INTERIOR.id,
    command_node: CIVIC_STANDARD_INTERIOR.id,
  },
  byStationRole: {
    'habitat-transfer-station': ORBITAL_TRANSFER_STATION_INTERIOR.id,
    'free-port': ORBITAL_TRANSFER_STATION_INTERIOR.id,
    'orbital-depot': ORBITAL_TRANSFER_STATION_INTERIOR.id,
  },
}

export function getInteriorTemplateById(
  templateId: InteriorTemplateId,
  registry: InteriorTemplateRegistry = INTERIOR_TEMPLATE_REGISTRY,
): InteriorTemplate | null {
  return registry.byId[templateId] ?? null
}

export function getInteriorTemplateForBuildingType(
  buildingTypeId: string,
  registry: InteriorTemplateRegistry = INTERIOR_TEMPLATE_REGISTRY,
): InteriorTemplate | null {
  const templateId = registry.byBuildingTypeId[buildingTypeId]
  if (!templateId) return null
  return getInteriorTemplateById(templateId, registry)
}

/**
 * Resolves a presentation/topology template from the canonical station service
 * role supplied by `stationProfiles`. The mapping does not copy station service
 * truth into interiors; it only selects a compatible shared topology template.
 */
export function getInteriorTemplateForStationRole(
  stationRole: string,
  registry: InteriorTemplateRegistry = INTERIOR_TEMPLATE_REGISTRY,
): InteriorTemplate | null {
  const templateId = registry.byStationRole[stationRole]
  if (!templateId) return null
  return getInteriorTemplateById(templateId, registry)
}
