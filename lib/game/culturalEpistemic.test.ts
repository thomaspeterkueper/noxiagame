import { describe, expect, it } from 'vitest'
import {
  evaluateCesActivation,
  normalizeBeliefState,
  resolveCesQuestion,
} from './culturalEpistemic'

describe('CES foundation', () => {
  it('normalizes hot belief state', () => {
    expect(normalizeBeliefState({
      commitment: 2,
      socialBinding: -1,
      revisability: 0.4,
      salience: Number.NaN,
    })).toEqual({
      commitment: 1,
      socialBinding: 0,
      revisability: 0.4,
      salience: 0,
    })
  })

  it('keeps irrelevant events out of belief processing', () => {
    expect(evaluateCesActivation({
      belief: { commitment: 1, socialBinding: 1, revisability: 0, salience: 1 },
      relevance: 0,
    }).active).toBe(false)
  })

  it('can raise salience for a relevant intense event', () => {
    const result = evaluateCesActivation({
      belief: { commitment: 0.5, socialBinding: 0.2, revisability: 0.8, salience: 0.05 },
      relevance: 0.8,
      intensity: 0.8,
    })
    expect(result.active).toBe(true)
    expect(result.effectiveSalience).toBeGreaterThan(0.25)
  })

  it('never resolves an ontologically open question', () => {
    expect(resolveCesQuestion({
      id: 'ultimate-purpose',
      ontology: 'open',
      value: true,
    })).toBeUndefined()
  })

  it('may expose a defined determinate value to authorized internal consumers', () => {
    expect(resolveCesQuestion({
      id: 'reactor-failed',
      ontology: 'determinate',
      value: true,
    })).toBe(true)
  })
})
