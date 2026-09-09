import type { EarthRegionAnchor } from './earthSpatial'
import { EARTH_CELL_SIZE_M, EARTH_CHUNK_SIZE_M } from './earthSpatial'

/**
 * NOXIA Earth streaming anchors.
 *
 * An anchor is deliberately not a map boundary. It gives a regional metric
 * projection a stable origin while geography can stream indefinitely around
 * it. Persistence is still bound to the Sauerland frame until regional Earth
 * placement receives its own persisted region key.
 */
export const EARTH_SAUERLAND_REGION: EarthRegionAnchor = {
  id: 'earth-sauerland',
  name: 'Earth · Deutschland · Sauerland',
  origin: {
    lat: 51.325,
    lon: 8.005,
  },
  chunkSizeM: EARTH_CHUNK_SIZE_M,
  cellSizeM: EARTH_CELL_SIZE_M,
}

/**
 * Second Earth view region: Namibia's Erongo / Walvis Bay corridor.
 *
 * The coastal anchor deliberately contrasts Sauerland: arid terrain, major
 * port logistics, strong solar potential and large open development areas.
 * It starts as a real-data analysis region; building persistence follows once
 * Earth world objects carry a regional frame identifier.
 */
export const EARTH_NAMIBIA_ERONGO_REGION: EarthRegionAnchor = {
  id: 'earth-namibia-erongo',
  name: 'Earth · Namibia · Erongo / Walvis Bay',
  origin: {
    lat: -22.9576,
    lon: 14.5053,
  },
  chunkSizeM: EARTH_CHUNK_SIZE_M,
  cellSizeM: EARTH_CELL_SIZE_M,
}

export const EARTH_REGIONS: Record<string, EarthRegionAnchor> = {
  [EARTH_SAUERLAND_REGION.id]: EARTH_SAUERLAND_REGION,
  [EARTH_NAMIBIA_ERONGO_REGION.id]: EARTH_NAMIBIA_ERONGO_REGION,
}

export function getEarthRegion(id: string): EarthRegionAnchor | null {
  return EARTH_REGIONS[id] ?? null
}
