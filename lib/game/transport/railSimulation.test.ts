import { strict as assert } from 'node:assert'
import { deriveTrainPoint, deriveTrainRunState, type RailNetwork, type RailService, type TrainRun } from './railSimulation'

const network: RailNetwork = {
  stations: [
    { id: 'a', name: 'A', point: { xM: 0, yM: 0 } },
    { id: 'b', name: 'B', point: { xM: 1000, yM: 0 } },
  ],
  segments: [{ id: 'a-b', fromStationId: 'a', toStationId: 'b', distanceM: 1000, travelTimeMs: 100_000 }],
}
const service: RailService = {
  id: 'regional-1',
  name: 'Regional 1',
  stops: [
    { stationId: 'a', arrivalOffsetMs: 0, departureOffsetMs: 10_000 },
    { stationId: 'b', arrivalOffsetMs: 110_000, departureOffsetMs: 120_000 },
  ],
}
const run: TrainRun = { id: 'run-1', serviceId: service.id, departureAtMs: 1_000_000 }

assert.equal(deriveTrainRunState(service, run, 999_999).phase, 'scheduled')
assert.equal(deriveTrainRunState(service, run, 1_005_000).phase, 'dwelling')

const running = deriveTrainRunState(service, run, 1_060_000)
assert.equal(running.phase, 'running')
if (running.phase === 'running') {
  assert.equal(running.progress, 0.5)
  assert.deepEqual(deriveTrainPoint(network, running), { xM: 500, yM: 0 })
}

assert.equal(deriveTrainRunState(service, run, 1_115_000).phase, 'dwelling')
assert.equal(deriveTrainRunState(service, run, 1_121_000).phase, 'arrived')

console.log('railSimulation tests passed')
