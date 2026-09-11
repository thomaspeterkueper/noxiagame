import { strict as assert } from 'node:assert'
import { buildMarsBuildabilitySurface, deriveMarsElevationSlopeDeg, marsPlanningCellCenter } from './marsBuildabilitySurface'
import type { MarsElevationGrid } from './marsBuildabilitySurface'
import { createMarsRegionAnchor, localMetersToMarsGeo } from './marsSpatial'

const region = createMarsRegionAnchor('synthetic-tharsis-test', 'Synthetic test frame', { lat: 10, lon: 20, elevationM: 0 })
const spacingM = 500
const grid: MarsElevationGrid = {
  rows: 3,
  cols: 3,
  samples: [],
  source: { provider: 'test-mola', dataset: 'deterministic-mars-grid', resolutionM: spacingM, verticalReference: 'MOLA_GMM2B_AREOID' },
}
const heights = [100, 100, 100, 100, 150, 100, 100, 100, 100]

for (let row = 0; row < 3; row++) {
  for (let col = 0; col < 3; col++) {
    const geo = localMetersToMarsGeo({ eastM: (col - 1) * spacingM, northM: (1 - row) * spacingM }, region.origin)
    grid.samples.push({ lat: geo.lat, lon: geo.lon, elevationM: heights[row * 3 + col] })
  }
}

const centerSlope = deriveMarsElevationSlopeDeg(grid, 1, 1)
assert.ok(centerSlope != null)
assert.ok(Math.abs(centerSlope - Math.atan2(50, spacingM) * 180 / Math.PI) < .05)

const surface = buildMarsBuildabilitySurface(grid, region, { maxBuildableSlopeDeg: 3, maxRestrictedSlopeDeg: 8 })
assert.equal(surface.cells.length, 9)
const center = surface.cells.find(cell => cell.row === 1 && cell.col === 1)
assert.ok(center)
assert.equal(center.state, 'restricted')
assert.equal(center.buildabilityReason, 'slope-requires-mitigation')
assert.equal(center.elevationM, 150)

const corner = surface.cells.find(cell => cell.row === 0 && cell.col === 0)
assert.ok(corner)
assert.equal(corner.state, 'buildable')

const roundTrip = marsPlanningCellCenter(region, center.xM, center.yM)
assert.ok(Math.abs(roundTrip.lat - region.origin.lat) < 1e-8)
assert.ok(Math.abs(roundTrip.lon - region.origin.lon) < 1e-8)

console.log('Mars buildability surface tests passed')
