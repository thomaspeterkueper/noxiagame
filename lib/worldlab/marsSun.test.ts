import { describe, expect, it } from 'vitest'
import { marsSun, SOL_SECONDS } from './marsSun'

const THARSIS = { lat: 14, lon: -102 }

describe('Sonnenstand auf dem Mars', () => {
  it('trifft Ls für einen bekannten Zeitpunkt (Mars24: 2000-01-06 00:00 UTC, Ls ≈ 277,2°)', () => {
    const s = marsSun(0, 0, Date.UTC(2000, 0, 6))
    expect(s.ls).toBeGreaterThan(276.5)
    expect(s.ls).toBeLessThan(278)
  })
  it('wiederholt sich nach einem Sol, nicht nach einem Erdtag', () => {
    const t = Date.UTC(2026, 10, 6, 6, 0)
    const a = marsSun(THARSIS.lat, THARSIS.lon, t).elevation
    const sol = marsSun(THARSIS.lat, THARSIS.lon, t + SOL_SECONDS * 1000).elevation
    const day = marsSun(THARSIS.lat, THARSIS.lon, t + 86_400_000).elevation
    expect(Math.abs(sol - a)).toBeLessThan(1)
    expect(Math.abs(day - a)).toBeGreaterThan(3)
  })
  it('steht am Ortsmittag am höchsten', () => {
    const t = Date.UTC(2026, 10, 6, 6, 0)
    let best = { el: -99, hours: 0 }
    for (let i = 0; i < 200; i++) {
      const s = marsSun(THARSIS.lat, THARSIS.lon, t + i * SOL_SECONDS * 5)
      if (s.elevation > best.el) best = { el: s.elevation, hours: s.localSolarHours }
    }
    expect(Math.abs(best.hours - 12)).toBeLessThan(0.3)
    const noonEl = 90 - Math.abs(THARSIS.lat - marsSun(THARSIS.lat, THARSIS.lon, t).declination)
    expect(Math.abs(best.el - noonEl)).toBeLessThan(1.5)
  })
  it('bleibt in den Grenzen', () => {
    for (let i = 0; i < 50; i++) {
      const s = marsSun(-60 + i * 2.4, i * 7, Date.UTC(2026, 0, 1) + i * 3_600_000 * 7)
      expect(s.elevation).toBeGreaterThanOrEqual(-90)
      expect(s.elevation).toBeLessThanOrEqual(90)
      expect(s.declination).toBeLessThan(25.5)
      expect(s.declination).toBeGreaterThan(-25.5)
    }
  })
})
