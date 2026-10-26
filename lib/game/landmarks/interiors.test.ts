import { describe, expect, it } from 'vitest'
import { LANDMARK_SPOT_REACH, isLandmarkRoomBlocked, landmarkRoomKind, landmarkRoomLayout, landmarkStaffName, nearestLandmarkSpot, type LandmarkPoint, type LandmarkRoomLayout } from './interiors'

/** Every position reachable from the entrance in 6 px steps. */
function reachable(layout: LandmarkRoomLayout) {
  const key = (p: LandmarkPoint) => `${p.x},${p.y}`
  const seen = new Set([key(layout.start)])
  const queue = [layout.start]
  while (queue.length) {
    const p = queue.pop()!
    for (const [dx, dy] of [[6, 0], [-6, 0], [0, 6], [0, -6]]) {
      const next = { x: p.x + dx, y: p.y + dy }
      if (seen.has(key(next)) || isLandmarkRoomBlocked(layout, next)) continue
      seen.add(key(next))
      queue.push(next)
    }
  }
  return [...seen].map(entry => { const [x, y] = entry.split(',').map(Number); return { x, y } })
}

describe('landmark interiors', () => {
  it('maps only library and place of worship to a room', () => {
    expect(landmarkRoomKind('library')).toBe('library')
    expect(landmarkRoomKind('place_of_worship')).toBe('worship')
    expect(landmarkRoomKind('museum')).toBeNull()
  })

  for (const kind of ['library', 'worship'] as const) {
    it(`${kind}: entrance is free and every spot can be reached on foot`, () => {
      const layout = landmarkRoomLayout(kind)
      expect(isLandmarkRoomBlocked(layout, layout.start)).toBe(false)
      const cells = reachable(layout)
      for (const spot of layout.spots) {
        const close = cells.some(cell => Math.hypot(cell.x - spot.x, cell.y - spot.y) <= LANDMARK_SPOT_REACH - 6)
        expect(close, `${kind}/${spot.id}`).toBe(true)
      }
    })

    it(`${kind}: furniture blocks and spots resolve by distance`, () => {
      const layout = landmarkRoomLayout(kind)
      const item = layout.furniture[0]
      expect(isLandmarkRoomBlocked(layout, { x: item.x + item.w / 2, y: item.y + item.h / 2 })).toBe(true)
      const spot = layout.spots[0]
      expect(nearestLandmarkSpot(layout, { x: spot.x, y: spot.y })?.id).toBe(spot.id)
      expect(nearestLandmarkSpot(layout, { x: -500, y: -500 })).toBeNull()
    })
  }

  it('library staff stands free and reachable, with a stable name per house', () => {
    const layout = landmarkRoomLayout('library')
    expect(layout.staff).not.toBeNull()
    expect(isLandmarkRoomBlocked(layout, { x: layout.staff!.x, y: layout.staff!.y })).toBe(false)
    const cells = reachable(layout)
    expect(cells.some(cell => Math.hypot(cell.x - layout.staff!.x, cell.y - layout.staff!.y) <= LANDMARK_SPOT_REACH)).toBe(true)
    expect(landmarkStaffName('Stadtbibliothek Sundern')).toBe(landmarkStaffName('Stadtbibliothek Sundern'))
    expect(landmarkRoomLayout('worship').staff).toBeNull()
  })
})
