import { describe, expect, it } from 'vitest'
import { observedPersonNoun, personSceneLabel } from './personSceneLabel'

describe('personSceneLabel', () => {
  it('shows only what one sees for strangers', () => {
    expect(personSceneLabel({ identityState: 'unknown', displayName: 'Ein Mann mittleren Alters mit ruhiger Haltung, aufmerksam', appearance: { genderPresentation: 'masculine', visibleAgeBand: 'adult' } })).toBe('Mann')
    expect(observedPersonNoun({ genderPresentation: 'feminine', visibleAgeBand: 'child' })).toBe('Mädchen')
    expect(observedPersonNoun({ genderPresentation: 'masculine', visibleAgeBand: 'child' })).toBe('Junge')
    expect(observedPersonNoun({ genderPresentation: 'androgynous', visibleAgeBand: 'older' })).toBe('Ältere Person')
    expect(observedPersonNoun(null)).toBe('Person')
  })
  it('shows the name once known, the age only when known', () => {
    expect(personSceneLabel({ identityState: 'known', displayName: 'Thomas Küper' })).toBe('Thomas Küper')
    expect(personSceneLabel({ identityState: 'known', displayName: 'Thomas Küper', knownAgeYears: 58 })).toBe('Thomas Küper (58)')
    expect(personSceneLabel({ identityState: 'inferred', displayName: 'Mika' })).toBe('Mika')
    expect(personSceneLabel({ identityState: 'unknown', displayName: 'Mika', knownAgeYears: 40, appearance: { genderPresentation: 'feminine', visibleAgeBand: 'adult' } })).toBe('Frau')
  })
})
