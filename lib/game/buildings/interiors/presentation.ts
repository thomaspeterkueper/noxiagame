import { getInteriorCapabilityDefinition } from './functions/registry'
import { resolveRoomFunctions } from './functions/resolution'
import type { InteriorTemplate, RoomKind } from './types'

export interface InteriorOverviewCapability {
  id: string
  label: string
}

export interface InteriorOverviewFunction {
  id: string
  label: string
  kind: string
}

export interface InteriorOverviewRoom {
  id: string
  name: string
  kind: RoomKind
  capacity?: number
  tags: string[]
  capabilities: InteriorOverviewCapability[]
  functions: InteriorOverviewFunction[]
}

export interface InteriorOverviewLevel {
  id: string
  name: string
  order: number
  rooms: InteriorOverviewRoom[]
}

export interface InteriorTemplateOverview {
  templateId: string
  name: string
  version: number
  levels: InteriorOverviewLevel[]
}

/**
 * Read-only UI projection of an interior template. This deliberately exposes
 * topology/capability metadata only; it does not manufacture runtime room,
 * access, presence, inventory or environmental state.
 */
export function buildInteriorTemplateOverview(
  template: InteriorTemplate,
): InteriorTemplateOverview {
  return {
    templateId: template.id,
    name: template.name,
    version: template.version,
    levels: [...template.levels]
      .sort((a, b) => a.order - b.order)
      .map(level => ({
        id: level.id,
        name: level.name,
        order: level.order,
        rooms: template.rooms
          .filter(room => room.levelId === level.id)
          .map(room => {
            const resolved = resolveRoomFunctions(room)
            return {
              id: room.id,
              name: room.name,
              kind: room.kind,
              capacity: room.capacity,
              tags: [...(room.tags ?? [])],
              capabilities: (room.capabilities ?? []).map(capabilityId => {
                const definition = getInteriorCapabilityDefinition(capabilityId)
                return {
                  id: capabilityId,
                  label: definition?.label ?? capabilityId,
                }
              }),
              functions: resolved.functions.map(definition => ({
                id: definition.id,
                label: definition.label,
                kind: definition.kind,
              })),
            }
          }),
      })),
  }
}
