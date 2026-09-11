import { getStationServiceProfile, isFreePortStation } from './stationProfiles'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const phobos = getStationServiceProfile('phobos')
assert(phobos.role === 'free-port', 'Phobos must be a free-port station')
assert(phobos.freePort === true, 'Phobos must advertise free-port semantics')
assert(phobos.docking === true, 'Phobos must support docking')
assert(phobos.cargoTransfer === true, 'Phobos must support explicit cargo transfer')
assert(phobos.depotMode === 'persistent-node', 'Phobos must use persistent depot semantics')
assert(phobos.marketMode === 'local-node', 'Phobos market must be tied to the physical node')
assert(phobos.onwardTransfer === true, 'Phobos must support onward transfer')
assert(isFreePortStation('phobos') === true, 'Phobos helper must resolve to free port')
assert(isFreePortStation('prometheus') === false, 'Kepler legacy slug must not become a free port')
assert(isFreePortStation('unknown-station') === false, 'Unknown stations must not silently become free ports')

console.log('stationProfiles.test.ts: ok')
