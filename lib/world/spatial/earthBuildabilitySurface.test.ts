import { strict as assert } from 'node:assert'
import { buildEarthBuildabilitySurface, deriveElevationSlopeDeg, earthPlanningCellCenter } from './earthBuildabilitySurface'
import type { ElevationGrid } from './elevationSource'
import { EARTH_SAUERLAND_REGION } from './regions'

const origin = EARTH_SAUERLAND_REGION.origin
const dLat = 100 / 111_320
const dLon = 100 / (111_320 * Math.cos(origin.lat * Math.PI / 180))
const elevations = [
  300, 300, 300,
  300, 310, 300,
  300, 300, 300,
]

const grid: ElevationGrid = {
  bounds: {
    south: origin.lat - dLat,
    west: origin.lon - dLon,
    north: origin.lat + dLat,
    east: origin.lon + dLon,
  },
  rows: 3,
  cols: 3,
  samples: [],
  source: {
    provider: 'test-dem',
    dataset: 'deterministic-grid',
    resolutionM: 100,
  },
}

for (let row = 0; row < 3; row++) {
  for (let col = 0; col < 3; col++) {
    grid.samples.push({
      lat: origin.lat + (1 - row) * dLat,
      lon: origin.lon + (col - 1) * dLon,
      elevationM: elevations[row * 3 + col],
    })
  }
}

const centerSlope = deriveElevationSlopeDeg(grid, 1, 1)
assert.ok(centerSlope != null)
assert.ok(Math.abs(centerSlope - Math.atan2(10, 100) * 180 / Math.PI) < 0.05)

const surface = buildEarthBuildabilitySurface(grid, EARTH_SAUERLAND_REGION, {
  maxBuildableSlopeDeg: 3,
  maxRestrictedSlopeDeg: 8,
})
assert.equal(surface.cells.length, 9)
assert.equal(surface.source.dataset, 'deterministic-grid')

const center = surface.cells.find(cell => cell.row === 1 && cell.col === 1)
assert.ok(center)
assert.ok(Math.abs(center.xM) < 0.01)
assert.ok(Math.abs(center.yM) < 0.01)
assert.equal(center.elevationM, 310)
assert.equal(center.state, 'restricted')
assert.equal(center.buildabilityReason, 'slope-requires-mitigation')
assert.equal(center.gridSizeM, EARTH_SAUERLAND_REGION.cellSizeM)

const roundTrip = earthPlanningCellCenter(EARTH_SAUERLAND_REGION, center.xM, center.yM)
assert.ok(Math.abs(roundTrip.lat - origin.lat) < 1e-9)
assert.ok(Math.abs(roundTrip.lon - origin.lon) < 1e-9)

console.log('earth buildability surface tests passed')
