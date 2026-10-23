import { benchmarkDigitalEnsemble, type EnsembleNode, type EnsembleSample, type EnsembleResult } from './digitalEnsemble'

/** Digital comparison only. No organoid behaviour or biological learning is modeled. */
export interface EnsembleComparison {
  scenario: string
  single: EnsembleResult
  ensemble: EnsembleResult
  digitalReference: EnsembleResult
  evaluatedVotes: { single: number; ensemble: number; digitalReference: number }
}
export function compareDigitalEnsembles(input: {
  samples: readonly EnsembleSample[]
  nodes: readonly [EnsembleNode, EnsembleNode, EnsembleNode]
  referenceNode: EnsembleNode
  seed: number
  noiseAmplitude?: number
  unavailableNodeIds?: readonly string[]
  scenario?: string
}): EnsembleComparison {
  const common = { samples: input.samples, seed: input.seed, noiseAmplitude: input.noiseAmplitude, unavailableNodeIds: input.unavailableNodeIds }
  const single = benchmarkDigitalEnsemble({ ...common, nodes: [input.nodes[0]] })
  const ensemble = benchmarkDigitalEnsemble({ ...common, nodes: input.nodes })
  const digitalReference = benchmarkDigitalEnsemble({ ...common, nodes: [input.referenceNode] })
  const votes = (result: EnsembleResult) => result.predictions.reduce((sum, prediction) => sum + prediction.activeNodes, 0)
  return { scenario: input.scenario ?? 'baseline', single, ensemble, digitalReference, evaluatedVotes: { single: votes(single), ensemble: votes(ensemble), digitalReference: votes(digitalReference) } }
}
