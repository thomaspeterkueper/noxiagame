import { createInteriorInstance } from './instances'
import {
  getInteriorTemplateForBuildingType,
  type InteriorTemplateRegistry,
  INTERIOR_TEMPLATE_REGISTRY,
} from './registry'
import type { BuildingInstanceId, InteriorInstance, InteriorInstanceId } from './types'

export interface InteriorBindableBuildingInstance {
  id: BuildingInstanceId
  buildingTypeId: string
}

export interface CreateInteriorBindingOptions {
  interiorInstanceId: InteriorInstanceId
  registry?: InteriorTemplateRegistry
}

export interface InteriorBindingResult {
  buildingInstanceId: BuildingInstanceId
  buildingTypeId: string
  interior: InteriorInstance
}

export function createInteriorForBuildingInstance(
  building: InteriorBindableBuildingInstance,
  options: CreateInteriorBindingOptions,
): InteriorBindingResult | null {
  const template = getInteriorTemplateForBuildingType(
    building.buildingTypeId,
    options.registry ?? INTERIOR_TEMPLATE_REGISTRY,
  )

  if (!template) return null

  return {
    buildingInstanceId: building.id,
    buildingTypeId: building.buildingTypeId,
    interior: createInteriorInstance(template, {
      id: options.interiorInstanceId,
      buildingInstanceId: building.id,
    }),
  }
}
