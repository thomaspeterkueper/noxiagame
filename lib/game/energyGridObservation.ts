// lib/game/energyGridObservation.ts
// Read-only observation of persisted energy infrastructure against canonical
// Tharsis engineering metadata. This module does not simulate power flow.

import {
  THARSIS_HUB_BUILDINGS,
  THARSIS_HUB_UTILITY_RINGS,
} from './seeds/tharsisHubSeed'

export interface LiveEnergyAsset {
  entityId: string
  tileRow: number | null
  tileCol: number | null
}

export interface UnresolvedEnergyObservation {
  status: 'unresolved'
  reason: string
}

export interface EnergyDomainObservation {
  id: string
  observedReactorModules: number
  canonicalReactorModules: number
  liveInstalledNominalPowerMw: number
  canonicalNominalPowerMw: number
  observedBlackStartNodes: number
  canonicalBlackStartNodes: number
  complete: boolean
}

export interface EnergyGridObservation {
  locationId: string
  slug: 'mars'
  sourceRef: string
  generation: {
    technology: 'reactor'
    observedReactorModules: number
    canonicalReactorModules: number
    liveInstalledNominalPowerMw: number
    canonicalNominalPowerMw: number
    availablePowerMw: UnresolvedEnergyObservation
  }
  storage: {
    observedBlackStartNodes: number
    canonicalBlackStartNodes: number
    powerMw: UnresolvedEnergyObservation
    energyMWh: UnresolvedEnergyObservation
    stateOfCharge: UnresolvedEnergyObservation
  }
  grid: {
    canonicalPowerRings: number
    ringIds: string[]
    runtimeContinuity: UnresolvedEnergyObservation
    transmissionCapacityMw: UnresolvedEnergyObservation
  }
  demand: {
    totalDemandMw: UnresolvedEnergyObservation
    criticalLoadMw: UnresolvedEnergyObservation
  }
  domains: EnergyDomainObservation[]
  unmatchedLiveEnergyAssets: number
  derivedDrivers: {
    firmEnergy: UnresolvedEnergyObservation
    gridCapacity: UnresolvedEnergyObservation
  }
}

function unresolved(reason: string): UnresolvedEnergyObservation {
  return { status: 'unresolved', reason }
}

function assetKey(entityId: string, row: number, col: number): string {
  return `${entityId}:${row}:${col}`
}

const CANONICAL_REACTORS = THARSIS_HUB_BUILDINGS.filter(
  asset => asset.entityId === 'reactor_module' && Boolean(asset.complexId) && typeof asset.nominalPowerMw === 'number',
)

const CANONICAL_BLACK_START = THARSIS_HUB_BUILDINGS.filter(
  asset => asset.entityId === 'black_start' && Boolean(asset.complexId),
)

const CANONICAL_ENERGY_ASSETS = [...CANONICAL_REACTORS, ...CANONICAL_BLACK_START]

const CANONICAL_ENERGY_KEYS = new Set(
  CANONICAL_ENERGY_ASSETS.map(asset => assetKey(asset.entityId, asset.row, asset.col)),
)

const POWER_RINGS = THARSIS_HUB_UTILITY_RINGS.filter(ring => ring.media.includes('power'))

/**
 * Observes the persisted Tharsis energy assets without turning nominal nameplate
 * values into availability, firm capacity, storage depth or grid throughput.
 *
 * A live asset only receives canonical technical metadata when entity id AND
 * canonical tile position match. Extra/off-seed assets therefore remain
 * unmatched until they have their own engineering provenance.
 */
export function buildTharsisEnergyGridObservation(input: {
  locationId: string
  liveAssets: readonly LiveEnergyAsset[]
}): EnergyGridObservation {
  const liveKeys = new Set<string>()
  for (const asset of input.liveAssets) {
    if (!Number.isInteger(asset.tileRow) || !Number.isInteger(asset.tileCol)) continue
    liveKeys.add(assetKey(asset.entityId, Number(asset.tileRow), Number(asset.tileCol)))
  }

  const domainIds = Array.from(new Set(
    CANONICAL_ENERGY_ASSETS
      .map(asset => asset.complexId)
      .filter((id): id is string => Boolean(id)),
  )).sort()

  const domains: EnergyDomainObservation[] = domainIds.map(id => {
    const reactors = CANONICAL_REACTORS.filter(asset => asset.complexId === id)
    const blackStart = CANONICAL_BLACK_START.filter(asset => asset.complexId === id)
    const observedReactors = reactors.filter(asset => liveKeys.has(assetKey(asset.entityId, asset.row, asset.col)))
    const observedBlackStart = blackStart.filter(asset => liveKeys.has(assetKey(asset.entityId, asset.row, asset.col)))

    const canonicalNominalPowerMw = reactors.reduce((sum, asset) => sum + Number(asset.nominalPowerMw ?? 0), 0)
    const liveInstalledNominalPowerMw = observedReactors.reduce((sum, asset) => sum + Number(asset.nominalPowerMw ?? 0), 0)

    return {
      id,
      observedReactorModules: observedReactors.length,
      canonicalReactorModules: reactors.length,
      liveInstalledNominalPowerMw,
      canonicalNominalPowerMw,
      observedBlackStartNodes: observedBlackStart.length,
      canonicalBlackStartNodes: blackStart.length,
      complete: observedReactors.length === reactors.length && observedBlackStart.length === blackStart.length,
    }
  })

  const observedReactorModules = domains.reduce((sum, domain) => sum + domain.observedReactorModules, 0)
  const canonicalReactorModules = domains.reduce((sum, domain) => sum + domain.canonicalReactorModules, 0)
  const liveInstalledNominalPowerMw = domains.reduce((sum, domain) => sum + domain.liveInstalledNominalPowerMw, 0)
  const canonicalNominalPowerMw = domains.reduce((sum, domain) => sum + domain.canonicalNominalPowerMw, 0)
  const observedBlackStartNodes = domains.reduce((sum, domain) => sum + domain.observedBlackStartNodes, 0)
  const canonicalBlackStartNodes = domains.reduce((sum, domain) => sum + domain.canonicalBlackStartNodes, 0)

  const unmatchedLiveEnergyAssets = Array.from(liveKeys)
    .filter(key => !CANONICAL_ENERGY_KEYS.has(key))
    .length

  return {
    locationId: input.locationId,
    slug: 'mars',
    sourceRef: 'core:tile_entities:mars+seed:tharsisHubSeed:energy-grid',
    generation: {
      technology: 'reactor',
      observedReactorModules,
      canonicalReactorModules,
      liveInstalledNominalPowerMw,
      canonicalNominalPowerMw,
      availablePowerMw: unresolved(
        'Nominal reactor nameplate power is known, but runtime availability, derating and outage state are not yet authoritative.',
      ),
    },
    storage: {
      observedBlackStartNodes,
      canonicalBlackStartNodes,
      powerMw: unresolved('Black-start/storage nodes exist, but charge/discharge power is not yet modelled in MW.'),
      energyMWh: unresolved('Black-start/storage nodes exist, but usable storage energy is not yet modelled in MWh.'),
      stateOfCharge: unresolved('No authoritative runtime state of charge is available yet.'),
    },
    grid: {
      canonicalPowerRings: POWER_RINGS.length,
      ringIds: POWER_RINGS.map(ring => ring.ring),
      runtimeContinuity: unresolved('The canonical power-ring topology exists, but live breaker/line continuity is not yet persisted.'),
      transmissionCapacityMw: unresolved('No authoritative MW transmission limit exists for the power rings yet.'),
    },
    demand: {
      totalDemandMw: unresolved('Current consumption is still expressed in abstract game energy units, not an authoritative MW load model.'),
      criticalLoadMw: unresolved('Critical loads are identified structurally, but their electrical demand is not yet expressed in MW.'),
    },
    domains,
    unmatchedLiveEnergyAssets,
    derivedDrivers: {
      firmEnergy: unresolved(
        'Installed nominal reactor power is not firm capacity. Demand, runtime availability, storage depth and reserve policy are still missing.',
      ),
      gridCapacity: unresolved(
        'Two canonical power rings are known, but transmission limits and live continuity are still missing.',
      ),
    },
  }
}
