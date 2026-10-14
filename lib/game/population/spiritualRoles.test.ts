import { describe, expect, it } from 'vitest'
import { spiritualRoleDefinition, spiritualRoleFitsTradition } from './spiritualRoles'

describe('spiritual roles', () => {
  it('keeps tradition-specific roles explicit', () => {
    expect(spiritualRoleFitsTradition('imam','islamic')).toBe(true)
    expect(spiritualRoleFitsTradition('imam','christian')).toBe(false)
  })

  it('does not treat Omnizedenz facilitation as clergy', () => {
    expect(spiritualRoleDefinition('resonance_facilitator')).toMatchObject({
      clergyLike: false,
      traditions: ['omnizedenz'],
    })
  })
})
