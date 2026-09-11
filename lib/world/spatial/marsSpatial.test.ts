import { strict as assert } from 'node:assert'
import {
  MARS_REFERENCE,
  createMarsRegionAnchor,
  localMetersToMarsGeo,
  marsChunkKey,
  marsGeoToChunkCell,
  marsGeoToLocalMeters,
  normalizeMarsLongitude,
} from './marsSpatial'

assert.equal(MARS_REFERENCE.body, 'mars')
assert.equal(MARS_REFERENCE.equatorialRadiusM, 3396190)
assert.equal(normalizeMarsLongitude(226.2), -133.8)

const origin = { lat: 10, lon: 20, elevationM: 0 }
const point = { lat: 10.001, lon: 20.001, elevationM: 35 }
const local = marsGeoToLocalMeters(point, origin)
const roundTrip = localMetersToMarsGeo(local, origin)
assert.ok(Math.abs(roundTrip.lat - point.lat) < 1e-6)
assert.ok(Math.abs(roundTrip.lon - point.lon) < 1e-6)
assert.ok(Math.abs((roundTrip.elevationM ?? 0) - point.elevationM) < .02)

const region = createMarsRegionAnchor('test-region', 'Synthetic Mars test region', origin)
const cell = marsGeoToChunkCell(origin, region)
assert.deepEqual(cell.chunk, { x: 0, y: 0 })
assert.equal(cell.localX, 0)
assert.equal(cell.localY, 0)
assert.equal(marsChunkKey('test-region', { x: -2, y: 4 }), 'mars:test-region:-2:4')

console.log('Mars spatial tests passed')
