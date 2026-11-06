import { describe, expect, it } from 'vitest'
import { chronomapsForPlace, chronomapsNear, CHRONOMAPS } from './chronomaps'

describe('Chronomaps', () => {
  it('Button nur bei Treffern', () => {
    expect(chronomapsForPlace('Hagia Sophia').map(m => m.id)).toEqual(['konstantinopel-hafen'])
    expect(chronomapsForPlace('Dvārakā').map(m => m.id)).toEqual(['dvaraka-1600-bc'])
    expect(chronomapsForPlace('Bäckerei Müller')).toEqual([])
    expect(chronomapsForPlace(undefined)).toEqual([])
  })
  it('Timetravel-Agencys nur in der Gegend', () => {
    expect(chronomapsNear({ lat: 41.01, lon: 28.97 }).map(m => m.id)).toEqual(['konstantinopel-hafen'])
    expect(chronomapsNear({ lat: 50.26, lon: 8.41 })).toEqual([])
  })
  it('Kennungen eindeutig', () => { expect(new Set(CHRONOMAPS.map(m => m.id)).size).toBe(CHRONOMAPS.length) })
})
