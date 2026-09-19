import { describe, expect, it } from 'vitest'
import { projectHealthEffect } from './healthEffects'

const healthy = { personId: 'p1', wellbeing: 1, conditionCode: null, severity: 0, requiresMedicalCare: false, updatedTick: null }

describe('causal health effects', () => {
  it('turns a material workplace accident into medical-care demand', () => {
    const next = projectHealthEffect(healthy, { eventType: 'workplace_accident', severity: 0.5 }, 10)
    expect(next.conditionCode).toBe('minor_injury')
    expect(next.requiresMedicalCare).toBe(true)
    expect(next.wellbeing).toBeLessThan(1)
  })

  it('keeps a minor exhaustion event below the medical threshold', () => {
    const next = projectHealthEffect(healthy, { eventType: 'exhaustion', severity: 0.15 }, 10)
    expect(next.requiresMedicalCare).toBe(false)
  })
})
