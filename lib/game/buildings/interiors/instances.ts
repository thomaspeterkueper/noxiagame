import type {
  InteriorHostRef,
  InteriorInstance,
  InteriorInstanceId,
  InteriorPortalState,
  InteriorRoomState,
  InteriorTemplate,
  BuildingInstanceId,
} from './types'

export type CreateInteriorInstanceOptions =
  | {
      id: InteriorInstanceId
      host: InteriorHostRef
      buildingInstanceId?: never
    }
  | {
      id: InteriorInstanceId
      buildingInstanceId: BuildingInstanceId
      host?: never
    }

export interface InteriorInstanceValidationIssue {
  code:
    | 'template-mismatch'
    | 'host-mismatch'
    | 'missing-room-state'
    | 'unknown-room-state'
    | 'room-state-id-mismatch'
    | 'missing-portal-state'
    | 'unknown-portal-state'
    | 'portal-state-id-mismatch'
  message: string
}

function resolveHost(options: CreateInteriorInstanceOptions): InteriorHostRef {
  if ('host' in options && options.host) return options.host
  return { kind: 'building', id: options.buildingInstanceId }
}

export function createInteriorInstance(
  template: InteriorTemplate,
  options: CreateInteriorInstanceOptions,
): InteriorInstance {
  const host = resolveHost(options)
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
    host,
    buildingInstanceId: host.kind === 'building' ? host.id : undefined,
    roomStates,
    portalStates,
  }
}

export function validateInteriorInstance(
  template: InteriorTemplate,
  instance: InteriorInstance,
): InteriorInstanceValidationIssue[] {
  const issues: InteriorInstanceValidationIssue[] = []

  if (instance.templateId !== template.id) {
    issues.push({
      code: 'template-mismatch',
      message: `Instance ${instance.id} references template ${instance.templateId}, expected ${template.id}`,
    })
  }

  if (template.hostKinds && !template.hostKinds.includes(instance.host.kind)) {
    issues.push({
      code: 'host-mismatch',
      message: `Template ${template.id} does not allow host kind ${instance.host.kind}`,
    })
  }

  const roomIds = new Set(template.rooms.map(room => room.id))
  const portalIds = new Set(template.portals.map(portal => portal.id))

  for (const roomId of roomIds) {
    if (!instance.roomStates[roomId]) {
      issues.push({ code: 'missing-room-state', message: `Missing runtime state for room ${roomId}` })
    }
  }
  for (const [key, state] of Object.entries(instance.roomStates)) {
    if (!roomIds.has(key)) {
      issues.push({ code: 'unknown-room-state', message: `Runtime state references unknown room ${key}` })
    }
    if (state.roomId !== key) {
      issues.push({ code: 'room-state-id-mismatch', message: `Room state key ${key} contains roomId ${state.roomId}` })
    }
  }

  for (const portalId of portalIds) {
    if (!instance.portalStates[portalId]) {
      issues.push({ code: 'missing-portal-state', message: `Missing runtime state for portal ${portalId}` })
    }
  }
  for (const [key, state] of Object.entries(instance.portalStates)) {
    if (!portalIds.has(key)) {
      issues.push({ code: 'unknown-portal-state', message: `Runtime state references unknown portal ${key}` })
    }
    if (state.portalId !== key) {
      issues.push({ code: 'portal-state-id-mismatch', message: `Portal state key ${key} contains portalId ${state.portalId}` })
    }
  }

  return issues
}
