// lib/game/world/types.ts
// Erstellt:     10.07.2026
// Version:      0.1.0
//
// Neutrales Domänenmodell für WORLD-0002.
// Phase 1 bleibt bewusst klein, das Modell reserviert aber Erweiterungspunkte
// für Scans, detaillierte Lagerstätten, Infrastruktur und Stoffkreisläufe.

export type LocationType =
  | 'planet'
  | 'moon'
  | 'asteroid'
  | 'station'
  | 'ship'
  | 'habitat'

export type TerrainType =
  | 'plain'
  | 'rock'
  | 'ice'
  | 'sand'
  | 'crater'
  | 'regolith'
  | 'unknown'

export type BuildSuitability = 'good' | 'normal' | 'poor'

export type SuitabilityState = 'optimal' | 'possible' | 'blocked'

export type DiscoveryState =
  | 'unknown'
  | 'surveyed'
  | 'scanned'
  | 'confirmed'

export type ResourceClass = 'ubiquitous' | 'localized' | 'unique'

export type MaterialKey =
  | 'water_ice'
  | 'metal_ore'
  | 'silicates'
  | 'regolith'
  | string

export interface DepositSummary {
  id: string
  materialKey: MaterialKey
  resourceClass: ResourceClass
  richness: number
  remainingAmount: number | null
  discoveryState: DiscoveryState
}

export interface TileEnvironment {
  solarPotential: number
  temperatureC?: number | null
  radiationLevel?: number | null
  slope?: number | null
}

export interface TileNaturalState {
  terrain: TerrainType
  geologyKey?: string | null
  buildSuitability: BuildSuitability
  environment: TileEnvironment
  deposits: DepositSummary[]
  discoveryState: DiscoveryState
}

export interface TileInfrastructureRef {
  id: string
  kind: string
}

export interface TileBuildingRef {
  id: string
  buildingId: string
  ownerProfileId?: string | null
}

export interface TileArtificialState {
  infrastructure: TileInfrastructureRef[]
  buildings: TileBuildingRef[]
  modifiers: Record<string, number>
}

export interface WorldTile {
  locationSlug: string
  regionKey?: string | null
  row: number
  col: number
  natural: TileNaturalState
  artificial: TileArtificialState
}

export interface BuildingSuitabilityResult {
  state: SuitabilityState
  efficiency: number
  reasons: string[]
  requiredDeposit?: MaterialKey | null
  matchedDepositId?: string | null
}

export interface TileAnalysis {
  tile: WorldTile
  summary: {
    terrainLabel: string
    suitabilityLabel: string
    depositLabels: string[]
  }
}

export const NEUTRAL_TILE_NATURAL_STATE: TileNaturalState = {
  terrain: 'unknown',
  buildSuitability: 'normal',
  environment: {
    solarPotential: 1,
  },
  deposits: [],
  discoveryState: 'confirmed',
}

export function createNeutralWorldTile(input: {
  locationSlug: string
  row: number
  col: number
  terrain?: TerrainType
}): WorldTile {
  return {
    locationSlug: input.locationSlug,
    regionKey: null,
    row: input.row,
    col: input.col,
    natural: {
      ...NEUTRAL_TILE_NATURAL_STATE,
      terrain: input.terrain ?? NEUTRAL_TILE_NATURAL_STATE.terrain,
      environment: { ...NEUTRAL_TILE_NATURAL_STATE.environment },
      deposits: [],
    },
    artificial: {
      infrastructure: [],
      buildings: [],
      modifiers: {},
    },
  }
}
