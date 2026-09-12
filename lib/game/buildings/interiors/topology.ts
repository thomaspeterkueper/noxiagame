import { isInteriorCapabilityId } from './functions/registry'
import type { InteriorTemplate, PortalId, RoomId } from './types'

export interface InteriorValidationIssue {
  code:
    | 'duplicate-level'
    | 'duplicate-room'
    | 'duplicate-portal'
    | 'unknown-room-level'
    | 'unknown-portal-room'
    | 'unknown-capability'
    | 'self-portal'
  message: string
}

export function validateInteriorTemplate(template: InteriorTemplate): InteriorValidationIssue[] {
  const issues: InteriorValidationIssue[] = []
  const levelIds = new Set<string>()
  const roomIds = new Set<string>()
  const portalIds = new Set<string>()

  for (const level of template.levels) {
    if (levelIds.has(level.id)) {
      issues.push({ code: 'duplicate-level', message: `Duplicate level id: ${level.id}` })
    }
    levelIds.add(level.id)
  }

  for (const room of template.rooms) {
    if (roomIds.has(room.id)) {
      issues.push({ code: 'duplicate-room', message: `Duplicate room id: ${room.id}` })
    }
    roomIds.add(room.id)
    if (!levelIds.has(room.levelId)) {
      issues.push({ code: 'unknown-room-level', message: `Room ${room.id} references unknown level ${room.levelId}` })
    }
    for (const capabilityId of room.capabilities ?? []) {
      if (!isInteriorCapabilityId(capabilityId)) {
        issues.push({
          code: 'unknown-capability',
          message: `Room ${room.id} references unknown capability ${capabilityId}`,
        })
      }
    }
  }

  for (const portal of template.portals) {
    if (portalIds.has(portal.id)) {
      issues.push({ code: 'duplicate-portal', message: `Duplicate portal id: ${portal.id}` })
    }
    portalIds.add(portal.id)

    if (!roomIds.has(portal.fromRoomId)) {
      issues.push({ code: 'unknown-portal-room', message: `Portal ${portal.id} references unknown room ${portal.fromRoomId}` })
    }
    if (!roomIds.has(portal.toRoomId)) {
      issues.push({ code: 'unknown-portal-room', message: `Portal ${portal.id} references unknown room ${portal.toRoomId}` })
    }
    if (portal.fromRoomId === portal.toRoomId) {
      issues.push({ code: 'self-portal', message: `Portal ${portal.id} connects room ${portal.fromRoomId} to itself` })
    }
  }

  return issues
}

export function getAdjacentRoomIds(template: InteriorTemplate, roomId: RoomId): RoomId[] {
  const adjacent = new Set<RoomId>()

  for (const portal of template.portals) {
    if (portal.fromRoomId === roomId) adjacent.add(portal.toRoomId)
    if (portal.toRoomId === roomId) adjacent.add(portal.fromRoomId)
  }

  return [...adjacent]
}

export function getPortalBetweenRooms(
  template: InteriorTemplate,
  firstRoomId: RoomId,
  secondRoomId: RoomId,
): PortalId | null {
  const portal = template.portals.find(candidate =>
    (candidate.fromRoomId === firstRoomId && candidate.toRoomId === secondRoomId)
    || (candidate.fromRoomId === secondRoomId && candidate.toRoomId === firstRoomId),
  )

  return portal?.id ?? null
}
