import assert from 'node:assert/strict'
import {
  createInitialDockingPorts,
  getStationDockingTopology,
  stationHasCargoCapablePort,
  stationHasHeavyFreighterPort,
} from './stationDockingTopologies'

const phobos = getStationDockingTopology('phobos')
assert.ok(phobos)
assert.equal(phobos?.ports.length, 6)
assert.equal(stationHasCargoCapablePort('phobos'), true)
assert.equal(stationHasHeavyFreighterPort('phobos'), true)
assert.equal(phobos?.ports.filter(p => p.portClass === 'standard').length, 2)
assert.equal(phobos?.ports.filter(p => p.portClass === 'heavy').length, 1)
assert.equal(phobos?.ports.filter(p => p.portClass === 'service').every(p => p.cargoEnabled === false), true)

const kepler = getStationDockingTopology('prometheus')
assert.ok(kepler)
assert.equal(kepler?.ports.length, 3)
assert.equal(stationHasHeavyFreighterPort('prometheus'), false)
assert.equal(stationHasCargoCapablePort('prometheus'), true)

const initial = createInitialDockingPorts('phobos')
assert.equal(initial.length, 6)
assert.equal(initial.every(p => p.status === 'available'), true)
assert.equal(initial.every(p => p.occupiedByVesselId == null), true)
assert.equal(initial.every(p => p.reservedForVesselId == null), true)

assert.equal(getStationDockingTopology('unknown-station'), null)
assert.equal(createInitialDockingPorts('unknown-station').length, 0)

console.log('stationDockingTopologies tests passed')
