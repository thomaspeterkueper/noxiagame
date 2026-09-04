export type SpatialProvenance = 'observed' | 'derived' | 'simulated'

export type WorldBody = 'earth' | 'moon' | 'mars' | 'other'

export interface MetricPoint {
  xM: number
  yM: number
  zM?: number
}

export interface Footprint extends MetricPoint {
  widthM: number
  depthM: number
  rotationDeg?: number
}

export type PlacementMode = 'legacy_tile' | 'world' | 'site_slot' | 'child'

export interface SpatialPlacement {
  mode: PlacementMode
  xM?: number | null
  yM?: number | null
  zM?: number | null
  rotationDeg?: number
  siteId?: string | null
  parentEntityId?: string | null
  slotKey?: string | null
}

export interface WorldFrame {
  locationId: string
  body: WorldBody
  coordinateSystem: string
  originLatDeg?: number | null
  originLonDeg?: number | null
  originAltM?: number | null
  worldSeed: string
  observedSource?: Record<string, unknown>
  derivedConfig?: Record<string, unknown>
}
