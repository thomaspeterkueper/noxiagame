import { describe, expect, it } from 'vitest'
import { immersionPrice, immersionSeconds, partyDiscount, partyLabel, receptionGreeting } from './immersion'

describe('Erlebnis-Studio', () => {
  it('Preis je Person sinkt mit der Gruppe', () => {
    expect(immersionPrice('chronotrip')).toBe(90)
    expect(immersionPrice('chronotrip', 2)).toBe(77)
    expect(immersionPrice('chronotrip', 3)).toBe(68)
    expect(immersionPrice('abstract', 6)).toBe(23)
    expect(immersionPrice('game', 99)).toBe(immersionPrice('game', 6))
    expect(immersionPrice('game', 0)).toBe(60)
  })
  it('Rabattstufen und Dauer', () => {
    expect([1, 2, 3, 5].map(partyDiscount)).toEqual([0, 0.15, 0.25, 0.25])
    expect(immersionSeconds('abstract')).toBe(900)
  })
  it('Empfang stabil, Gruppenanzeige', () => {
    expect(receptionGreeting('Erlebnis-Studio · Sundern')).toBe(receptionGreeting('Erlebnis-Studio · Sundern'))
    expect(partyLabel([])).toBe('noch niemand')
    expect(partyLabel(['Anna', 'Ben'])).toBe('Anna, Ben')
    expect(partyLabel(['a', 'b', 'c', 'd', 'e'])).toBe('a, b, c und 2 weitere')
  })
})
