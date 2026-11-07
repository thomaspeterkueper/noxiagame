import { strict as assert } from 'node:assert'
import { benchmarkDigitalEnsemble, type EnsembleSample, type EnsembleNode } from './digitalEnsemble'
const samples: EnsembleSample[] = [
  { id: 'a', label: 1, signal: [1, 1, -1] },
  { id: 'b', label: 0, signal: [-1, -1, 1] },
  { id: 'c', label: 1, signal: [1, -1, 1] },
  { id: 'd', label: 0, signal: [-1, 1, -1] },
]
const nodes: EnsembleNode[] = [
  { id: 'n1', channel: 0, threshold: 0 },
  { id: 'n2', channel: 1, threshold: 0 },
  { id: 'n3', channel: 2, threshold: 0 },
]
const run = (unavailableNodeIds: string[] = []) => benchmarkDigitalEnsemble({ samples, nodes, seed: 42, noiseAmplitude: 0.1, unavailableNodeIds })
assert.deepEqual(run(), run(), 'replay must be deterministic')
assert.equal(run().accuracy, 1, 'majority fusion can recover complementary observations')
assert.equal(run(['n1']).total, samples.length)
assert.equal(run(['n1','n2','n3']).correct, 0, 'no available sensors cannot count as success')
assert.equal(benchmarkDigitalEnsemble({ samples: [], nodes, seed: 1 }).accuracy, 0)
assert.throws(() => benchmarkDigitalEnsemble({ samples, nodes, seed: 1, noiseAmplitude: -1 }))
assert.throws(() => benchmarkDigitalEnsemble({ samples, nodes: [nodes[0], nodes[0]], seed: 1 }))
console.log('Digital ensemble benchmark passed')
