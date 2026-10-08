import { describe, expect, it } from 'vitest'
import { evaluateMarsCloud, type MarsCloudConditions } from './cloudEvents'

const morning: MarsCloudConditions = {
  regionId: 'arsia-mons',
  bucket: 123,
  localHour: 7,
  saturationRatio: 1.5,
  nucleiAvailability: 0.4,
  lift: 0.8,
  terrainAvailable: true,
}

describe('Mars cloud event screening', () => {
  it('is deterministic and identifies dust mediated candidates', () => {
    expect(evaluateMarsCloud(morning)).toEqual(evaluateMarsCloud({ ...morning }))
    expect(evaluateMarsCloud(morning).mechanism).toBe('dust-mediated')
  })
  it('does not show morning events in the afternoon', () => {
    expect(evaluateMarsCloud({ ...morning, localHour: 15 }).state).toBe('inactive')
  })
  it('does not invent terrain or atmosphere', () => {
    expect(evaluateMarsCloud({ ...morning, terrainAvailable: false }).state).toBe('unresolved')
    expect(evaluateMarsCloud({ ...morning, saturationRatio: null }).state).toBe('unresolved')
  })
  it('gates the experimental homogeneous hypothesis', () => {
    const thinDust = { ...morning, nucleiAvailability: 0.01, saturationRatio: 2.5 }
    expect(evaluateMarsCloud(thinDust).state).toBe('inactive')
    expect(evaluateMarsCloud(thinDust, true).mechanism).toBe('homogeneous-hypothesis')
  })
})
