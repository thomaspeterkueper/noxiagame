/**
 * Deterministic DIGITAL ensemble benchmark inspired by organoid decoding.
 * This models complementary noisy sensors, not neurons, learning or awareness.
 * Pure functions; no random calls, DB writes, network or runtime scheduling.
 */
export interface EnsembleSample {
  id: string
  label: 0 | 1
  signal: readonly number[]
}
export interface EnsembleNode {
  id: string
  channel: number
  threshold: number
  polarity?: 1 | -1
}
export interface EnsemblePrediction {
  sampleId: string
  expected: 0 | 1
  predicted: 0 | 1
  votes: number
  activeNodes: number
}
export interface EnsembleResult {
  accuracy: number
  correct: number
  total: number
  predictions: EnsemblePrediction[]
}

function hash32(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
function unitNoise(seed: number, key: string): number {
  return hash32(seed + ':' + key) / 0xffffffff * 2 - 1
}
function predict(sample: EnsembleSample, nodes: readonly EnsembleNode[], seed: number, noiseAmplitude: number, unavailable: ReadonlySet<string>): EnsemblePrediction {
  let votes = 0
  let activeNodes = 0
  for (const node of nodes) {
    if (unavailable.has(node.id)) continue
    const signal = sample.signal[node.channel]
    if (!Number.isFinite(signal)) continue
    const polarity = node.polarity ?? 1
    const noise = unitNoise(seed, sample.id + ':' + node.id) * noiseAmplitude
    votes += (signal * polarity + noise >= node.threshold) ? 1 : -1
    activeNodes++
  }
  // Tie/no sensors -> deterministic negative class, never fabricated confidence.
  return { sampleId: sample.id, expected: sample.label, predicted: votes > 0 ? 1 : 0, votes, activeNodes }
}
export function benchmarkDigitalEnsemble(input: {
  samples: readonly EnsembleSample[]
  nodes: readonly EnsembleNode[]
  seed: number
  noiseAmplitude?: number
  unavailableNodeIds?: readonly string[]
}): EnsembleResult {
  if (!Number.isSafeInteger(input.seed)) throw new Error('seed must be a safe integer')
  const amplitude = input.noiseAmplitude ?? 0
  if (!Number.isFinite(amplitude) || amplitude < 0 || amplitude > 10) throw new Error('noiseAmplitude out of range')
  if (input.nodes.length === 0 || input.nodes.length > 64) throw new Error('node count out of range')
  if (input.samples.length > 10000) throw new Error('sample count out of range')
  const ids = new Set<string>()
  for (const node of input.nodes) {
    if (!node.id || ids.has(node.id) || !Number.isSafeInteger(node.channel) || node.channel < 0 || !Number.isFinite(node.threshold)) throw new Error('invalid node')
    ids.add(node.id)
  }
  const unavailable = new Set(input.unavailableNodeIds ?? [])
  const predictions = input.samples.map(sample => {
    if (!sample.id || (sample.label !== 0 && sample.label !== 1)) throw new Error('invalid sample')
    return predict(sample, input.nodes, input.seed, amplitude, unavailable)
  })
  const correct = predictions.filter(p => p.activeNodes > 0 && p.predicted === p.expected).length
  return { accuracy: predictions.length ? correct / predictions.length : 0, correct, total: predictions.length, predictions }
}
