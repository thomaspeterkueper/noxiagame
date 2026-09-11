import type {
  InteriorInstance,
  InteriorInstanceId,
  InteriorPortalState,
  InteriorRoomState,
  InteriorTemplate,
  BuildingInstanceId,
} from './types'

export interface CreateInteriorInstanceOptions {
  id: InteriorInstanceId
  buildingInstanceId: BuildingInstanceId
}

export function createInteriorInstance(
  template: InteriorTemplate,
  options: CreateInteriorInstanceOptions,
): InteriorInstance {
  const roomStates = Object.fromEntries(
    template.rooms.map(room => [
      room.id,
      {
        roomId: room.id,
        operationalState: 'operational',
        occupancy: 0,
      } satisfies InteriorRoomState,
    ]),
  )

  const portalStates = Object.fromEntries(
    template.portals.map(portal => [
      portal.id,
      {
        portalId: portal.id,
        state: portal.normallyOpen ? 'open' : 'closed',
        damage: 0,
      } satisfies InteriorPortalState,
    ]),
  )

  return {
    id: options.id,
    templateId: template.id,
    buildingInstanceId: options.buildingInstanceId,
    roomStates,
    portalStates,
  }
}
