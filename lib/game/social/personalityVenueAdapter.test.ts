import { describe, expect, it } from 'vitest'
import { contextualSocialPreferences } from './personalityVenueAdapter'
import type { NpcPreference } from './venueChoice'
const base: NpcPreference = { npcId: 'synthetic-a', interests: { music: 0.4 }, needs: {}, autonomy: 0.7 }
const traits = { curiosity: 0.9, sociability: 0.8, caution: 0.1, cooperation: 0.7 }
describe('approved personality venue adapter', () => {
  it('preserves legacy preferences without seed', () => {
    expect(contextualSocialPreferences(base, null, { unfamiliar: true, perceivedRisk: 0, trustedCompanion: false })).toBe(base)
  })
  it('increases exploration preference when safe and curious', () => {
    const actual = contextualSocialPreferences(base, traits, { unfamiliar: true, perceivedRisk: 0, trustedCompanion: true })
    expect(actual.interests.music).toBeGreaterThan(base.interests.music!)
    expect(base.interests.music).toBe(0.4)
  })
  it('caution lowers attraction when encountering risk', () => {
    const wary = { ...traits, caution: 1 }
    const safe = contextualSocialPreferences(base, wary, { unfamiliar: true, perceivedRisk: 0, trustedCompanion: false })
    const risky = contextualSocialPreferences(base, wary, { unfamiliar: true, perceivedRisk: 1, trustedCompanion: false })
    expect(risky.interests.music).toBeLessThan(safe.interests.music!)
  })
  it('rejects invalid traits and risk', () => {
    expect(() => contextualSocialPreferences(base, { ...traits, curiosity: NaN },
      { unfamiliar: true, perceivedRisk: 0, trustedCompanion: false })).toThrow()
  })
})
