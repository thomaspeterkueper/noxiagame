import type { InteriorInstance, InteriorTemplate, PortalId, RoomId } from './types'

export interface InteriorRouteStep {
  fromRoomId: RoomId
  toRoomId: RoomId
  portalId: PortalId
}

export interface InteriorRoute {
  rooms: RoomId[]
  steps: InteriorRouteStep[]
}

export interface FindInteriorRouteOptions {
  canUsePortal?: (portalId: PortalId) => boolean
}

export function isPortalTraversable(instance: InteriorInstance, portalId: PortalId): boolean {
  const state = instance.portalStates[portalId]?.state
  return state === 'open' || state === 'closed'
}

export function findInteriorRoute(
  template: InteriorTemplate,
  instance: InteriorInstance,
  startRoomId: RoomId,
  targetRoomId: RoomId,
  options: FindInteriorRouteOptions = {},
): InteriorRoute | null {
  if (startRoomId === targetRoomId) return { rooms: [startRoomId], steps: [] }

  const knownRooms = new Set(template.rooms.map(room => room.id))
  if (!knownRooms.has(startRoomId) || !knownRooms.has(targetRoomId)) return null

  const previous = new Map<RoomId, { roomId: RoomId; portalId: PortalId }>()
  const visited = new Set<RoomId>([startRoomId])
  const queue: RoomId[] = [startRoomId]

  while (queue.length) {
    const currentRoomId = queue.shift()!

    for (const portal of template.portals) {
      let nextRoomId: RoomId | null = null
      if (portal.fromRoomId === currentRoomId) nextRoomId = portal.toRoomId
      else if (portal.toRoomId === currentRoomId) nextRoomId = portal.fromRoomId
      if (!nextRoomId || visited.has(nextRoomId)) continue

      const permitted = options.canUsePortal
        ? options.canUsePortal(portal.id)
        : isPortalTraversable(instance, portal.id)
      if (!permitted) continue

      visited.add(nextRoomId)
      previous.set(nextRoomId, { roomId: currentRoomId, portalId: portal.id })

      if (nextRoomId === targetRoomId) {
        return buildRoute(previous, startRoomId, targetRoomId)
      }

      queue.push(nextRoomId)
    }
  }

  return null
}

function buildRoute(
  previous: Map<RoomId, { roomId: RoomId; portalId: PortalId }>,
  startRoomId: RoomId,
  targetRoomId: RoomId,
): InteriorRoute {
  const rooms: RoomId[] = [targetRoomId]
  const reverseSteps: InteriorRouteStep[] = []
  let currentRoomId = targetRoomId

  while (currentRoomId !== startRoomId) {
    const predecessor = previous.get(currentRoomId)
    if (!predecessor) throw new Error(`Cannot reconstruct interior route to ${targetRoomId}`)

    reverseSteps.push({
      fromRoomId: predecessor.roomId,
      toRoomId: currentRoomId,
      portalId: predecessor.portalId,
    })
    currentRoomId = predecessor.roomId
    rooms.push(currentRoomId)
  }

  return {
    rooms: rooms.reverse(),
    steps: reverseSteps.reverse(),
  }
}
