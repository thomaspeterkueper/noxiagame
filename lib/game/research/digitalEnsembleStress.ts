import { compareDigitalEnsembles, type EnsembleComparison } from './digitalEnsembleComparison'
import type { EnsembleNode, EnsembleSample } from './digitalEnsemble'

/** Bounded, deterministic stress matrix. Pure digital benchmark, no live workload. */
export interface StressCase {
  noiseAmplitude: number
  failedNodes: readonly string[]
  result: EnsembleComparison
  undecidedRate: number
}
export function runDigitalEnsembleStress(input: {
  samples: readonly EnsembleSample[]
  nodes: readonly [EnsembleNode, EnsembleNode, EnsembleNode]
  referenceNode: EnsembleNode
  seed: number
  noiseLevels?: readonly number[]
}): StressCase[] {
  const noiseLevels = input.noiseLevels ?? [0, 0.25, 0.5, 1]
  if (noiseLevels.length > 12) throw new Error('too many noise levels')
  const failures = [[], ...input.nodes.map(node => [node.id]), input.nodes.map(node => node.id)]
  return noiseLevels.flatMap(noiseAmplitude => failures.map(failedNodes => {
    const result = compareDigitalEnsembles({ ...input, noiseAmplitude, unavailableNodeIds: failedNodes, scenario: 'noise=' + noiseAmplitude + ';failed=' + failedNodes.join(',') })
    const undecidedRate = result.ensemble.total ? result.ensemble.predictions.filter(p => p.undecided).length / result.ensemble.total : 0
    return { noiseAmplitude, failedNodes, result, undecidedRate }
  }))
}
