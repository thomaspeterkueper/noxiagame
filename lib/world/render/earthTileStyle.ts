import type { EarthFeatureClass } from '../spatial/earthFeatureSource'

/**
 * Semantic bridge between real-world geography and NOXIA's existing raster/
 * tile art. The imported geometry remains canonical; these roles only decide
 * how a renderer paints it at game scale.
 */
export type EarthRenderRole =
  | 'terrain-grass'
  | 'terrain-forest'
  | 'terrain-water'
  | 'terrain-farmland'
  | 'terrain-urban'
  | 'transport-road'
  | 'transport-rail'
  | 'structure-building'
  | 'structure-industrial'
  | 'structure-public'

export const EARTH_FEATURE_RENDER_ROLE: Record<EarthFeatureClass, EarthRenderRole> = {
  road: 'transport-road',
  rail: 'transport-rail',
  waterway: 'terrain-water',
  water: 'terrain-water',
  forest: 'terrain-forest',
  farmland: 'terrain-farmland',
  building: 'structure-building',
  settlement: 'terrain-urban',
  industrial: 'structure-industrial',
  public: 'structure-public',
}

/**
 * Existing graphics are reusable where their semantics fit. They must never
 * become the source of geography: geometry comes from Earth data, art follows.
 */
export const EARTH_EXISTING_TILE_HINTS: Partial<Record<EarthRenderRole, string[]>> = {
  'terrain-grass': ['tile_grass'],
  'terrain-forest': ['tile_forest_edge', 'tile_forest_dense'],
  'terrain-water': ['river'],
  'terrain-farmland': ['tile_farmland'],
  'terrain-urban': ['tile_city'],
}
