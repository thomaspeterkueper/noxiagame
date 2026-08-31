import assert from 'node:assert/strict'
import {
  SCANNER_BASE_RADIUS,
  cellsInRadius,
  groundTruthForLocation,
  runScannerMeasurement,
} from './scanning'

const truthA = groundTruthForLocation('mars', 24, 32)
const truthB = groundTruthForLocation('mars', 24, 32)
assert.deepEqual(truthA, truthB, 'ground truth must be deterministic and independent of scanner state')
assert.equal(truthA.length, 1)

const cells = cellsInRadius({ row: 10, col: 10 }, SCANNER_BASE_RADIUS, 24, 32)
assert.ok(cells.some((cell) => cell.row === 10 && cell.col === 14), 'radius boundary must be included')
assert.ok(!cells.some((cell) => cell.row === 14 && cell.col === 14), 'Euclidean radius must exclude diagonal cells beyond radius')
for (const cell of cells) {
  const dr = cell.row - 10
  const dc = cell.col - 10
  assert.ok(Math.sqrt(dr * dr + dc * dc) <= SCANNER_BASE_RADIUS)
}

const truth = truthA[0]
const hit = runScannerMeasurement({
  locationSlug: 'mars',
  scannerEntityId: 'scanner-test',
  origin: { row: truth.row, col: truth.col },
  rows: 24,
  cols: 32,
  radius: SCANNER_BASE_RADIUS,
})
assert.equal(hit.discoveries.length, 1, 'measurement over ground truth must produce a discovery')
assert.equal(hit.discoveries[0].interpretation.label, 'Geologische Anomalie')
assert.equal(hit.discoveries[0].interpretation.confidence, 'low')
assert.equal(hit.discoveries[0].groundTruthId, truth.id)

const missOrigin = truth.row > 12 ? { row: 0, col: 0 } : { row: 23, col: 31 }
const miss = runScannerMeasurement({
  locationSlug: 'mars',
  scannerEntityId: 'scanner-test',
  origin: missOrigin,
  rows: 24,
  cols: 32,
  radius: 0,
})
assert.equal(miss.discoveries.length, 0, 'measurement outside ground truth must not invent a discovery')

console.log('Scanner domain separation: OK')
