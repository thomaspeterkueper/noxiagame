import { describe, expect, it } from 'vitest'
import { EXAMPLE_NEEDS, modelNeedUrgency } from './needRhythmsResearch'

describe('multi-rhythm research prototype', () => {
  it('produces repeatable results', () => {
    const a = modelNeedUrgency(EXAMPLE_NEEDS.sleep, 12)
    expect(modelNeedUrgency(EXAMPLE_NEEDS.sleep, 12)).toEqual(a)
    expect(a.urgency).toBeGreaterThanOrEqual(0)
    expect(a.urgency).toBeLessThanOrEqual(1)
  })
  it('retains the same phase after one oscillator period, if homeostasis is static', () => {
    const input = { ...EXAMPLE_NEEDS.sleep, homeostaticRatePerHour: 0, baselineDeficit: 0.4 }
    expect(modelNeedUrgency(input, 3).rhythm).toBeCloseTo(modelNeedUrgency(input, 27).rhythm, 10)
  })
  it('accumulates deficit and reduces it after recovery', () => {
    const input = { ...EXAMPLE_NEEDS.sleep, oscillators: [] }
    expect(modelNeedUrgency(input, 8).deficit).toBeGreaterThan(modelNeedUrgency(input, 0).deficit)
    expect(modelNeedUrgency(input, 8, 4).deficit).toBeLessThan(modelNeedUrgency(input, 8).deficit)
  })
  it('rejects backwards simulation time and invalid periods', () => {
    expect(() => modelNeedUrgency(EXAMPLE_NEEDS.sleep, -1)).toThrow()
    expect(() => modelNeedUrgency({ ...EXAMPLE_NEEDS.sleep, oscillators: [{ periodHours: 0, amplitude: 1, phaseHours: 0 }] }, 1)).toThrow()
  })
})
