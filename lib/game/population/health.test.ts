import { describe, expect, it } from 'vitest'
import { decideMedicalCare } from './health'

describe('medical care decision', () => {
  it('seeks care for an explicit care-required condition', () => {
    const decision = decideMedicalCare({ personId: 'p1', wellbeing: 0.72, conditionCode: 'minor_injury', severity: 0.4, requiresMedicalCare: true, updatedTick: 1 })
    expect(decision?.action).toBe('seek_medical_care')
  })

  it('does not invent illness for a healthy person', () => {
    expect(decideMedicalCare({ personId: 'p1', wellbeing: 0.95, conditionCode: null, severity: 0.05, requiresMedicalCare: false, updatedTick: 1 })).toBeNull()
  })
})
