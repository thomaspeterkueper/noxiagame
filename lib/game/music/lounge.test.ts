import { describe, expect, it } from 'vitest'
import { nextLoungeIndex } from './lounge'

describe('Lounge-Musik', () => {
  it('wiederholt nie denselben Titel direkt', () => {
    for (let previous = 0; previous < 3; previous++) for (const r of [0, 0.34, 0.67, 0.99]) expect(nextLoungeIndex(3, previous, () => r)).not.toBe(previous)
  })
  it('bei einem Titel bleibt es dabei', () => { expect(nextLoungeIndex(1, 0)).toBe(0) })
})
