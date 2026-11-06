import { describe, expect, it } from 'vitest'
import { BOUNDS, FINDS, SAMPLES, START, findNear, groundAt, labNear, stepTo } from './dvarakaGrabung'

describe('Dvārakā Grabung', () => {
  it('14 Fundpunkte, eindeutig, im Gelände', () => {
    expect(FINDS).toHaveLength(14)
    expect(new Set(FINDS.map(f => f.id)).size).toBe(14)
    for (const f of FINDS) {
      expect(f.at.x).toBeGreaterThanOrEqual(BOUNDS.minX); expect(f.at.x).toBeLessThanOrEqual(BOUNDS.maxX)
      expect(f.at.y).toBeGreaterThanOrEqual(BOUNDS.minY); expect(f.at.y).toBeLessThanOrEqual(BOUNDS.maxY)
      expect(['R', 'S']).toContain(f.label)
    }
  })
  it('Start liegt an Land', () => { expect(groundAt(START)).toBe('land') })
  it('Untergründe', () => {
    expect(groundAt({ x: 0, y: 0 })).toBe('deep')
    expect(groundAt({ x: -75, y: -93 })).toBe('mole')
    expect(groundAt({ x: 60, y: -200 })).toBe('shallow')
    expect(groundAt({ x: 9999, y: 0 })).toBe('out')
  })
  it('tiefes Wasser sperrt, Flachwasser bremst', () => {
    expect(stepTo({ x: 122, y: 0 }, { x: 0, y: 0 }, 5)).toEqual({ x: 122, y: 0 })
    const slow = stepTo({ x: 60, y: -150 }, { x: 60, y: -250 }, 4)
    expect(slow.y).toBeCloseTo(-152, 5)
    expect(stepTo({ x: 200, y: 0 }, { x: 300, y: 0 }, 5)).toEqual({ x: 205, y: 0 })
  })
  it('Proben gehören zu Funden und haben Befunde', () => {
    for (const [id, sample] of Object.entries(SAMPLES)) {
      expect(FINDS.some(f => f.id === id)).toBe(true)
      expect(sample.source).toBe(id)
      expect(sample.findings.length).toBeGreaterThan(0)
    }
    expect(labNear({ x: 355, y: 45 })).toBe(true)
    expect(labNear({ x: 0, y: 200 })).toBe(false)
  })
  it('Fund in der Nähe', () => {
    expect(findNear({ x: 452, y: 2 })?.id).toBe('G9')
    expect(findNear({ x: 330, y: 70 })).toBeNull()
  })
})
