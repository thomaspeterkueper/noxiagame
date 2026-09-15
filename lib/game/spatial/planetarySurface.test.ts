import { strict as assert } from 'node:assert'
import { buildPlanetaryBuildabilitySurface, derivePlanetarySlopeDeg } from './planetarySurface'
import type { PlanetaryElevationGrid, PlanetarySurfaceGeometry } from './planetarySurface'

const spacingM = 500
const grid: PlanetaryElevationGrid = {
  rows: 3,
  cols: 3,
  samples: [],
  source: {
    body: 'other',
    provider: 'test',
    dataset: 'synthetic-body-dem',
    resolutionM: spacingM,
    horizontalReference: 'TEST_BODY',
    verticalReference: 'TEST_DATUM',
  },
}

const heights = [100, 100, 100, 100, 150, 100, 100, 100, 100]
for (let row = 0; row < 3; row++) {
  for (let col = 0; col < 3; col++) {
    grid.samples.push({
      latDeg: 10 + (1 - row) * 0.001,
      lonDeg: 20 + (col - 1) * 0.001,
      elevationM: heights[row * 3 + col],
    })
  }
}

const geometry: PlanetarySurfaceGeometry = {
  project(sample) {
    return {
      xM: (sample.lonDeg - 20) * spacingM / 0.001,
      yM: (sample.latDeg - 10) * spacingM / 0.001,
    }
  },
  horizontalDistanceM(a, b) {
    const pa = this.project(a)
    const pb = this.project(b)
    return Math.hypot(pb.xM - pa.xM, pb.yM - pa.yM)
  },
}

const slope = derivePlanetarySlopeDeg(grid, 1, 1, geometry)
assert.ok(slope != null)
assert.ok(Math.abs(slope - Math.atan2(50, spacingM) * 180 / Math.PI) < 1e-9)

const surface = buildPlanetaryBuildabilitySurface(
  grid,
  10,
  { maxBuildableSlopeDeg: 3, maxRestrictedSlopeDeg: 8 },
  geometry,
)
assert.equal(surface.cells.length, 9)
assert.equal(surface.source.body, 'other')
const center = surface.cells.find(cell => cell.row === 1 && cell.col === 1)
assert.ok(center)
assert.equal(center.state, 'restricted')
assert.equal(center.buildabilityReason, 'slope-requires-mitigation')

const flat = surface.cells.find(cell => cell.row === 0 && cell.col === 0)
assert.ok(flat)
assert.equal(flat.state, 'buildable')

const unresolvedGrid: PlanetaryElevationGrid = {
  ...grid,
  samples: grid.samples.map((sample, index) => index === 4 ? { ...sample, elevationM: Number.NaN } : sample),
}
const unresolved = buildPlanetaryBuildabilitySurface(
  unresolvedGrid,
  10,
  { maxBuildableSlopeDeg: 3, maxRestrictedSlopeDeg: 8 },
  geometry,
)
const unresolvedCenter = unresolved.cells.find(cell => cell.row === 1 && cell.col === 1)
assert.ok(unresolvedCenter)
assert.equal(unresolvedCenter.state, 'unresolved')
assert.equal(unresolvedCenter.buildabilityReason, 'terrain-unresolved')

console.log('Planetary surface tests passed')
