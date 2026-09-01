import type { EarthRegionAnchor } from './earthSpatial'
import { EARTH_CELL_SIZE_M, EARTH_CHUNK_SIZE_M } from './earthSpatial'

/**
 * First NOXIA Earth streaming anchor.
 *
 * The anchor is deliberately not a map boundary. It gives the local metric
 * projection a stable origin while the world can stream indefinitely in every
 * direction. The coordinate is in the real Sauerland region of Germany, which
 * allows later imported terrain/hydrography/settlement layers to line up with
 * real Earth geography.
 */
export const EARTH_SAUERLAND_REGION: EarthRegionAnchor = {
  id: 'earth-sauerland',
  name: 'Earth · Sauerland',
  origin: {
    lat: 51.325,
    lon: 8.005,
  },
  chunkSizeM: EARTH_CHUNK_SIZE_M,
  cellSizeM: EARTH_CELL_SIZE_M,
}

export const EARTH_REGIONS: Record<string, EarthRegionAnchor> = {
  [EARTH_SAUERLAND_REGION.id]: EARTH_SAUERLAND_REGION,
}

export function getEarthRegion(id: string): EarthRegionAnchor | null {
  return EARTH_REGIONS[id] ?? null
}
