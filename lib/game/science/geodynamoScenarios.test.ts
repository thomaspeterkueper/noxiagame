import { describe, expect, it } from 'vitest'
import { GEODYNAMO_SCENARIOS, compareGeodynamoScenarios } from './geodynamoScenarios'
describe('planetary scenario separation', () => {
  it('keeps exactly three named independently classified scenarios', () => {
    expect(GEODYNAMO_SCENARIOS.map(x => x.evidenceClass)).toEqual(['illustrative-earth','illustrative-mars','fictional'])
  })
  it('never infers extinction from polarity or core-mantle flux', () => {
    expect(compareGeodynamoScenarios().every(x => x.result.extinctionPrediction === null)).toBe(true)
  })
  it('keeps Mars toy dipole zero but does not assert absence of crustal fields', () => {
    const mars = compareGeodynamoScenarios()[1]
    expect(mars.result.illustrativeDipoleMomentAm2).toBe(0)
    expect(mars.scenario.description).toContain('crustal')
  })
  it('keeps Earth reversal polarity separate from the moment magnitude', () => {
    const earth = compareGeodynamoScenarios()[0].result
    expect(earth.dipolePolarity).toBe(-1)
    expect(earth.illustrativeDipoleMomentAm2).toBe(8e22)
  })
})
