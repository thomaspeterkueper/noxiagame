import { describe, expect, it } from 'vitest'
import { worldviewConversationLines, worldviewVoiceFromPublicRole } from './worldviewVoices'

describe('worldview voices', () => {
  it('maps public roles to voices', () => {
    expect(worldviewVoiceFromPublicRole('Pfarrer · St. Johannes')).toBe('clergy')
    expect(worldviewVoiceFromPublicRole('Omnizedentin')).toBe('omnizedent')
    expect(worldviewVoiceFromPublicRole('Omnizedent/in · Resonanzplatz Sundern')).toBe('omnizedent')
    // Live pilots (migration 20261028124500)
    expect(worldviewVoiceFromPublicRole('Omnizedentin · Resonanzrunde Hubertushalle')).toBe('omnizedent')
    expect(worldviewVoiceFromPublicRole('Omnizedent · Wasseraufbereitung')).toBe('omnizedent')
    expect(worldviewVoiceFromPublicRole('Resonanzbegleitung')).toBe('resonance_host')
    expect(worldviewVoiceFromPublicRole('Gastgeber im Tempel des DaVaRu')).toBe('davaru')
    expect(worldviewVoiceFromPublicRole('Wegbegleiterin')).toBe('davaru')
  })

  it('leaves ordinary roles without a worldview voice', () => {
    expect(worldviewVoiceFromPublicRole('Barista')).toBeNull()
    expect(worldviewVoiceFromPublicRole(null)).toBeNull()
    expect(worldviewConversationLines(null)).toEqual([])
  })

  it('keeps every voice non-proselytising and conviction-framed', () => {
    for (const voice of ['clergy', 'davaru', 'omnizedent', 'resonance_host'] as const) {
      const text = worldviewConversationLines(voice).join(' ')
      expect(text).toMatch(/bekehrst niemanden/)
      expect(text).toMatch(/nie als bewiesene Weltwahrheit/)
    }
  })

  it('does not present Omnizedenz as religion or science', () => {
    const text = worldviewConversationLines('omnizedent').join(' ')
    expect(text).toMatch(/keine Religion/)
    expect(text).toMatch(/keine physikalischen Kräfte/)
  })
})
