import { describe, expect, it } from 'vitest'
import { seaPolygonsFromCoastlines, type CoastPoint } from './earthCoastline'

const bounds = { south: 0, west: 0, north: 10, east: 10 }

function area(ring: CoastPoint[]) {
  let sum = 0
  for (let i = 0; i < ring.length - 1; i++) sum += ring[i].lon * ring[i + 1].lat - ring[i + 1].lon * ring[i].lat
  return Math.abs(sum) / 2
}
function contains(ring: CoastPoint[], point: CoastPoint) {
  let hit = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j]
    if ((a.lat > point.lat) !== (b.lat > point.lat) && point.lon < (b.lon - a.lon) * (point.lat - a.lat) / (b.lat - a.lat) + a.lon) hit = !hit
  }
  return hit
}

describe('sea polygons from coastlines', () => {
  it('closes the water side of a coast with the sea in the south', () => {
    // Travelling west → east keeps land (north) on the left, sea (south) on the right.
    const { sea } = seaPolygonsFromCoastlines([[{ lat: 4, lon: -5 }, { lat: 4, lon: 5 }], [{ lat: 4, lon: 5 }, { lat: 4, lon: 15 }]], bounds)
    expect(sea).toHaveLength(1)
    expect(area(sea[0])).toBeCloseTo(40, 6)
    expect(contains(sea[0], { lat: 2, lon: 5 })).toBe(true)
    expect(contains(sea[0], { lat: 7, lon: 5 })).toBe(false)
  })

  it('follows the orientation: the same line reversed puts the sea in the north', () => {
    const { sea } = seaPolygonsFromCoastlines([[{ lat: 4, lon: 15 }, { lat: 4, lon: -5 }]], bounds)
    expect(sea).toHaveLength(1)
    expect(area(sea[0])).toBeCloseTo(60, 6)
    expect(contains(sea[0], { lat: 7, lon: 5 })).toBe(true)
  })

  it('handles a bay entering and leaving through the same border', () => {
    // Sea reaches in from the south as a bay; land is everything else.
    const { sea } = seaPolygonsFromCoastlines([[{ lat: -1, lon: 3 }, { lat: 5, lon: 3 }, { lat: 5, lon: 7 }, { lat: -1, lon: 7 }]], bounds)
    expect(sea).toHaveLength(1)
    expect(area(sea[0])).toBeCloseTo(20, 6)
    expect(contains(sea[0], { lat: 2, lon: 5 })).toBe(true)
    expect(contains(sea[0], { lat: 2, lon: 1 })).toBe(false)
  })

  it('combines two coast pieces bounding one strait and reports islands', () => {
    const { sea, islands } = seaPolygonsFromCoastlines([
      [{ lat: 7, lon: -1 }, { lat: 7, lon: 11 }], // northern shore, sea south of it
      [{ lat: 3, lon: 11 }, { lat: 3, lon: -1 }], // southern shore, sea north of it
      [{ lat: 4.5, lon: 4 }, { lat: 5.5, lon: 4 }, { lat: 5.5, lon: 6 }, { lat: 4.5, lon: 6 }, { lat: 4.5, lon: 4 }],
    ], bounds)
    expect(sea).toHaveLength(1)
    expect(area(sea[0])).toBeCloseTo(40, 6)
    expect(islands).toHaveLength(1)
  })

  it('ignores coastlines that never enter the view or end inside it', () => {
    expect(seaPolygonsFromCoastlines([[{ lat: 20, lon: 0 }, { lat: 20, lon: 10 }]], bounds).sea).toHaveLength(0)
    expect(seaPolygonsFromCoastlines([[{ lat: 4, lon: -5 }, { lat: 4, lon: 5 }]], bounds).sea).toHaveLength(0)
  })
})
