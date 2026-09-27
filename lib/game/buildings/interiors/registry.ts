import type { InteriorTemplate, InteriorTemplateId } from './types'
import { LABORATORY_STANDARD_INTERIOR } from './templates/laboratoryStandard'
import { ORBITAL_TRANSFER_STATION_INTERIOR } from './templates/orbitalTransferStation'
import { PRESSURIZED_HABITAT_CLUSTER_INTERIOR } from './templates/pressurizedHabitatCluster'
import { RESONANCE_CENTRE_INTERIOR } from './templates/resonanceCentre'
import { COMMUNITY_HALL_INTERIOR } from './templates/communityHall'
import { ARCHIVE_LIBRARY_INTERIOR } from './templates/archiveLibrary'
import { SACRED_SPACE_INTERIOR } from './templates/sacredSpace'

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
    [RESONANCE_CENTRE_INTERIOR.id]: RESONANCE_CENTRE_INTERIOR,
    [COMMUNITY_HALL_INTERIOR.id]: COMMUNITY_HALL_INTERIOR,
    [ARCHIVE_LIBRARY_INTERIOR.id]: ARCHIVE_LIBRARY_INTERIOR,
    [SACRED_SPACE_INTERIOR.id]: SACRED_SPACE_INTERIOR,
  },
  byBuildingTypeId: {
    laboratory: LABORATORY_STANDARD_INTERIOR.id,
    habitat_cluster: PRESSURIZED_HABITAT_CLUSTER_INTERIOR.id,
    resonance_centre: RESONANCE_CENTRE_INTERIOR.id,
    community_hall: COMMUNITY_HALL_INTERIOR.id,
    archive_library: ARCHIVE_LIBRARY_INTERIOR.id,
    sacred_space: SACRED_SPACE_INTERIOR.id,
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
