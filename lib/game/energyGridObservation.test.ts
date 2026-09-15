import { buildTharsisEnergyGridObservation } from './energyGridObservation'
import {
  THARSIS_HUB_BUILDINGS,
  THARSIS_HUB_UTILITY_LINKS,
  THARSIS_HUB_UTILITY_RINGS,
} from './seeds/tharsisHubSeed'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const canonicalEnergyAssets = THARSIS_HUB_BUILDINGS.filter(
  asset => asset.entityId === 'reactor_module' || asset.entityId === 'black_start',
)
const canonicalEnergyIds = new Set(canonicalEnergyAssets.map(asset => asset.id))

const liveAssets = canonicalEnergyAssets.map(asset => ({
  entityId: asset.entityId,
  tileRow: asset.row,
  tileCol: asset.col,
}))

const backboneNodes = THARSIS_HUB_UTILITY_RINGS
  .filter(ring => ring.media.includes('power'))
  .flatMap(ring => ring.nodes.map(([nodeRow, nodeCol]) => ({
    ring: ring.ring,
    nodeRow,
    nodeCol,
  })))

// A deterministic connected tree is enough to prove structural reachability.
// The runtime adapter deliberately does not interpret it as breaker continuity
// or transmission capacity.
const edges = THARSIS_HUB_UTILITY_RINGS
  .filter(ring => ring.media.includes('power'))
  .flatMap(ring => ring.nodes.slice(1).map(([toRow, toCol], index) => {
    const [fromRow, fromCol] = ring.nodes[index]
    return { ring: ring.ring, fromRow, fromCol, toRow, toCol }
  }))

const feeders = THARSIS_HUB_UTILITY_LINKS
  .filter(link => canonicalEnergyIds.has(link.objectId))
  .map(link => {
    const asset = canonicalEnergyAssets.find(candidate => candidate.id === link.objectId)
    if (!asset) throw new Error(`missing canonical asset ${link.objectId}`)
    return {
      ring: link.ring,
      objectRow: asset.row,
      objectCol: asset.col,
      nodeRow: link.node[0],
      nodeCol: link.node[1],
    }
  })

const complete = buildTharsisEnergyGridObservation({
  locationId: 'mars-test',
  liveAssets,
  liveTopology: {
    backboneNodes,
    edges,
    feeders,
    sourceRef: 'test:tharsis-e1',
  },
})

assert(complete.grid.topology.status === 'observed', 'complete persisted E1 topology must be observed')
assert(complete.grid.topology.complete === true, 'complete canonical power topology must be marked complete')
assert(complete.grid.topology.observedPowerRings === 2, 'both A/B power backbones must be observed')
assert(complete.grid.topology.rings.find(ring => ring.id === 'A')?.canonicalBackboneNodes === 59, 'ring A must preserve 59 canonical power nodes')
assert(complete.grid.topology.rings.find(ring => ring.id === 'B')?.canonicalBackboneNodes === 41, 'ring B must preserve 41 canonical power nodes')
assert(complete.grid.topology.observedEnergyFeeders === 18, 'nine energy assets must expose 18 canonical A/B feeders')
assert(complete.grid.topology.dualFedEnergyAssets === 9, 'all nine energy assets must be structurally dual-fed')
assert(complete.grid.runtimeContinuity.status === 'unresolved', 'structural reachability must not become live breaker continuity')
assert(complete.grid.transmissionCapacityMw.status === 'unresolved', 'structural topology must not invent MW transmission capacity')
assert(complete.derivedDrivers.gridCapacity.status === 'unresolved', 'E1 topology alone must not emit grid_capacity')
assert(complete.derivedDrivers.firmEnergy.status === 'unresolved', 'E1 topology alone must not emit firm_energy')

const missingFeeder = buildTharsisEnergyGridObservation({
  locationId: 'mars-test',
  liveAssets,
  liveTopology: {
    backboneNodes,
    edges,
    feeders: feeders.slice(1),
    sourceRef: 'test:tharsis-e1-degraded',
  },
})
assert(missingFeeder.grid.topology.status === 'degraded', 'missing canonical feeder must degrade structural topology')
assert(missingFeeder.grid.topology.complete === false, 'missing canonical feeder must prevent topology completeness')
assert(missingFeeder.grid.topology.dualFedEnergyAssets === 8, 'one missing feeder must break dual-feed proof for exactly one energy asset')

const missingEdge = buildTharsisEnergyGridObservation({
  locationId: 'mars-test',
  liveAssets,
  liveTopology: {
    backboneNodes,
    edges: edges.slice(1),
    feeders,
    sourceRef: 'test:tharsis-e1-disconnected',
  },
})
assert(missingEdge.grid.topology.status === 'degraded', 'disconnected canonical backbone must degrade structural topology')
assert(missingEdge.grid.topology.rings.some(ring => !ring.connected), 'missing structural edge must remain visible as disconnected topology')

const noTopology = buildTharsisEnergyGridObservation({
  locationId: 'mars-test',
  liveAssets,
})
assert(noTopology.grid.topology.status === 'unavailable', 'missing persisted topology source must remain unavailable rather than inferred from seed')
assert(noTopology.derivedDrivers.gridCapacity.status === 'unresolved', 'seed-only topology must never emit grid_capacity')

console.log('Tharsis E1 energy-grid topology observation tests passed')
