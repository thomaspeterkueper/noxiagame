// lib/game/energyGridObservation.ts
// Read-only observation of persisted energy infrastructure against canonical
// Tharsis engineering metadata. This module does not simulate power flow.

import {
  THARSIS_HUB_BUILDINGS,
  THARSIS_HUB_UTILITY_LINKS,
  THARSIS_HUB_UTILITY_RINGS,
} from './seeds/tharsisHubSeed'

export interface LiveEnergyAsset {
  entityId: string
  tileRow: number | null
  tileCol: number | null
}

export interface LivePowerBackboneNode {
  ring: string
  nodeRow: number | null
  nodeCol: number | null
}

export interface LivePowerEdge {
  ring: string
  fromRow: number | null
  fromCol: number | null
  toRow: number | null
  toCol: number | null
}

export interface LivePowerFeeder {
  ring: string
  objectRow: number | null
  objectCol: number | null
  nodeRow: number | null
  nodeCol: number | null
}

export interface LivePowerTopology {
  backboneNodes: readonly LivePowerBackboneNode[]
  edges: readonly LivePowerEdge[]
  feeders: readonly LivePowerFeeder[]
  sourceRef: string
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

export interface PowerRingTopologyObservation {
  id: string
  observedBackboneNodes: number
  canonicalBackboneNodes: number
  observedStructuralEdges: number
  canonicalStructuralEdges: number
  connected: boolean
  complete: boolean
}

export interface PowerTopologyObservation {
  status: 'unavailable' | 'degraded' | 'observed'
  sourceRef: string | null
  observedPowerRings: number
  canonicalPowerRings: number
  rings: PowerRingTopologyObservation[]
  observedEnergyFeeders: number
  canonicalEnergyFeeders: number
  dualFedEnergyAssets: number
  canonicalDualFedEnergyAssets: number
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
    topology: PowerTopologyObservation
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

function coordinateKey(row: number, col: number): string {
  return `${row}:${col}`
}

function validCoordinatePair(row: number | null, col: number | null): row is number {
  return Number.isInteger(row) && Number.isInteger(col)
}

function undirectedEdgeKey(fromRow: number, fromCol: number, toRow: number, toCol: number): string {
  const a = coordinateKey(fromRow, fromCol)
  const b = coordinateKey(toRow, toCol)
  return a < b ? `${a}>${b}` : `${b}>${a}`
}

const CANONICAL_REACTORS = THARSIS_HUB_BUILDINGS.filter(
  asset => asset.entityId === 'reactor_module' && Boolean(asset.complexId) && typeof asset.nominalPowerMw === 'number',
)

const CANONICAL_BLACK_START = THARSIS_HUB_BUILDINGS.filter(
  asset => asset.entityId === 'black_start' && Boolean(asset.complexId),
)

const CANONICAL_ENERGY_ASSETS = [...CANONICAL_REACTORS, ...CANONICAL_BLACK_START]
const CANONICAL_ENERGY_IDS = new Set(CANONICAL_ENERGY_ASSETS.map(asset => asset.id))

const CANONICAL_ENERGY_KEYS = new Set(
  CANONICAL_ENERGY_ASSETS.map(asset => assetKey(asset.entityId, asset.row, asset.col)),
)

const POWER_RINGS = THARSIS_HUB_UTILITY_RINGS.filter(ring => ring.media.includes('power'))

const CANONICAL_ENERGY_FEEDERS = THARSIS_HUB_UTILITY_LINKS
  .filter(link => CANONICAL_ENERGY_IDS.has(link.objectId))
  .map(link => {
    const asset = CANONICAL_ENERGY_ASSETS.find(candidate => candidate.id === link.objectId)
    if (!asset) throw new Error(`canonical energy feeder references unknown asset ${link.objectId}`)
    return {
      objectId: link.objectId,
      objectRow: asset.row,
      objectCol: asset.col,
      ring: link.ring,
      nodeRow: link.node[0],
      nodeCol: link.node[1],
      key: `${link.ring}:${asset.row}:${asset.col}:${link.node[0]}:${link.node[1]}`,
    }
  })

function observePowerTopology(liveTopology?: LivePowerTopology): PowerTopologyObservation {
  const unavailable = liveTopology === undefined

  const liveNodesByRing = new Map<string, Set<string>>()
  if (liveTopology) {
    for (const node of liveTopology.backboneNodes) {
      if (!validCoordinatePair(node.nodeRow, node.nodeCol)) continue
      const set = liveNodesByRing.get(node.ring) ?? new Set<string>()
      set.add(coordinateKey(Number(node.nodeRow), Number(node.nodeCol)))
      liveNodesByRing.set(node.ring, set)
    }
  }

  const edgeKeysByRing = new Map<string, Set<string>>()
  const adjacencyByRing = new Map<string, Map<string, Set<string>>>()
  if (liveTopology) {
    for (const edge of liveTopology.edges) {
      if (!validCoordinatePair(edge.fromRow, edge.fromCol) || !validCoordinatePair(edge.toRow, edge.toCol)) continue
      const from = coordinateKey(Number(edge.fromRow), Number(edge.fromCol))
      const to = coordinateKey(Number(edge.toRow), Number(edge.toCol))
      const edges = edgeKeysByRing.get(edge.ring) ?? new Set<string>()
      edges.add(undirectedEdgeKey(Number(edge.fromRow), Number(edge.fromCol), Number(edge.toRow), Number(edge.toCol)))
      edgeKeysByRing.set(edge.ring, edges)

      const adjacency = adjacencyByRing.get(edge.ring) ?? new Map<string, Set<string>>()
      const fromNeighbors = adjacency.get(from) ?? new Set<string>()
      const toNeighbors = adjacency.get(to) ?? new Set<string>()
      fromNeighbors.add(to)
      toNeighbors.add(from)
      adjacency.set(from, fromNeighbors)
      adjacency.set(to, toNeighbors)
      adjacencyByRing.set(edge.ring, adjacency)
    }
  }

  const rings: PowerRingTopologyObservation[] = POWER_RINGS.map(ring => {
    const canonicalNodes = new Set(ring.nodes.map(([row, col]) => coordinateKey(row, col)))
    const liveNodes = liveNodesByRing.get(ring.ring) ?? new Set<string>()
    const observedCanonicalNodes = [...canonicalNodes].filter(node => liveNodes.has(node)).length
    const edgeKeys = edgeKeysByRing.get(ring.ring) ?? new Set<string>()
    const canonicalStructuralEdges = Math.max(canonicalNodes.size - 1, 0)

    let connected = canonicalNodes.size === 0
    if (canonicalNodes.size > 0 && observedCanonicalNodes === canonicalNodes.size) {
      const start = canonicalNodes.values().next().value as string
      const visited = new Set<string>([start])
      const queue = [start]
      const adjacency = adjacencyByRing.get(ring.ring) ?? new Map<string, Set<string>>()
      while (queue.length > 0) {
        const current = queue.shift() as string
        for (const neighbor of adjacency.get(current) ?? []) {
          if (!canonicalNodes.has(neighbor) || visited.has(neighbor)) continue
          visited.add(neighbor)
          queue.push(neighbor)
        }
      }
      connected = visited.size === canonicalNodes.size
    }

    return {
      id: ring.ring,
      observedBackboneNodes: observedCanonicalNodes,
      canonicalBackboneNodes: canonicalNodes.size,
      observedStructuralEdges: edgeKeys.size,
      canonicalStructuralEdges,
      connected,
      complete: observedCanonicalNodes === canonicalNodes.size
        && edgeKeys.size >= canonicalStructuralEdges
        && connected,
    }
  })

  const liveFeederKeys = new Set<string>()
  if (liveTopology) {
    for (const feeder of liveTopology.feeders) {
      if (!validCoordinatePair(feeder.objectRow, feeder.objectCol) || !validCoordinatePair(feeder.nodeRow, feeder.nodeCol)) continue
      liveFeederKeys.add(
        `${feeder.ring}:${Number(feeder.objectRow)}:${Number(feeder.objectCol)}:${Number(feeder.nodeRow)}:${Number(feeder.nodeCol)}`,
      )
    }
  }

  const observedEnergyFeeders = CANONICAL_ENERGY_FEEDERS.filter(feeder => liveFeederKeys.has(feeder.key)).length
  const canonicalAssetIds = [...CANONICAL_ENERGY_IDS]
  const dualFedEnergyAssets = canonicalAssetIds.filter(objectId => {
    const expected = CANONICAL_ENERGY_FEEDERS.filter(feeder => feeder.objectId === objectId)
    return expected.length === 2 && expected.every(feeder => liveFeederKeys.has(feeder.key))
  }).length

  const observedPowerRings = rings.filter(ring => ring.observedBackboneNodes > 0).length
  const complete = !unavailable
    && rings.every(ring => ring.complete)
    && observedEnergyFeeders === CANONICAL_ENERGY_FEEDERS.length
    && dualFedEnergyAssets === canonicalAssetIds.length

  return {
    status: unavailable ? 'unavailable' : complete ? 'observed' : 'degraded',
    sourceRef: liveTopology?.sourceRef ?? null,
    observedPowerRings,
    canonicalPowerRings: POWER_RINGS.length,
    rings,
    observedEnergyFeeders,
    canonicalEnergyFeeders: CANONICAL_ENERGY_FEEDERS.length,
    dualFedEnergyAssets,
    canonicalDualFedEnergyAssets: canonicalAssetIds.length,
    complete,
  }
}

/**
 * Observes persisted Tharsis energy assets and structural power topology without
 * turning nominal nameplate values or physical reachability into availability,
 * firm capacity, storage depth, operational continuity or grid throughput.
 */
export function buildTharsisEnergyGridObservation(input: {
  locationId: string
  liveAssets: readonly LiveEnergyAsset[]
  liveTopology?: LivePowerTopology
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
  const topology = observePowerTopology(input.liveTopology)

  const unmatchedLiveEnergyAssets = Array.from(liveKeys)
    .filter(key => !CANONICAL_ENERGY_KEYS.has(key))
    .length

  const continuityReason = topology.complete
    ? 'Structural A/B power topology and dual energy-asset feeders are persisted, but breaker/line operational state is not yet authoritative.'
    : topology.status === 'unavailable'
      ? 'No persisted structural power topology was available to this observation; breaker/line operational state is also not authoritative.'
      : 'Persisted structural power topology is incomplete relative to the canonical A/B backbone; operational breaker/line state is also not authoritative.'

  const gridCapacityReason = topology.complete
    ? 'The structural dual-backbone power topology is persisted, but transmission MW limits and live breaker/line continuity are still missing.'
    : 'Grid capacity remains unresolved until the canonical structural A/B topology is complete and transmission MW limits plus live continuity exist.'

  return {
    locationId: input.locationId,
    slug: 'mars',
    sourceRef: input.liveTopology
      ? 'core:tile_entities:mars+location_utilities+location_utility_edges+location_utility_feeders+seed:tharsisHubSeed:energy-grid'
      : 'core:tile_entities:mars+seed:tharsisHubSeed:energy-grid',
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
      topology,
      runtimeContinuity: unresolved(continuityReason),
      transmissionCapacityMw: unresolved('No authoritative MW transmission limit exists for the power backbones yet.'),
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
      gridCapacity: unresolved(gridCapacityReason),
    },
  }
}
