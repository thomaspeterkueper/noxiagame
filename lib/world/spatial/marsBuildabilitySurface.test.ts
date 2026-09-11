import { strict as assert } from 'node:assert'
import { buildMarsBuildabilitySurface, deriveMarsElevationSlopeDeg, marsPlanningCellCenter } from './marsBuildabilitySurface'
import type { MarsElevationGrid } from './marsBuildabilitySurface'
import { THARSIS_REGION, localMetersToMarsGeo } from './marsSpatial'

const spacingM = 500
const grid: MarsElevationGrid = {
  rows: 3,
  cols: 3,
  samples: [],
  source: {
    provider: 'test-mola',
    dataset: 'deterministic-mars-grid',
    resolutionM: spacingM,
    verticalReference: 'MOLA_AREOID',
  },
}

const heights = [
  100, 100, 100,
  100, 150, 100,
  100, 100, 100,
]

for (let row = 0; row < 3; row++) {
  for (let col = 0; col < 3; col++) {
    const geo = localMetersToMarsGeo({
      eastM: (col - 1) * spacingM,
      northM: (1 - row) * spacingM,
    }, THARSIS_REGION.origin)
    grid.samples.push({ lat: geo.lat, lon: geo.lon, elevationM: heights[row * 3 + col] })
  }
}

const centerSlope = deriveMarsElevationSlopeDeg(grid, 1, 1)
assert.ok(centerSlope != null)
assert.ok(Math.abs(centerSlope - Math.atan2(50, spacingM) * 180 / Math.PI) < 0.05)

const surface = buildMarsBuildabilitySurface(grid, THARSIS_REGION, {
  maxBuildableSlopeDeg: 3,
  maxRestrictedSlopeDeg: 8,
})
assert.equal(surface.cells.length, 9)
assert.equal(surface.source.dataset, 'deterministic-mars-grid')

const center = surface.cells.find(cell => cell.row === 1 && cell.col === 1)
assert.ok(center)
assert.ok(Math.abs(center.xM) < 0.01)
assert.ok(Math.abs(center.yM) < 0.01)
assert.equal(center.elevationM, 150)
assert.equal(center.state, 'restricted')
assert.equal(center.buildabilityReason, 'slope-requires-mitigation')
assert.equal(center.gridSizeM, THARSIS_REGION.cellSizeM)

const corner = surface.cells.find(cell => cell.row === 0 && cell.col === 0)
assert.ok(corner)
assert.equal(corner.state, 'buildable')

const roundTrip = marsPlanningCellCenter(THARSIS_REGION, center.xM, center.yM)
assert.ok(Math.abs(roundTrip.lat - THARSIS_REGION.origin.lat) < 1e-8)
assert.ok(Math.abs(roundTrip.lon - THARSIS_REGION.origin.lon) < 1e-8)

console.log('Mars buildability surface tests passed')
