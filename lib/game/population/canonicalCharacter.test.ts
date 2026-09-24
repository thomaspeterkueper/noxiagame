import { describe, expect, it } from 'vitest'
import { canonicalIdentityFactors, isCanonicalCharacterActive, type CanonicalCharacterRef } from './canonicalCharacter'

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

describe('canonical character identity bridge', () => {
  it('limits participation to the configured simulation window', () => {
    expect(isCanonicalCharacterActive(ref, 99)).toBe(false)
    expect(isCanonicalCharacterActive(ref, 100)).toBe(true)
    expect(isCanonicalCharacterActive(ref, 200)).toBe(true)
    expect(isCanonicalCharacterActive(ref, 201)).toBe(false)
  })

  it('exposes identity metadata without injecting canon knowledge', () => {
    expect(canonicalIdentityFactors(ref)).toEqual({
      universeKey: 'noxia',
      characterKey: 'character-1',
      integrationMode: 'canon_anchor',
    })
  })
})
