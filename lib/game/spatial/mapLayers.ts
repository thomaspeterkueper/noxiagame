import type { Footprint } from './types'

export type MapLayerId =
  | 'terrain-height'
  | 'terrain-hillshade'
  | 'terrain-contours'
  | 'buildability'
  | 'water'
  | 'slope'
  | 'resources'
  | 'infrastructure'

export type BuildabilityState = 'buildable' | 'restricted' | 'invalid' | 'unresolved'

export interface TerrainInspection {
  xM: number
  yM: number
  latDeg?: number
  lonDeg?: number
  elevationM?: number
  slopeDeg?: number
  aspectDeg?: number
  substrateClass?: string
  buildability: BuildabilityState
  buildabilityReason?: string
  gridSizeM?: number
}

export interface BuildPlacementState {
  active: boolean
  buildTypeId?: string
  footprint?: Footprint
  state: BuildabilityState
  reason?: string
  canPlace: boolean
  canCancel: boolean
}

export const MAP_LAYER_IDS: readonly MapLayerId[] = [
  'terrain-height',
  'terrain-hillshade',
  'terrain-contours',
  'buildability',
  'water',
  'slope',
  'resources',
  'infrastructure',
]

export function buildabilityGridVisible(metersPerPixel: number, gridSizeM: number) {
  if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) throw new Error('metersPerPixel must be positive')
  if (!Number.isFinite(gridSizeM) || gridSizeM <= 0) throw new Error('gridSizeM must be positive')
  // Show cells once one grid cell has enough screen area to be read and selected.
  return gridSizeM / metersPerPixel >= 12
}

export function placementCanCommit(state: BuildPlacementState) {
  return state.active && state.state === 'buildable' && state.canPlace && Boolean(state.buildTypeId && state.footprint)
}
