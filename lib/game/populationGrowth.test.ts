import { describe, expect, it } from 'vitest'
import { nextPopulation, steppedDelta } from './populationGrowth'

describe('steppedDelta', () => {
  it('verteilt Bruchteile exakt über die Ticks', () => {
    let sum = 0
    for (let t = 0; t < 1000; t++) sum += steppedDelta(0.07, t)
    expect(sum).toBe(70)
  })
  it('ist deterministisch und nie negativ', () => {
    expect(steppedDelta(0.3, 41)).toBe(steppedDelta(0.3, 41))
    expect(steppedDelta(-1, 3)).toBe(0)
    expect(steppedDelta(2.5, 0) + steppedDelta(2.5, 1)).toBe(5)
  })
})

describe('nextPopulation', () => {
  const base = { populationMax: 5100, growthRate: 0.0002, declineRate: 0.05 }
  it('lässt kleine versorgte Kolonien wachsen', () => {
    let pop = 317
    for (let t = 0; t < 100; t++) pop = nextPopulation({ ...base, population: pop, supplied: true, tickNumber: t })
    expect(pop).toBeGreaterThan(317)
    expect(pop).toBeLessThan(330)
  })
  it('lässt auch sehr kleine unversorgte Kolonien schrumpfen', () => {
    let pop = 6
    for (let t = 0; t < 10; t++) pop = nextPopulation({ ...base, population: pop, supplied: false, tickNumber: t })
    expect(pop).toBeLessThan(6)
  })
  it('überschreitet die Kapazität nicht', () => {
    expect(nextPopulation({ ...base, population: 5100, supplied: true, tickNumber: 7 })).toBe(5100)
  })
})
