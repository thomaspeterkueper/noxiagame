import { describe, expect, it } from 'vitest'
import { aiVerdictIsSuspect, parseAiVerdict } from './aiReview'

describe('parseAiVerdict', () => {
  it('liest JSON auch mit Text drumherum', () => {
    const v = parseAiVerdict('Ergebnis: {"verdict":"real_world","category":"drugs","confidence":0.8,"reason":"Verkauf gegen Euro","language":"de"}')
    expect(v).toEqual({ verdict: 'real_world', category: 'drugs', confidence: 0.8, reason: 'Verkauf gegen Euro', language: 'de' })
    expect(aiVerdictIsSuspect(v)).toBe(true)
  })
  it('unsichere oder spielbezogene Urteile sichern nichts', () => {
    expect(aiVerdictIsSuspect(parseAiVerdict('{"verdict":"real_world","category":"drugs","confidence":0.4}'))).toBe(false)
    expect(aiVerdictIsSuspect(parseAiVerdict('{"verdict":"unclear","category":"other","confidence":0.9}'))).toBe(false)
    expect(aiVerdictIsSuspect(parseAiVerdict('{"verdict":"game","category":"none","confidence":1}'))).toBe(false)
  })
  it('entfernt Zitatzeichen aus der Begründung und verwirft Unsinn', () => {
    expect(parseAiVerdict('{"verdict":"game","reason":"sagt „Koks“"}')?.reason).toBe('sagt Koks')
    expect(parseAiVerdict('kein json')).toBeNull()
    expect(parseAiVerdict('{"verdict":"vielleicht"}')).toBeNull()
  })
})
