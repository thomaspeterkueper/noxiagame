import type { EarthRegionAnchor } from './earthSpatial'
import { EARTH_CELL_SIZE_M, EARTH_CHUNK_SIZE_M } from './earthSpatial'
import { createPlanetaryViewAnchor } from '../../game/spatial/planetaryView'

/**
 * Legacy named Earth streaming/import anchors.
 *
 * These anchors are backend cache/import conveniences, not player navigation modes.
 * New arbitrary Earth views must use createEarthViewAnchor().
 * An anchor is deliberately not a map boundary and never owns an object's
 * canonical position. Earth persistence is global WGS84 latitude/longitude;
 * anchors only provide stable local metre projections for rendering,
 * construction geometry, terrain sampling and chunk streaming.
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
 * Buildings created here persist globally in WGS84 and can be reprojected into
 * this or any future Earth view without changing their identity.
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


/**
 * Creates a technical local projection/streaming anchor around any Earth view.
 * This is not a named gameplay region and must never become navigation state.
 */
export function createEarthViewAnchor(origin: EarthRegionAnchor['origin']): EarthRegionAnchor {
  const view = createPlanetaryViewAnchor('earth', { latDeg: origin.lat, lonDeg: origin.lon, elevationM: origin.elevationM ?? undefined }, { name: 'Earth · local view', chunkSizeM: EARTH_CHUNK_SIZE_M, cellSizeM: EARTH_CELL_SIZE_M })
  return {
    id: view.id,
    name: view.name,
    origin: { lat: view.origin.latDeg, lon: view.origin.lonDeg, elevationM: view.origin.elevationM },
    chunkSizeM: view.chunkSizeM,
    cellSizeM: view.cellSizeM,
  }
}
