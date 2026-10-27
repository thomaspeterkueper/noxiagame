import { describe, expect, it } from 'vitest'
import { anchorScaleError, REANCHOR_DISTANCE_M, shouldReanchor } from './reanchor'

describe('Zeichenanker', () => {
  it('Sundern → Frankfurt: Kachelmaßstab weicht um rund 2,6 % ab', () => {
    expect(anchorScaleError(51.327, 50.11)).toBeGreaterThan(0.024)
    expect(anchorScaleError(51.327, 50.11)).toBeLessThan(0.028)
  })
  it('innerhalb der Schwelle bleibt der Fehler unter einem Viertelmeter je Kachel', () => {
    const dLat = REANCHOR_DISTANCE_M / 111_320
    expect(anchorScaleError(51.327, 51.327 - dLat) * 191).toBeLessThan(0.25)
  })
  it('nahe am Anker nie', () => {
    expect(shouldReanchor({ distanceM: 4000, jumped: true, idleS: 10, autoWalking: false })).toBe(false)
  })
  it('nach weitem Sprung sofort', () => {
    expect(shouldReanchor({ distanceM: 140_000, jumped: true, idleS: 0, autoWalking: false })).toBe(true)
  })
  it('beim Laufen erst im Stillstand und nicht während „Gehe hin“', () => {
    expect(shouldReanchor({ distanceM: 6000, jumped: false, idleS: 0.2, autoWalking: false })).toBe(false)
    expect(shouldReanchor({ distanceM: 6000, jumped: false, idleS: 3, autoWalking: true })).toBe(false)
    expect(shouldReanchor({ distanceM: 6000, jumped: false, idleS: 3, autoWalking: false })).toBe(true)
  })
})
