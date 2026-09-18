import { createInteriorInstance } from './instances'
import {
  getInteriorTemplateForBuildingType,
  type InteriorTemplateRegistry,
  INTERIOR_TEMPLATE_REGISTRY,
} from './registry'
import type {
  BuildingInstanceId,
  InteriorHostRef,
  InteriorInstance,
  InteriorInstanceId,
  InteriorTemplate,
  StationInstanceId,
} from './types'

export interface InteriorBindableBuildingInstance {
  id: BuildingInstanceId
  buildingTypeId: string
}

export interface InteriorBindableStationInstance {
  id: StationInstanceId
  stationSlug: string
}

export interface CreateInteriorBindingOptions {
  interiorInstanceId: InteriorInstanceId
  registry?: InteriorTemplateRegistry
}

export interface InteriorBindingResult {
  host: InteriorHostRef
  interior: InteriorInstance
  buildingInstanceId?: BuildingInstanceId
  buildingTypeId?: string
  stationInstanceId?: StationInstanceId
  stationSlug?: string
}

export function createInteriorForHost(
  host: InteriorHostRef,
  template: InteriorTemplate,
  interiorInstanceId: InteriorInstanceId,
): InteriorBindingResult {
  return {
    host,
    interior: createInteriorInstance(template, {
      id: interiorInstanceId,
      host,
    }),
  }
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

  const result = createInteriorForHost(
    { kind: 'building', id: building.id },
    template,
    options.interiorInstanceId,
  )

  return {
    ...result,
    buildingInstanceId: building.id,
    buildingTypeId: building.buildingTypeId,
  }
}

export function createInteriorForStationInstance(
  station: InteriorBindableStationInstance,
  template: InteriorTemplate,
  interiorInstanceId: InteriorInstanceId,
): InteriorBindingResult {
  const result = createInteriorForHost(
    { kind: 'station', id: station.id },
    template,
    interiorInstanceId,
  )

  return {
    ...result,
    stationInstanceId: station.id,
    stationSlug: station.stationSlug,
  }
}
