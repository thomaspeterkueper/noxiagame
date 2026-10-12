import { describe, expect, it } from 'vitest'
import { buildingHeightM, buildingMassingStyle, bellTowerFootprint, extrudeFootprint, hasBellTower, hipRoof, windowPath } from './buildingMassing'

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

  it('builds a hip roof with the ridge on the long axis, for either edge order', () => {
    const long = [{ xM: 0, yM: 0 }, { xM: 12, yM: 0 }, { xM: 12, yM: 8 }, { xM: 0, yM: 8 }]
    for (const footprint of [long, [long[1], long[2], long[3], long[0]]]) {
      const roof = hipRoof(footprint)!
      expect([roof.ridgeA.yM, roof.ridgeB.yM]).toEqual([4, 4])
      expect([roof.ridgeA.xM, roof.ridgeB.xM].sort((a, b) => a - b)).toEqual([4, 8])
      expect(roof.faces.filter(face => face.ridge.length === 1)).toHaveLength(2)
      // Every face must close onto ridge ends adjacent to its own edge.
      for (const face of roof.faces) {
        const p = footprint[face.edge], q = footprint[(face.edge + 1) % 4]
        const first = face.ridge[0] === 'a' ? roof.ridgeA : roof.ridgeB
        const other = face.ridge[0] === 'a' ? roof.ridgeB : roof.ridgeA
        const near = (point: { xM: number; yM: number }, ridge: { xM: number; yM: number }) => Math.hypot(point.xM - ridge.xM, point.yM - ridge.yM)
        expect(near(q, first)).toBeLessThanOrEqual(near(q, other))
        if (face.ridge.length === 2) expect(near(p, other)).toBeLessThanOrEqual(near(p, first))
      }
    }
    expect(hipRoof([{ xM: 0, yM: 0 }, { xM: 5, yM: 0 }, { xM: 5, yM: 5 }])).toBeNull()
  })

  it('draws window rows only where a wall is long and tall enough', () => {
    const wall = { points: [{ x: 0, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 2 }, { x: 0, y: 2 }] }
    expect(windowPath([wall], 9, 8).split('M').length - 1).toBe(15)
    expect(windowPath([{ points: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: -8 }, { x: 0, y: -8 }] }], 9, 8)).toBe('')
    expect(windowPath([wall], 30, 4)).toBe('')
  })

  it('places a bell tower inside one short end of the nave', () => {
    const nave = [{ xM: 0, yM: 0 }, { xM: 30, yM: 0 }, { xM: 30, yM: 12 }, { xM: 0, yM: 12 }]
    const tower = bellTowerFootprint(nave)!
    expect(tower.sideM).toBeCloseTo(6.6, 5)
    for (const corner of tower.corners) {
      // Which short end carries the tower follows the footprint's edge order.
      expect(corner.xM).toBeGreaterThanOrEqual(23.4 - 1e-9)
      expect(corner.xM).toBeLessThanOrEqual(30 + 1e-9)
      expect(corner.yM).toBeGreaterThan(2)
      expect(corner.yM).toBeLessThan(10)
    }
    expect(bellTowerFootprint([{ xM: 0, yM: 0 }, { xM: 6, yM: 0 }, { xM: 6, yM: 4 }, { xM: 0, yM: 4 }])).toBeNull()
    expect(hasBellTower('church')).toBe(true)
    expect(hasBellTower('mosque')).toBe(false)
  })

  it('draws one row of high windows when asked for tall windows', () => {
    const wall = { points: [{ x: 0, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 0 }, { x: 0, y: 0 }] }
    expect(windowPath([wall], 14, 10, 4.6, true).split('M').length - 1).toBe(4)
  })
})
