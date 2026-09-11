export type InteriorTemplateId = string
export type InteriorInstanceId = string
export type LevelId = string
export type RoomId = string
export type PortalId = string
export type BuildingInstanceId = string

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
  buildingTypeId: string
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
  occupancy?: number
  pressureKPa?: number
  temperatureC?: number
  oxygenFraction?: number
  powerAvailable?: boolean
}

export interface InteriorInstance {
  id: InteriorInstanceId
  templateId: InteriorTemplateId
  buildingInstanceId: BuildingInstanceId
  roomStates: Record<RoomId, InteriorRoomState>
  portalStates: Record<PortalId, InteriorPortalState>
}

export interface PersonnelAssignment {
  personId: string
  buildingInstanceId: BuildingInstanceId
  roomId: RoomId
  roleId: string
  shiftId?: string
}
