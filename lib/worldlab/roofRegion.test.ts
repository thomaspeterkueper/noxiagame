import { describe, expect, it } from 'vitest'
import { hasSpires, roofRegion, ROOF_FACTOR } from './roofRegion'

describe('Dachform nach Region', () => {
  it('Gujarat und Sahel flach', () => {
    expect(roofRegion(22.23, 68.96)).toBe('flat')
    expect(roofRegion(15, 0)).toBe('flat')
  })
  it('Istanbul und Rom flach geneigt, Hessen normal, Norwegen steil', () => {
    expect(roofRegion(41, 29)).toBe('low')
    expect(roofRegion(41.9, 12.5)).toBe('low')
    expect(roofRegion(50.26, 8.41)).toBe('normal')
    expect(roofRegion(63, 10)).toBe('steep')
  })
  it('Faktoren und Türme', () => {
    expect(ROOF_FACTOR.flat).toBe(0)
    expect(ROOF_FACTOR.low).toBeLessThan(ROOF_FACTOR.normal)
    expect(hasSpires('flat')).toBe(false)
    expect(hasSpires('low')).toBe(true)
  })
})
