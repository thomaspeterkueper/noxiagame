import type { GeoBounds } from './earthFeatureSource'
import { EARTH_SAUERLAND_REGION } from './regions'

/**
 * First streaming window around the Sauerland anchor.
 *
 * This is not a world boundary. It is intentionally small enough to bootstrap
 * real geographic layers quickly; adjacent windows/chunks are loaded as the
 * player moves or zooms out.
 */
export const SAUERLAND_BOOTSTRAP_BOUNDS: GeoBounds = {
  south: 51.235,
  west: 7.86,
  north: 51.415,
  east: 8.15,
}

export const SAUERLAND_TECH_REGION = {
  id: 'earth-sauerland-tech-region',
  regionId: EARTH_SAUERLAND_REGION.id,
  label: 'Technikstandort Deutschland · Sauerland',
  purpose: 'NOXIA Earth origin region for aerospace, research, logistics and player settlement',
  bounds: SAUERLAND_BOOTSTRAP_BOUNDS,
  /**
   * Future infrastructure must be placed as simulation entities on top of the
   * real landscape. Existing settlements, forests, water and transport are not
   * erased merely to make room for a convenient game board.
   */
  planningRules: {
    preserveRealLandscape: true,
    preserveSettlements: true,
    preserveWater: true,
    preferExistingTransportCorridors: true,
    requireFootprintForFutureInfrastructure: true,
  },
} as const
