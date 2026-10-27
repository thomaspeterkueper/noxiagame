import { describe, expect, it } from 'vitest'
import { apronOutline, convexHull, facilityClusters, footprintCorners, nativeStandKind, padOutline, pointsAlong } from './facility'

describe('world lab: facilities of NOXIA buildings without a real house', () => {
  it('groups buildings that stand close together', () => {
    const items = [
      { x: 0, y: 0, w: 40, d: 30, rotation: 0 },
      { x: 70, y: 0, w: 40, d: 30, rotation: 0 },     // 30 m Lücke → dieselbe Anlage
      { x: 600, y: 600, w: 20, d: 20, rotation: 0 },  // weit weg → eigene
    ]
    const groups = facilityClusters(items).map(group => group.sort()).sort((a, b) => a[0] - b[0])
    expect(groups).toEqual([[0, 1], [2]])
  })

  it('outlines an apron around all footprints with a margin', () => {
    const outline = apronOutline([{ x: 0, y: 0, w: 20, d: 10, rotation: 0 }, { x: 50, y: 0, w: 20, d: 10, rotation: 0 }], 5)
    const xs = outline.map(p => p.x), ys = outline.map(p => p.y)
    expect(Math.min(...xs)).toBeCloseTo(-15)
    expect(Math.max(...xs)).toBeCloseTo(65)
    expect(Math.min(...ys)).toBeCloseTo(-10)
    expect(Math.max(...ys)).toBeCloseTo(10)
    expect(outline).toHaveLength(4)
  })

  it('computes a convex hull without inner points', () => {
    const hull = convexHull([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 5, y: 5 }])
    expect(hull).toHaveLength(4)
    expect(hull).not.toContainEqual({ x: 5, y: 5 })
  })

  it('rotates footprints and places posts along a ring', () => {
    const corners = footprintCorners({ x: 0, y: 0, w: 10, d: 4, rotation: 90 })
    expect(Math.abs(corners[0].x)).toBeCloseTo(2)
    expect(Math.abs(corners[0].y)).toBeCloseTo(5)
    expect(pointsAlong([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], 5)).toHaveLength(8)
  })

  it('draws pads and solar fields itself, at their real size', () => {
    expect(nativeStandKind('spaceport_pad_standard')).toBe('pad')
    expect(nativeStandKind('spaceport_pad_mini')).toBe('pad')
    expect(nativeStandKind('solar')).toBe('solar')
    expect(nativeStandKind('warehouse')).toBeNull()
    const pad = padOutline({ x: 0, y: 0, w: 120, d: 90, rotation: 0 })
    expect(pad).toHaveLength(8)
    expect(Math.max(...pad.map(p => p.x))).toBeCloseTo(60)
    expect(Math.max(...pad.map(p => p.y))).toBeCloseTo(45)
  })
})
