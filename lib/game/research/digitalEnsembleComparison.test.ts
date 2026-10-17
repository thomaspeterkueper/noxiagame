import { strict as assert } from 'node:assert'
import { compareDigitalEnsembles } from './digitalEnsembleComparison'
const nodes = [
  { id: 'sensor-a', channel: 0, threshold: 0 },
  { id: 'sensor-b', channel: 1, threshold: 0 },
  { id: 'sensor-c', channel: 2, threshold: 0 },
] as const
const samples = [
  { id: 'positive', label: 1 as const, signal: [1, 1, -1] },
  { id: 'negative', label: 0 as const, signal: [-1, -1, 1] },
]
const options = { samples, nodes, referenceNode: { id: 'digital-reference', channel: 0, threshold: 0 }, seed: 17, noiseAmplitude: 0 }
const baseline = compareDigitalEnsembles(options)
assert.deepEqual(baseline, compareDigitalEnsembles(options), 'comparison must replay identically')
assert.equal(baseline.single.accuracy, 1)
assert.equal(baseline.ensemble.accuracy, 1)
assert.equal(baseline.digitalReference.accuracy, 1)
assert.equal(baseline.evaluatedVotes.ensemble, 6)
assert.equal(baseline.evaluatedVotes.single, 2)
assert.equal(baseline.evaluatedVotes.digitalReference, 2)
const failure = compareDigitalEnsembles({ ...options, unavailableNodeIds: ['sensor-a'] })
assert.equal(failure.single.correct, 0, 'single unavailable sensor cannot score correct')
assert.equal(failure.ensemble.correct, 0, 'conflicting surviving sensors must not be scored as correct')
assert.equal(failure.ensemble.predictions.filter(p => p.undecided).length, 2, 'both conflicting samples must be explicitly undecided')
assert.equal(failure.digitalReference.correct, 2, 'independent digital reference remains available')
console.log('Digital ensemble comparison passed')
