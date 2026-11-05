import { describe, expect, it } from 'vitest'
import { cleanPlayerLook, defaultPlayerLook, lookAtWork } from './playerLook'

describe('playerLook', () => {
  it('keeps allowed values and drops the rest', () => {
    const l = cleanPlayerLook({ age: 'alt', hair: 'dutt', skin: '#5E3B25', clothes: 'fest', beard: 'vollbart', robot: true, extra: '<script>' }, 'u1')
    expect(l).toMatchObject({ age: 'alt', hair: 'dutt', skin: '#5e3b25', clothes: 'fest', beard: 'vollbart', robot: false })
    expect(Object.keys(l)).not.toContain('extra')
  })
  it('never a child, never a robot, unknown colours fall back', () => {
    expect(cleanPlayerLook({ age: 'kind', skin: '#123456' }, 'u2').age).not.toBe('kind')
    expect(cleanPlayerLook({ skin: '#123456' }, 'u2').skin).not.toBe('#123456')
    expect(defaultPlayerLook('x').robot).toBe(false)
  })
  it('work clothes over the own look during a shift', () => {
    const l = cleanPlayerLook({ clothes: 'fest' }, 'u3')
    expect(lookAtWork(l, 'u3', 'bar').clothes).toBe('bar')
    expect(lookAtWork(l, 'u3', null).clothes).toBe('fest')
  })
})
