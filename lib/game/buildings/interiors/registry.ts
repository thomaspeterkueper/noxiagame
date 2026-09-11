import type { InteriorTemplate, InteriorTemplateId } from './types'
import { LABORATORY_STANDARD_INTERIOR } from './templates/laboratoryStandard'

export interface InteriorTemplateRegistry {
  byId: Readonly<Record<InteriorTemplateId, InteriorTemplate>>
  byBuildingTypeId: Readonly<Record<string, InteriorTemplateId>>
}

export const INTERIOR_TEMPLATE_REGISTRY: InteriorTemplateRegistry = {
  byId: {
    [LABORATORY_STANDARD_INTERIOR.id]: LABORATORY_STANDARD_INTERIOR,
  },
  byBuildingTypeId: {
    laboratory: LABORATORY_STANDARD_INTERIOR.id,
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
