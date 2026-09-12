import type { InteriorRoomDef } from '../types'
import {
  getInteriorCapabilityDefinition,
  isInteriorCapabilityId,
  type InteriorCapabilityDefinition,
  type InteriorCapabilityId,
} from './registry'
import {
  getInteriorFunctionsForCapability,
  type InteriorFunctionDefinition,
} from './functions'

export interface ResolvedRoomFunctions {
  capabilityIds: InteriorCapabilityId[]
  capabilities: InteriorCapabilityDefinition[]
  functions: InteriorFunctionDefinition[]
  unknownCapabilityIds: string[]
}

export function resolveRoomFunctions(room: InteriorRoomDef): ResolvedRoomFunctions {
  const declared = room.capabilities ?? []
  const capabilityIds = declared.filter(isInteriorCapabilityId)
  const unknownCapabilityIds = declared.filter(value => !isInteriorCapabilityId(value))
  const capabilities = capabilityIds
    .map(getInteriorCapabilityDefinition)
    .filter((definition): definition is InteriorCapabilityDefinition => definition !== null)
  const functions = capabilityIds.flatMap(getInteriorFunctionsForCapability)

  return {
    capabilityIds,
    capabilities,
    functions,
    unknownCapabilityIds,
  }
}

export function roomHasCapability(
  room: InteriorRoomDef,
  capabilityId: InteriorCapabilityId,
): boolean {
  return room.capabilities?.includes(capabilityId) ?? false
}
