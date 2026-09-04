export type CelestialBody = 'earth' | 'moon' | 'mars' | 'phobos' | 'other'

export type SpatialFrame = {
  locationId: string
  celestialBody: CelestialBody
  coordinateSystem: 'local-meters' | 'planetocentric-local-meters'
  originLatDeg?: number | null
  originLonDeg?: number | null
  originAltM: number
  extentWidthM?: number | null
  extentHeightM?: number | null
  canonicalSeed: number
}

export type LocalPosition = {
  xM: number
  yM: number
  zM?: number
  rotationDeg?: number
}

export type RectFootprint = {
  kind: 'rect'
  widthM: number
  depthM: number
}

export type PolygonFootprint = {
  kind: 'polygon'
  points: Array<{ xM: number; yM: number }>
}

export type Footprint = RectFootprint | PolygonFootprint

export type DataProvenance = 'observed' | 'derived' | 'simulated'

export type SpatialLayer<T> = {
  provenance: DataProvenance
  source?: string
  resolutionM?: number
  payload: T
}

export type BuildSiteType =
  | 'parcel'
  | 'campus'
  | 'district'
  | 'building-interior'
  | 'platform'
  | 'pad'
  | 'subsurface'

export type LocalBuildGrid = {
  columns: number
  rows: number
  cellWidthM: number
  cellDepthM: number
  originXM?: number
  originYM?: number
}

export type BuildSite = {
  id: string
  locationId: string
  parentSiteId?: string | null
  name: string
  type: BuildSiteType
  center: LocalPosition
  footprint?: Footprint | null
  buildGrid?: LocalBuildGrid | null
}

export type BuildPlacement = {
  locationId: string
  position: LocalPosition
  footprint: Footprint
  siteId?: string | null
  parentEntityId?: string | null
  childSlot?: string | null
}
