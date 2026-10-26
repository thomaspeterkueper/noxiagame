import { describe, expect, it } from 'vitest'
import { LANDMARK_LEVELS, LANDMARK_SPOT_REACH, isLandmarkRoomBlocked, landmarkRoomKind, landmarkRoomLayout, landmarkPath,
  landmarkStaffName, landmarkWaypoints, nearestLandmarkSpot, type LandmarkPoint, type LandmarkRoomLayout } from './interiors'

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

  for (const kind of ['library', 'worship', 'shop', 'workshop', 'artlounge'] as const) {
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

  it('finds a path around furniture to every waypoint, for player and staff', () => {
    for (const kind of ['library', 'worship', 'shop', 'workshop', 'artlounge'] as const) {
      const layout = landmarkRoomLayout(kind)
      const points = landmarkWaypoints(layout)
      expect(points.length).toBeGreaterThan(3)
      for (const point of points) {
        const path = landmarkPath(layout, layout.start, point)
        expect(path.length, `${kind}/${point.id}`).toBeGreaterThan(2)
        for (const step of path.slice(1, -1)) expect(isLandmarkRoomBlocked(layout, step, 7), `${kind}/${point.id}`).toBe(false)
      }
      if (layout.staff) expect(landmarkPath(layout, layout.staff, points[0]).length).toBeGreaterThan(2)
    }
  })

  it('CAMALEO-ArtLounge: Flügel, Sitzplätze und ein Büro im Hinterzimmer', () => {
    const layout = landmarkRoomLayout('artlounge')
    expect(layout.furniture.some(item => item.kind === 'piano')).toBe(true)
    expect(layout.furniture.filter(item => item.id.startsWith('seat-')).length).toBeGreaterThanOrEqual(10)
    expect(layout.furniture.some(item => item.kind === 'desk')).toBe(true)
    const office = layout.spots.find(spot => spot.id === 'office')!
    const path = landmarkPath(layout, layout.start, office)
    expect(path.length).toBeGreaterThan(2)
    expect(landmarkRoomKind('artlounge')).toBe('artlounge')
  })

  it('CAMALEO-ArtLounge hat drei Geschosse, verbunden durch die Treppe', () => {
    expect(LANDMARK_LEVELS.artlounge).toBe(3)
    for (let level = 0; level < 3; level++) {
      const layout = landmarkRoomLayout('artlounge', level)
      expect(layout.level).toBe(level)
      const stairs = layout.spots.filter(spot => spot.action === 'stairs')
      expect(stairs.length).toBeGreaterThan(0)
      for (const spot of stairs) {
        expect(isLandmarkRoomBlocked(layout, spot)).toBe(false)
        expect(spot.toLevel).not.toBe(level)
      }
      const arrival = landmarkRoomLayout('artlounge', level, true).start
      expect(isLandmarkRoomBlocked(layout, arrival)).toBe(false)
      for (const spot of layout.spots) expect(landmarkPath(layout, arrival, spot).length, `${level}/${spot.id}`).toBeGreaterThan(2)
    }
  })
})
