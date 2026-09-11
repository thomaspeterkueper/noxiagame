import {
  MARS_REFERENCE,
  THARSIS_REGION,
  localMetersToMarsGeo,
  marsChunkKey,
  marsGeoToChunkCell,
  marsGeoToLocalMeters,
  normalizeMarsLongitude,
} from './marsSpatial'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function near(actual: number, expected: number, tolerance: number, label: string) {
  assert(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`)
}

assert(MARS_REFERENCE.body === 'mars', 'Mars adapter must use the canonical Mars reference')
near(MARS_REFERENCE.equatorialRadiusM, 3396190, 0.001, 'Mars equatorial radius')
near(normalizeMarsLongitude(226.2), -133.8, 0.000001, 'positive-east longitude normalization')

const anchor = { lat: 10, lon: 20, elevationM: 0 }
const point = { lat: 10.001, lon: 20.001, elevationM: 35 }
const local = marsGeoToLocalMeters(point, anchor)
const roundTrip = localMetersToMarsGeo(local, anchor)
near(roundTrip.lat, point.lat, 0.000001, 'Mars latitude round trip')
near(roundTrip.lon, point.lon, 0.000001, 'Mars longitude round trip')
near(roundTrip.elevationM ?? 0, point.elevationM ?? 0, 0.02, 'Mars elevation round trip')

const cell = marsGeoToChunkCell(THARSIS_REGION.origin, THARSIS_REGION)
assert(cell.chunk.x === 0 && cell.chunk.y === 0, 'Tharsis origin must fall in chunk 0,0')
assert(cell.localX === 0 && cell.localY === 0, 'Tharsis origin must fall in cell 0,0')
assert(marsChunkKey('tharsis', { x: -2, y: 4 }) === 'mars:tharsis:-2:4', 'Mars chunk keys must be world-qualified')

console.log('Mars spatial tests passed')
