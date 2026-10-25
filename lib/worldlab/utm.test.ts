import { describe, expect, it } from 'vitest'
import { fromUtm, fromUtm32, toUtm, toUtm32 } from './utm'

// Vergleichswerte aus pyproj (EPSG:4326 → EPSG:25832)
describe('utm32', () => {
  it('matches reference values', () => {
    const sundern = toUtm32(51.3255, 8.0045)
    expect(sundern.e).toBeCloseTo(430636.82, 1)
    expect(sundern.n).toBeCloseTo(5686493.19, 1)
    const meridian = toUtm32(51.0, 9.0)
    expect(meridian.e).toBeCloseTo(500000, 3)
    expect(meridian.n).toBeCloseTo(5649824.89, 1)
    const west = toUtm32(50.5, 6.0)
    expect(west.e).toBeCloseTo(287255.30, 1)
    expect(west.n).toBeCloseTo(5598524.85, 1)
  })
  it('round-trips', () => {
    const back = fromUtm32(430636.8164633432, 5686493.194678527)
    expect(back.lat).toBeCloseTo(51.3255, 7)
    expect(back.lon).toBeCloseTo(8.0045, 7)
  })
})

// Vergleichswerte aus pyproj (EPSG:4326 → EPSG:25833)
describe('utm33', () => {
  it('matches reference values', () => {
    const rostock = toUtm(54.0887, 12.1405, 33)
    expect(rostock.e).toBeCloseTo(312983.96, 1)
    expect(rostock.n).toBeCloseTo(5997171.61, 1)
    const berlin = toUtm(52.52, 13.405, 33)
    expect(berlin.e).toBeCloseTo(391779.26, 1)
    expect(berlin.n).toBeCloseTo(5820072.16, 1)
  })
  it('round-trips', () => {
    const back = fromUtm(391779.2592516289, 5820072.159087078, 33)
    expect(back.lat).toBeCloseTo(52.52, 7)
    expect(back.lon).toBeCloseTo(13.405, 7)
  })
})
