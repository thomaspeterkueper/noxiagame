import { describe, expect, it } from 'vitest'
import { operationFromProduction } from './facilityProductionWear'

describe('facility production wear', () => {
  it('derives deterministic load and wear from credited output', () => {
    expect(operationFromProduction(8, { wearRatePerUnit: 0.002, nominalOutput: 10 }))
      .toEqual({ wearRate: 0.016, load: 0.8 })
  })

  it('caps load while retaining explicit output wear', () => {
    expect(operationFromProduction(15, { wearRatePerUnit: 0.001, nominalOutput: 10 }))
      .toEqual({ wearRate: 0.015, load: 1 })
  })
})
