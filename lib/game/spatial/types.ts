export type SpatialProvenance = 'observed' | 'derived' | 'simulated'

export type WorldBody = 'earth' | 'moon' | 'mars' | 'other'
export type LatitudeType = 'planetographic' | 'planetocentric'
export type LongitudeDirection = 'positive_east'

export interface MetricPoint {
  xM: number
  yM: number
  zM?: number | null
}

export interface Footprint extends MetricPoint {
  widthM: number
  depthM: number
  rotationDeg?: number
}

export type PlacementMode = 'legacy_tile' | 'world'

export interface SpatialPlacement {
  mode: PlacementMode
  xM?: number | null
  yM?: number | null
  zM?: number | null
  rotationDeg?: number
  siteId?: string | null
}

export interface PlanetaryCoordinate {
  latDeg: number
  lonDeg: number
  elevationM?: number
}

export interface PlanetaryReference {
  body: WorldBody
  referenceFrame: string
  latitudeType: LatitudeType
  longitudeDirection: LongitudeDirection
  equatorialRadiusM: number
  polarRadiusM: number
  verticalDatum: string
}

export type WorldFrameOriginStatus = 'pending' | 'verified' | 'derived'

export interface WorldFrame {
  locationId: string
  body: WorldBody
  coordinateSystem: string
  originLatDeg?: number | null
  originLonDeg?: number | null
  originAltM?: number | null
  originStatus?: WorldFrameOriginStatus
  referenceFrame?: string | null
  latitudeType?: LatitudeType | null
  longitudeDirection?: LongitudeDirection | null
  equatorialRadiusM?: number | null
  polarRadiusM?: number | null
  verticalDatum?: string | null
  terrainDatasetId?: string | null
  worldSeed: string
  observedSource?: Record<string, unknown>
  derivedConfig?: Record<string, unknown>
}

export type TerrainDatasetStatus = 'catalogued' | 'ingesting' | 'ready' | 'disabled'
export type TerrainResolutionStatus = 'origin_pending' | 'dataset_pending' | 'unresolved' | 'resolved'

export interface TerrainDatasetDescriptor {
  id: string
  body: WorldBody
  locationId?: string | null
  provider: string
  datasetName: string
  datasetVersion?: string | null
  datasetKind: 'dem' | 'dsm'
  resolutionM?: number | null
  horizontalReference: string
  verticalReference: string
  latitudeType: LatitudeType
  longitudeDirection: LongitudeDirection
  sourceUri: string
  sourceLicense?: string | null
  accessMode: string
  status: TerrainDatasetStatus
  metadata?: Record<string, unknown>
}

export interface TerrainHeightSample {
  xM: number
  yM: number
  zM: number
}

export interface TerrainFootprintSummary {
  centerZ M?: never
  centerZM: number
  minZM: number
  maxZM: number
  meanZM: number
  foundationZM: number
  reliefM: number
  maxSlopeDeg: number
  sampleCount: number
}
