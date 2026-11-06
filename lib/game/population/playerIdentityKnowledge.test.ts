import { describe, expect, it } from 'vitest'
import { perceivedIdentityState, perceivedPersonLabel } from './playerIdentityKnowledge'

describe('player identity knowledge', () => {
  it('shows only an observable description while identity is unknown', () => {
    expect(perceivedPersonLabel({
      state: 'unknown',
      observableDescription: 'Mann, ca. 30',
    })).toBe('Mann, ca. 30')
  })

  it('shows an inferred label without promoting it to confirmed identity', () => {
    expect(perceivedPersonLabel({
      state: 'inferred',
      observableDescription: 'Mann, ca. 60',
      inferredName: 'vermutlich Arven Adams',
    })).toBe('vermutlich Arven Adams')
  })

  it('shows the confirmed name after identification', () => {
    expect(perceivedPersonLabel({
      state: 'known',
      observableDescription: 'Mann, ca. 60',
      knownName: 'Arven Adams',
    })).toBe('Arven Adams')
  })

  it('treats missing knowledge as unknown', () => {
    expect(perceivedIdentityState(null)).toBe('unknown')
  })
})
