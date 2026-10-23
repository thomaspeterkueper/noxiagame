import { strict as assert } from 'node:assert'
import { runDigitalEnsembleStress } from './digitalEnsembleStress'
const nodes = [{ id: 'a', channel: 0, threshold: 0 }, { id: 'b', channel: 1, threshold: 0 }, { id: 'c', channel: 2, threshold: 0 }] as const
const samples = [{ id: 'p', label: 1 as const, signal: [1, 1, -1] }, { id: 'n', label: 0 as const, signal: [-1, -1, 1] }]
const input = { nodes, samples, referenceNode: { id: 'ref', channel: 0, threshold: 0 }, seed: 7 }
const matrix = runDigitalEnsembleStress(input)
assert.equal(matrix.length, 20, 'four noise levels times five failure configurations')
assert.deepEqual(matrix, runDigitalEnsembleStress(input), 'stress matrix replay')
assert.equal(matrix[4].result.ensemble.correct, 0, 'all failed sensors cannot yield a valid classification')
assert.equal(matrix[4].undecidedRate, 1)
assert.ok(matrix.every(row => row.result.ensemble.accuracy >= 0 && row.result.ensemble.accuracy <= 1))
assert.throws(() => runDigitalEnsembleStress({ ...input, noiseLevels: Array(13).fill(0) }))
console.log('Digital ensemble stress matrix passed')
