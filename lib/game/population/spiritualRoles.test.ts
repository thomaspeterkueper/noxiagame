import { describe, expect, it } from 'vitest'
import { spiritualRoleDefinition, spiritualRoleFitsTradition, traditionKind } from './spiritualRoles'

describe('spiritual roles', () => {
  it('keeps tradition-specific roles explicit', () => {
    expect(spiritualRoleFitsTradition('imam','islamic')).toBe(true)
    expect(spiritualRoleFitsTradition('imam','christian')).toBe(false)
  })

  it('keeps philosophical ways apart from religions and clergy', () => {
    expect(traditionKind('omnizedenz')).toBe('philosophical')
    expect(traditionKind('davaru')).toBe('philosophical')
    expect(traditionKind('christian')).toBe('religious')
    expect(spiritualRoleDefinition('omnizedent')).toMatchObject({ label: 'Omnizedent/in', clergyLike: false, traditions: ['omnizedenz'] })
    expect(spiritualRoleDefinition('davaru_companion')).toMatchObject({ clergyLike: false, traditions: ['davaru'] })
    expect(spiritualRoleFitsTradition('omnizedent', 'davaru')).toBe(false)
  })

  it('does not treat Omnizedenz facilitation as clergy', () => {
    expect(spiritualRoleDefinition('resonance_facilitator')).toMatchObject({
      clergyLike: false,
      traditions: ['omnizedenz'],
    })
  })
})
