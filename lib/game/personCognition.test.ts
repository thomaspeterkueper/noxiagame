import { describe, expect, it } from 'vitest'
import { cognitiveTriggerScore, consolidateMemories, createInsightCandidate, creativityFromTraits, selectCognitiveState } from './personCognition'

describe('person cognition', () => {
  it('keeps ordinary routine at compute tier zero', () => {
    const creativity = creativityFromTraits({ creativity: 0.4, routine_stability: 0.9 })
    expect(selectCognitiveState({ sleeping: false, creativity, stimulus: { novelty: 0.05 } }).mode).toBe('routine')
  })

  it('makes sleep cheap and forbids external inference', () => {
    const creativity = creativityFromTraits({ creativity: 1 })
    expect(selectCognitiveState({ sleeping: true, creativity, unresolvedProblem: true, expertise: 1, reflectiveState: 'dream', stimulus: { novelty: 1 } }))
      .toMatchObject({ mode: 'sleep', computeTier: 0, allowExternalInference: false })
  })

  it('lets creativity lower routine resistance without making creativity omniscience', () => {
    const stimulus = { novelty: 0.8, surprise: 0.7, goalConflict: 0.5 }
    const stable = creativityFromTraits({ creativity: 0.1, routine_stability: 0.95 })
    const creative = creativityFromTraits({ creativity: 0.95, routine_stability: 0.2 })
    expect(cognitiveTriggerScore(stimulus, creative)).toBeGreaterThan(cognitiveTriggerScore(stimulus, stable))
  })

  it('creates only non-canonical insight hypotheses', () => {
    expect(createInsightCandidate({ problemRef: 'drive-heat-loss', inspirationRefs: ['KG:thermal-gradient', 'OTA:rare-gas'], hypothesis: 'Test a gradient-coupled mechanism.', confidence: 0.62, provenance: 'knowledge_gateway' }).canonical).toBe(false)
  })

  it('consolidates salient recent memories ahead of weak old ones deterministically', () => {
    const result = consolidateMemories([
      { id: 'old', salience: 0.1, valence: 0, tick: 0, summary: 'routine' },
      { id: 'important', salience: 0.9, valence: -0.7, tick: 239, summary: 'crisis' },
    ], 240)
    expect(result[0].id).toBe('important')
  })
})
