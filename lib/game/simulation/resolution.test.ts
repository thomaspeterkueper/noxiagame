import { describe, expect, it } from 'vitest'
import {
  assessResolution,
  observerVisibleDepth,
  resolutionRank,
} from './resolution'

describe('adaptive resolution contract', () => {
  it('keeps coarse state when it already satisfies the operation', () => {
    expect(assessResolution({
      ontologicalDepth: 'atomic',
      simulatedDepth: 'object',
      epistemicDepth: 'object',
      requestedDepth: 'object',
      trigger: 'interaction',
    })).toEqual({
      physicallyAvailable: true,
      needsRefinement: false,
      refinementJustified: false,
      observerCanAccess: true,
      coarseStateSufficient: true,
    })
  })

  it('can refine internally without granting observer knowledge', () => {
    const result = assessResolution({
      ontologicalDepth: 'atomic',
      simulatedDepth: 'object',
      epistemicDepth: 'component',
      requestedDepth: 'atomic',
      trigger: 'failure',
    })
    expect(result.needsRefinement).toBe(true)
    expect(result.refinementJustified).toBe(true)
    expect(result.observerCanAccess).toBe(false)
  })

  it('does not refine merely because deeper detail is imaginable', () => {
    const result = assessResolution({
      ontologicalDepth: 'subatomic',
      simulatedDepth: 'object',
      epistemicDepth: 'object',
      requestedDepth: 'atomic',
      trigger: 'none',
    })
    expect(result.needsRefinement).toBe(true)
    expect(result.refinementJustified).toBe(false)
  })

  it('rejects resolution beyond the world model', () => {
    const result = assessResolution({
      ontologicalDepth: 'material',
      simulatedDepth: 'material',
      epistemicDepth: 'material',
      requestedDepth: 'molecular',
      trigger: 'research',
    })
    expect(result.physicallyAvailable).toBe(false)
    expect(result.needsRefinement).toBe(false)
    expect(result.observerCanAccess).toBe(false)
  })

  it('caps observer-visible depth independently of engine detail', () => {
    expect(observerVisibleDepth('atomic', 'material')).toBe('material')
    expect(observerVisibleDepth('component', 'atomic')).toBe('component')
    expect(resolutionRank('subatomic')).toBeGreaterThan(resolutionRank('atomic'))
  })
})
