import { describe, expect, it } from 'vitest'
import { buildingHeightM, buildingMassingStyle, extrudeFootprint } from './buildingMassing'

describe('building massing', () => {
  it('prefers mapped height, then levels, then the class default', () => {
    expect(buildingHeightM({ building: 'house', height: '9,5' })).toBe(9.5)
    expect(buildingHeightM({ building: 'apartments', 'building:levels': '4' })).toBe(13)
    expect(buildingHeightM({ building: 'garage' })).toBe(3)
    expect(buildingHeightM({ building: 'church' })).toBe(14)
    expect(buildingHeightM({ building: 'yes' })).toBe(6.5)
  })

  it('gives halls a flat roof, houses a pitched one, and is stable per id', () => {
    expect(buildingMassingStyle('a', { building: 'warehouse' }).roofForm).toBe('flat')
    expect(buildingMassingStyle('a', { building: 'house' }).roofForm).toBe('pitched')
    expect(buildingMassingStyle('osm:way:1', { building: 'house' })).toEqual(buildingMassingStyle('osm:way:1', { building: 'house' }))
  })

  it('extrudes only viewer-facing walls, for either winding', () => {
    const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]
    for (const base of [square, [...square].reverse()]) {
      const { walls, roof } = extrudeFootprint(base, 5)
      expect(walls).toHaveLength(1)
      expect(walls[0].points.slice(0, 2).every(point => point.y === 10)).toBe(true)
      expect(roof.every((point, index) => point.y === base[index].y - 5)).toBe(true)
    }
    // An isometric diamond shows two walls: one lit, one shaded.
    const diamond = extrudeFootprint([{ x: 0, y: -5 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: -10, y: 0 }], 4)
    expect(diamond.walls.map(wall => wall.lit).sort()).toEqual([false, true])
  })
})
