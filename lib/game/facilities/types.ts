// lib/game/facilities/types.ts
// Erstellt: 01.09.2026
// Kanonisches Domänenmodell für räumlich erweiterbare Anlagen.

export type FacilityType =
  | 'spaceport'
  | 'warehouse'
  | 'production'
  | 'research'
  | 'education'
  | 'administration'
  | 'utility'
  | string

export type FacilityModuleRole =
  | 'core'
  | 'pad'
  | 'storage'
  | 'cargo'
  | 'passenger'
  | 'service'
  | 'production'
  | 'research'
  | 'education'
  | 'utility'
  | 'control'
  | string

export type ShipClass = 'small' | 'standard' | 'heavy' | string

export interface TileOffset {
  row: number
  col: number
}

export interface FacilityCapacity {
  shipParking?: number
  activeShipOperations?: number
  shipClasses?: ShipClass[]
  storageUnits?: number
  passengerUnits?: number
  productionUnits?: number
  researchUnits?: number
}

export interface FacilityModuleDefinition {
  id: string
  name: string
  facilityType: FacilityType
  role: FacilityModuleRole
  description: string
  footprint: TileOffset[]
  allowedLocations?: string[]
  requiresFacility?: boolean
  requiresAdjacentRole?: FacilityModuleRole[]
  capacity?: FacilityCapacity
  capabilities: string[]
  buildable: boolean
  balancingStatus: 'canonical' | 'tuning'
}

export interface FacilityModuleInstance {
  id: string
  definitionId: string
  facilityId: string
  row: number
  col: number
  ownerClass: 'STATE' | 'PLAYER' | 'NPC' | 'CORPORATION'
  ownerId: string | null
  operatorId?: string | null
  occupantId?: string | null
  publicAccess?: boolean
}

export interface FacilityInstance {
  id: string
  facilityType: FacilityType
  name: string
  locationSlug: string
  ownerClass: 'STATE' | 'PLAYER' | 'NPC' | 'CORPORATION'
  ownerId: string | null
  operatorId?: string | null
  publicAccess: boolean
  moduleIds: string[]
}

export interface PlacementCellState {
  row: number
  col: number
  inBounds: boolean
  buildable: boolean
  legallyUsable: boolean
  occupied: boolean
  reason?: string
}

export interface ModulePlacementResult {
  allowed: boolean
  cells: PlacementCellState[]
  reasons: string[]
}
