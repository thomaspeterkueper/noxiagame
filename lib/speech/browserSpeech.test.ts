import { describe, expect, it } from 'vitest'
import { speechChunks, voiceChoice } from './browserSpeech'

describe('Sprachausgabe', () => {
  it('teilt lange Texte an Satzenden und verliert nichts', () => {
    const text = 'Erster Satz. Zweiter Satz ist etwas länger! Dritter? Vierter Satz zum Schluss.'
    const chunks = speechChunks(text, 30)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.join(' ')).toBe(text)
    expect(chunks.every(chunk => chunk.length <= 45)).toBe(true)
  })
  it('wählt für dieselbe Figur immer dieselbe Stimme, nur deutsche', () => {
    const voices = [{ lang: 'en-US', name: 'a' }, { lang: 'de-DE', name: 'b' }, { lang: 'de-AT', name: 'c' }, { lang: 'de-DE', name: 'd' }]
    const first = voiceChoice(voices, 'mira')
    expect(voiceChoice(voices, 'mira')).toEqual(first)
    expect(first.german.map(voice => voice.name)).toEqual(['b', 'c', 'd'])
    expect(first.pitch).toBeGreaterThanOrEqual(0.9)
    expect(first.pitch).toBeLessThanOrEqual(1.1)
  })
  it('ohne deutsche Stimme bleibt es bei der Standardstimme', () => {
    expect(voiceChoice([{ lang: 'en-US', name: 'a' }], 'x').voiceIndex).toBe(-1)
  })
})
