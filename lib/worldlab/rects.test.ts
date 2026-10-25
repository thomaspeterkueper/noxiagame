import { describe, expect, it } from 'vitest'
import { rectsOverlap } from './rects'

describe('rectsOverlap', () => {
  it('detects overlap and separation', () => {
    expect(rectsOverlap({ x: 0, y: 0, hw: 5, hd: 3, a: 0 }, { x: 8, y: 0, hw: 4, hd: 2, a: 0 })).toBe(true)
    expect(rectsOverlap({ x: 0, y: 0, hw: 5, hd: 3, a: 0 }, { x: 10, y: 0, hw: 4, hd: 2, a: 0 })).toBe(false)
  })
  it('handles rotation', () => {
    // Diagonal gedrehtes Quadrat erreicht mit der Spitze das andere
    expect(rectsOverlap({ x: 0, y: 0, hw: 2, hd: 2, a: 0 }, { x: 4.5, y: 0, hw: 2, hd: 2, a: Math.PI / 4 })).toBe(true)
    expect(rectsOverlap({ x: 0, y: 0, hw: 2, hd: 2, a: 0 }, { x: 5, y: 0, hw: 2, hd: 2, a: Math.PI / 4 })).toBe(false)
  })
})
