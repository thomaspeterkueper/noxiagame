// lib/game/world/analyzer.ts
// Erstellt:     10.07.2026
// Version:      0.1.0
//
// Deterministischer Phase-1-Analyzer für WORLD-0002.
// Gleiche Eingaben ergeben immer dieselbe Kachelbewertung.
// Noch keine Persistenz: spätere Scans/Lagerstätten können dieses Ergebnis ersetzen.

import type {
  BuildingSuitabilityResult,
  BuildSuitability,
  DepositSummary,
  MaterialKey,
  TerrainType,
  TileAnalysis,
  WorldTile,
} from './types'

const TERRAIN_LABELS: Record<TerrainType, string> = {
  plain: 'Ebene',
  rock: 'Fels',
  ice: 'Eisfläche',
  sand: 'Sand',
  crater: 'Krater',
  regolith: 'Regolith',
  unknown: 'Unbekannt',
}

const SUITABILITY_LABELS: Record<BuildSuitability, string> = {
  good: 'gut',
  normal: 'normal',
  poor: 'schlecht',
}

const MATERIAL_LABELS: Record<string, string> = {
  water_ice: 'Wassereis',
  metal_ore: 'Metallerz',
  silicates: 'Silikate',
  regolith: 'Regolith',
}

function hash01(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967295
}

function inferTerrain(tileType: string, locationSlug: string): TerrainType {
  const t = tileType.toLowerCase()
  if (t.includes('crater')) return 'crater'
  if (t.includes('ice') || t.includes('snow')) return 'ice'
  if (t.includes('sand') || t.includes('dune') || t.includes('desert')) return 'sand'
  if (t.includes('rock') || t.includes('mountain') || t.includes('ridge')) return 'rock'
  if (t.includes('surface') || t.includes('plain') || t.includes('grass')) {
    return locationSlug === 'moon' ? 'regolith' : 'plain'
  }
  if (locationSlug === 'moon') return 'regolith'
  if (locationSlug === 'mars') return 'sand'
  return 'plain'
}

function buildSuitabilityFor(terrain: TerrainType): BuildSuitability {
  if (terrain === 'plain' || terrain === 'regolith') return 'good'
  if (terrain === 'rock' || terrain === 'sand') return 'normal'
  return 'poor'
}

function solarBase(locationSlug: string): number {
  if (locationSlug === 'moon') return 1.18
  if (locationSlug === 'mars') return 0.82
  if (locationSlug === 'prometheus') return 1.05
  return 1
}

function deposit(
  locationSlug: string,
  row: number,
  col: number,
  materialKey: MaterialKey,
  probability: number,
  richnessBias = 0,
): DepositSummary | null {
  const presence = hash01(`${locationSlug}:${row}:${col}:${materialKey}:presence`)
  if (presence > probability) return null
  const richness = Math.min(1, 0.2 + richnessBias + hash01(`${locationSlug}:${row}:${col}:${materialKey}:richness`) * 0.65)
  return {
    id: `${locationSlug}-${row}-${col}-${materialKey}`,
    materialKey,
    resourceClass: materialKey === 'regolith' || materialKey === 'silicates' ? 'ubiquitous' : 'localized',
    richness: Number(richness.toFixed(2)),
    remainingAmount: null,
    discoveryState: 'surveyed',
  }
}

function depositsFor(locationSlug: string, terrain: TerrainType, row: number, col: number): DepositSummary[] {
  const result: DepositSummary[] = []

  const add = (value: DepositSummary | null) => { if (value) result.push(value) }

  if (locationSlug === 'moon') {
    add(deposit(locationSlug, row, col, 'regolith', 0.95, 0.1))
    add(deposit(locationSlug, row, col, 'metal_ore', terrain === 'crater' || terrain === 'rock' ? 0.72 : 0.42, 0.05))
    add(deposit(locationSlug, row, col, 'water_ice', terrain === 'ice' || terrain === 'crater' ? 0.58 : 0.16))
    add(deposit(locationSlug, row, col, 'silicates', 0.75))
  } else if (locationSlug === 'mars') {
    add(deposit(locationSlug, row, col, 'metal_ore', terrain === 'rock' || terrain === 'crater' ? 0.78 : 0.5, 0.08))
    add(deposit(locationSlug, row, col, 'water_ice', terrain === 'ice' ? 0.9 : 0.38))
    add(deposit(locationSlug, row, col, 'silicates', 0.82))
  } else if (locationSlug === 'earth') {
    add(deposit(locationSlug, row, col, 'metal_ore', terrain === 'rock' ? 0.7 : 0.32))
    add(deposit(locationSlug, row, col, 'silicates', terrain === 'sand' ? 0.88 : 0.45))
  } else {
    add(deposit(locationSlug, row, col, 'metal_ore', 0.4))
    add(deposit(locationSlug, row, col, 'silicates', 0.55))
  }

  return result
}

export function analyzeTile(input: {
  locationSlug: string
  tileType: string
  row: number
  col: number
}): TileAnalysis {
  const terrain = inferTerrain(input.tileType, input.locationSlug)
  const buildSuitability = buildSuitabilityFor(terrain)
  const variation = 0.82 + hash01(`${input.locationSlug}:${input.row}:${input.col}:solar`) * 0.36
  const terrainSolarFactor = terrain === 'crater' ? 0.72 : terrain === 'rock' ? 0.9 : 1
  const solarPotential = Number((solarBase(input.locationSlug) * variation * terrainSolarFactor).toFixed(2))
  const deposits = depositsFor(input.locationSlug, terrain, input.row, input.col)

  const tile: WorldTile = {
    locationSlug: input.locationSlug,
    regionKey: null,
    row: input.row,
    col: input.col,
    natural: {
      terrain,
      geologyKey: input.locationSlug === 'moon' ? 'lunar-regolith' : input.locationSlug === 'mars' ? 'martian-basaltic' : 'surface-generic',
      buildSuitability,
      environment: { solarPotential },
      deposits,
      discoveryState: 'surveyed',
    },
    artificial: { infrastructure: [], buildings: [], modifiers: {} },
  }

  return {
    tile,
    summary: {
      terrainLabel: TERRAIN_LABELS[terrain],
      suitabilityLabel: SUITABILITY_LABELS[buildSuitability],
      depositLabels: deposits.map(d => `${MATERIAL_LABELS[d.materialKey] ?? d.materialKey} (${richnessLabel(d.richness)})`),
    },
  }
}

function richnessLabel(richness: number): string {
  if (richness >= 0.7) return 'hoch'
  if (richness >= 0.4) return 'mittel'
  return 'gering'
}

function findDeposit(tile: WorldTile, materialKey: MaterialKey) {
  return tile.natural.deposits.find(d => d.materialKey === materialKey)
}

export function evaluateBuildingSuitability(buildingId: string, tile: WorldTile): BuildingSuitabilityResult {
  const base = tile.natural.buildSuitability === 'good' ? 1 : tile.natural.buildSuitability === 'normal' ? 0.85 : 0.58

  if (buildingId === 'solar') {
    const efficiency = Number((base * tile.natural.environment.solarPotential).toFixed(2))
    return {
      state: efficiency >= 1.05 ? 'optimal' : efficiency >= 0.65 ? 'possible' : 'blocked',
      efficiency,
      reasons: [`Sonnenpotenzial ${Math.round(tile.natural.environment.solarPotential * 100)} %`, `Untergrund: ${SUITABILITY_LABELS[tile.natural.buildSuitability]}`],
    }
  }

  if (buildingId === 'mine') {
    const ore = findDeposit(tile, 'metal_ore')
    if (!ore) return { state: 'possible', efficiency: 0.35, reasons: ['Keine bekannte Erzlagerstätte; Probebetrieb wäre ineffizient'], requiredDeposit: 'metal_ore' }
    const efficiency = Number((base * (0.45 + ore.richness)).toFixed(2))
    return { state: efficiency >= 0.95 ? 'optimal' : 'possible', efficiency, reasons: [`Metallerz: ${richnessLabel(ore.richness)}`], requiredDeposit: 'metal_ore', matchedDepositId: ore.id }
  }

  if (buildingId === 'ice_drill') {
    const ice = findDeposit(tile, 'water_ice')
    if (!ice) return { state: 'blocked', efficiency: 0, reasons: ['Keine bekannte Wassereis-Lagerstätte'], requiredDeposit: 'water_ice' }
    const efficiency = Number((base * (0.5 + ice.richness)).toFixed(2))
    return { state: efficiency >= 1 ? 'optimal' : 'possible', efficiency, reasons: [`Wassereis: ${richnessLabel(ice.richness)}`], requiredDeposit: 'water_ice', matchedDepositId: ice.id }
  }

  const efficiency = Number(base.toFixed(2))
  return {
    state: efficiency >= 0.95 ? 'optimal' : efficiency >= 0.55 ? 'possible' : 'blocked',
    efficiency,
    reasons: [`Baugrund: ${SUITABILITY_LABELS[tile.natural.buildSuitability]}`],
  }
}
