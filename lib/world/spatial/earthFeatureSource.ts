import type { GeoPoint, TemporalSpatialFeature } from './earthSpatial'

/**
 * Runtime-neutral contract for importing real Earth features.
 *
 * NOXIA deliberately keeps the provider behind this boundary. OSM/Overpass is
 * an excellent bootstrap source for current roads, waterways, buildings and
 * landuse, while historical/future epochs can provide different layers later.
 */
export type EarthFeatureClass =
  | 'road'
  | 'rail'
  | 'waterway'
  | 'water'
  | 'forest'
  | 'farmland'
  | 'building'
  | 'settlement'
  | 'industrial'
  | 'public'

export type GeoBounds = {
  south: number
  west: number
  north: number
  east: number
}

export type EarthFeatureQuery = {
  bounds: GeoBounds
  classes: EarthFeatureClass[]
  at?: string
}

export type EarthFeatureGeometry =
  | { kind: 'point'; coordinates: GeoPoint }
  | { kind: 'line'; coordinates: GeoPoint[] }
  | { kind: 'polygon'; coordinates: GeoPoint[] }

export type ImportedEarthFeature = TemporalSpatialFeature & {
  geometry: EarthFeatureGeometry
}

export interface EarthFeatureSource {
  readonly id: string
  load(query: EarthFeatureQuery): Promise<ImportedEarthFeature[]>
}

export const CURRENT_EARTH_BOOTSTRAP_CLASSES: EarthFeatureClass[] = [
  'road',
  'rail',
  'waterway',
  'water',
  'forest',
  'farmland',
  'building',
  'settlement',
  'industrial',
  'public',
]
