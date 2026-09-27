import { describe, expect, it } from 'vitest'
import {
  CES_REFERENCE_ACTORS,
  CES_REFERENCE_CENTRE,
  runCesReferenceScenario,
} from './culturalEpistemic.reference'

describe('CES vertical reference scenario', () => {
  it('keeps the reference resonance centre plural and valid', () => {
    expect(CES_REFERENCE_CENTRE.pluralUse).toBe(true)
    expect(runCesReferenceScenario().institutionErrors).toEqual([])
  })

  it('models a valid controversy without choosing a correct interpretation', () => {
    const result = runCesReferenceScenario()
    expect(result.controversyErrors).toEqual([])
    expect(result.memoryClassification).toBe('contested_attribution')
  })

  it('activates relevant belief processing deterministically', () => {
    const first = runCesReferenceScenario().actorActivations
    const second = runCesReferenceScenario().actorActivations
    expect(first).toEqual(second)
    expect(first).toHaveLength(CES_REFERENCE_ACTORS.length)
    expect(first.every(actor => actor.active)).toBe(true)
  })

  it('keeps reference actors non-canonical and role-based', () => {
    expect(CES_REFERENCE_ACTORS.every(actor => actor.id.startsWith('ces-ref-'))).toBe(true)
  })
})
