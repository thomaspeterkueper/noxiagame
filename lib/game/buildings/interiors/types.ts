export type InteriorTemplateId = string
export type InteriorInstanceId = string
export type LevelId = string
export type RoomId = string
export type PortalId = string
export type BuildingInstanceId = string
export type StationInstanceId = string

export type InteriorHostKind = 'building' | 'station'

/**
 * Identifies the physical host that owns the interior topology.
 * This is not an ownership, custody, operator, occupancy or global-location relation.
 */
export interface InteriorHostRef {
  kind: InteriorHostKind
  id: string
}

export type PortalKind =
  | 'door'
  | 'airlock'
  | 'hatch'
  | 'stairs'
  | 'elevator'
  | 'ladder'
  | 'tunnel'
  | 'passage'

export type RoomKind =
  | 'entrance'
  | 'corridor'
  | 'airlock'
  | 'laboratory'
  | 'workshop'
  | 'storage'
  | 'technical'
  | 'office'
  | 'medical'
  | 'habitation'
  | 'utility'
  | 'service'
  | 'other'

export interface InteriorLevelDef {
  id: LevelId
  name: string
  order: number
  elevationM?: number
}

export interface InteriorRoomDef {
  id: RoomId
  levelId: LevelId
  name: string
  kind: RoomKind
  capacity?: number
  capabilities?: string[]
  tags?: string[]
}

export interface InteriorPortalDef {
  id: PortalId
  kind: PortalKind
  fromRoomId: RoomId
  toRoomId: RoomId
  normallyOpen?: boolean
  pressureBoundary?: boolean
  accessTags?: string[]
}

export interface InteriorTemplate {
  id: InteriorTemplateId
  buildingTypeId?: string
  hostKinds?: InteriorHostKind[]
  name: string
  version: number
  levels: InteriorLevelDef[]
  rooms: InteriorRoomDef[]
  portals: InteriorPortalDef[]
}

export type PortalOperationalState = 'open' | 'closed' | 'locked' | 'blocked' | 'failed'
export type RoomOperationalState = 'operational' | 'degraded' | 'offline' | 'unsafe'

export interface InteriorPortalState {
  portalId: PortalId
  state: PortalOperationalState
  damage?: number
}

export interface InteriorRoomState {
  roomId: RoomId
  operationalState: RoomOperationalState
  /**
   * Derived/local presence count only. It is not the authoritative people
   * assignment, broad-location or occupancy relation from Core.
   */
  presentCount?: number
  pressureKPa?: number
  temperatureC?: number
  oxygenFraction?: number
  powerAvailable?: boolean
}

export interface InteriorInstance {
  id: InteriorInstanceId
  templateId: InteriorTemplateId
  host: InteriorHostRef
  /** @deprecated Use host. Kept while existing building consumers migrate. */
  buildingInstanceId?: BuildingInstanceId
  roomStates: Record<RoomId, InteriorRoomState>
  portalStates: Record<PortalId, InteriorPortalState>
}

/**
 * Read/projection shape for explicit room-level presence. Durable
 * home/work/temporary assignments remain authoritative in Core
 * `person_assignments` and must never be converted into room presence.
 */
export interface InteriorPresenceProjection {
  personId: string
  host: InteriorHostRef
  roomId: RoomId
  source: 'live-presence' | 'authoritative-presence'
}
