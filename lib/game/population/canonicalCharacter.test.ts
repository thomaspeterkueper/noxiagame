import { describe, expect, it } from 'vitest'
import { emergentCharacterEvent, isCanonicalCharacterActive, type CanonicalCharacterRef } from './canonicalCharacter'

const ref: CanonicalCharacterRef = {
  personId: 'p1',
  universeKey: 'noxia',
  characterKey: 'character-1',
  canonSourceRef: 'ore:character-1',
  canonRevision: 'r1',
  integrationMode: 'canon_anchor',
  validFromTick: 100,
  validUntilTick: 200,
}

describe('canonical character bridge', () => {
  it('respects the canonical character simulation window', () => {
    expect(isCanonicalCharacterActive(ref, 99)).toBe(false)
    expect(isCanonicalCharacterActive(ref, 100)).toBe(true)
    expect(isCanonicalCharacterActive(ref, 200)).toBe(true)
    expect(isCanonicalCharacterActive(ref, 201)).toBe(false)
  })

  it('creates emergent history only while the character is active', () => {
    expect(emergentCharacterEvent(ref, 150, 'facility_shift', 'facility-1')).toEqual({
      tick: 150,
      eventType: 'facility_shift',
      subjectRef: 'facility-1',
    })
    expect(emergentCharacterEvent(ref, 250, 'facility_shift')).toBeNull()
  })
})
