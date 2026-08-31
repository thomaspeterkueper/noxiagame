import assert from 'node:assert/strict'
import {
  cellsInRadius,
  discoveriesFromMeasurement,
  groundTruthFromTerrain,
  measureScanner,
  mergeDiscoveries,
} from './scanning'

const terrain = [
  ['tile_surface', 'tile_crater', 'tile_surface'],
  ['tile_surface', 'tile_ice', 'tile_surface'],
  ['tile_surface', 'tile_surface', 'tile_surface'],
]

const truth = groundTruthFromTerrain(terrain)
assert.equal(truth.length, 2)
assert.deepEqual(truth, groundTruthFromTerrain(terrain), 'ground truth must be deterministic for the same world state')

const cells = cellsInRadius({ row: 1, col: 1 }, 1, 3, 3)
assert.ok(cells.some(cell => cell.row === 0 && cell.col === 1))
assert.ok(!cells.some(cell => cell.row === 0 && cell.col === 0), 'radius is Euclidean')

const measurement = measureScanner({
  origin: { row: 1, col: 1 },
  radius: 1,
  rows: 3,
  cols: 3,
  groundTruth: truth,
})
assert.equal(measurement.signals.length, 2)

const discoveries = discoveriesFromMeasurement(measurement)
assert.equal(discoveries.length, 2)
assert.ok(discoveries.every(item => item.interpretation.confidence === 'medium'))
assert.equal(mergeDiscoveries(discoveries, discoveries).length, 2, 'repeat scans must remain idempotent')

const changedWorld = groundTruthFromTerrain([
  ['tile_surface', 'tile_surface', 'tile_surface'],
  ['tile_surface', 'tile_ice', 'tile_surface'],
  ['tile_surface', 'tile_surface', 'tile_surface'],
])
assert.equal(changedWorld.length, 1, 'scanner truth follows world state instead of inventing anomalies')

console.log('Scanner canonical pipeline: OK')
