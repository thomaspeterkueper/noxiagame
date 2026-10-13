import { describe, expect, it } from 'vitest'
import { DETAIL_RADIUS_KM, detailCell, groundDistanceM } from './detailCells'

describe('detailCell', () => {
  it('ordnet nahe Punkte derselben Zelle zu', () => {
    expect(detailCell({ lat: 51.3301, lon: 8.0021 })).toEqual(detailCell({ lat: 51.3302, lon: 8.0022 }))
  })

  it('deckt jeden Punkt mit dem Radius seiner Zelle ab', () => {
    for (let i = 0; i < 400; i++) {
      const point = { lat: 51.2 + (i * 0.0137) % 0.3, lon: 7.9 + (i * 0.0291) % 0.3 }
      expect(groundDistanceM(point, detailCell(point))).toBeLessThan(DETAIL_RADIUS_KM * 1000)
    }
  })

  it('ist rund 667 m groß', () => {
    const a = detailCell({ lat: 51.3301, lon: 8.0 })
    const b = detailCell({ lat: 51.3301 + 0.006, lon: 8.0 })
    const c = detailCell({ lat: 51.3301, lon: a.lon + 0.01 })
    expect(groundDistanceM(a, { lat: b.lat, lon: a.lon })).toBeCloseTo(667, -1)
    expect(groundDistanceM(a, c)).toBeCloseTo(667, -1)
  })
})
