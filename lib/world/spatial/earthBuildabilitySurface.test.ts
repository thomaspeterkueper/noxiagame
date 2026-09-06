import { strict as assert } from 'node:assert'
import { buildEarthBuildabilitySurface, deriveElevationSlopeDeg, earthPlanningCellCenter } from './earthBuildabilitySurface'
import type { ElevationGrid } from './elevationSource'
import type { ImportedEarthFeature } from './earthFeatureSource'
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

const polygonAround = (lat: number, lon: number, halfLat = dLat * 0.2, halfLon = dLon * 0.2) => [
  { lat: lat - halfLat, lon: lon - halfLon },
  { lat: lat - halfLat, lon: lon + halfLon },
  { lat: lat + halfLat, lon: lon + halfLon },
  { lat: lat + halfLat, lon: lon - halfLon },
]

const topLeft = grid.samples[0]
const bottomRight = grid.samples[8]
const features: ImportedEarthFeature[] = [
  {
    id: 'water:test-pond',
    worldId: 'earth',
    featureType: 'water',
    geometryKind: 'polygon',
    properties: {},
    geometry: { kind: 'polygon', coordinates: polygonAround(topLeft.lat, topLeft.lon) },
    source: { provider: 'test', dataset: 'observed-water' },
  },
  {
    id: 'forest:test-stand',
    worldId: 'earth',
    featureType: 'forest',
    geometryKind: 'polygon',
    properties: {},
    geometry: { kind: 'polygon', coordinates: polygonAround(bottomRight.lat, bottomRight.lon) },
    source: { provider: 'test', dataset: 'observed-landuse' },
  },
]

const centerSlope = deriveElevationSlopeDeg(grid, 1, 1)
assert.ok(centerSlope != null)
assert.ok(Math.abs(centerSlope - Math.atan2(10, 100) * 180 / Math.PI) < 0.05)

const surface = buildEarthBuildabilitySurface(grid, EARTH_SAUERLAND_REGION, {
  maxBuildableSlopeDeg: 3,
  maxRestrictedSlopeDeg: 8,
}, {
  features,
  restrictionPolicy: {
    forest: { state: 'restricted', reason: 'forest-land-use' },
  },
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

const water = surface.cells.find(cell => cell.row === 0 && cell.col === 0)
assert.ok(water)
assert.equal(water.state, 'invalid')
assert.equal(water.buildabilityReason, 'water')
assert.deepEqual(water.matchedFeatureIds, ['water:test-pond'])

const forest = surface.cells.find(cell => cell.row === 2 && cell.col === 2)
assert.ok(forest)
assert.equal(forest.state, 'restricted')
assert.equal(forest.buildabilityReason, 'forest-land-use')
assert.deepEqual(forest.matchedFeatureIds, ['forest:test-stand'])

const roundTrip = earthPlanningCellCenter(EARTH_SAUERLAND_REGION, center.xM, center.yM)
assert.ok(Math.abs(roundTrip.lat - origin.lat) < 1e-9)
assert.ok(Math.abs(roundTrip.lon - origin.lon) < 1e-9)

console.log('earth buildability surface tests passed')
