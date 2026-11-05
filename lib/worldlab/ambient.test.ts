import { describe, expect, it } from 'vitest'
import { dayTint, daylight, hasChimney, hasSolar, heatingSeason, seeded, sunElevationDeg, windowLit } from './ambient'

const SUNDERN = { lat: 51.326, lon: 8.0 }

describe('ambient', () => {
  it('Sonnenhöhe in Sundern stimmt grob', () => {
    // 21.06.2026, 11:30 UTC (13:30 MESZ): Mittagssonne rund 62°
    expect(sunElevationDeg(SUNDERN.lat, SUNDERN.lon, Date.UTC(2026, 5, 21, 11, 30))).toBeGreaterThan(58)
    // 05.11.2026, 11:30 UTC: rund 22°
    const nov = sunElevationDeg(SUNDERN.lat, SUNDERN.lon, Date.UTC(2026, 10, 5, 11, 30))
    expect(nov).toBeGreaterThan(18); expect(nov).toBeLessThan(26)
    // Mitternacht: tief unter dem Horizont
    expect(sunElevationDeg(SUNDERN.lat, SUNDERN.lon, Date.UTC(2026, 10, 5, 23, 0))).toBeLessThan(-30)
  })

  it('Tönung: Tag weiß, Nacht gedämpft, nie schwarz', () => {
    expect(dayTint(30)).toBe(0xffffff)
    expect(daylight(-20)).toBe(0)
    const night = dayTint(-20)
    expect(night).not.toBe(0xffffff)
    expect((night >> 16) & 255).toBeGreaterThan(0x80)
  })

  it('Fenster: mittags dunkel, abends meist hell, spät nur wenige', () => {
    const noon = Date.UTC(2026, 10, 5, 11, 30), evening = Date.UTC(2026, 10, 5, 18, 0), late = Date.UTC(2026, 10, 5, 2, 0)
    const keys = Array.from({ length: 400 }, (_, i) => 'b' + i)
    const lit = (t: number) => keys.filter(k => windowLit(sunElevationDeg(SUNDERN.lat, SUNDERN.lon, t), SUNDERN.lon, t, k)).length
    expect(lit(noon)).toBe(0)
    expect(lit(evening)).toBeGreaterThan(200)
    expect(lit(late)).toBeLessThan(60)
  })

  it('Solaranlagen auf etwa jedem dritten Haus, Rauch selten', () => {
    const keys = Array.from({ length: 1000 }, (_, i) => 'osm:way:' + (1000 + i * 7))
    const solar = keys.filter(k => hasSolar('house', k, 120)).length
    expect(solar).toBeGreaterThan(250); expect(solar).toBeLessThan(420)
    expect(keys.filter(k => hasSolar('church', k, 400)).length).toBe(0)
    expect(keys.filter(k => hasChimney('house', k)).length).toBeLessThan(100)
    expect(seeded('x')).toBe(seeded('x'))
  })

  it('Heizzeit', () => {
    expect(heatingSeason(51, Date.UTC(2026, 10, 5))).toBe(true)
    expect(heatingSeason(51, Date.UTC(2026, 6, 5))).toBe(false)
    expect(heatingSeason(-38, Date.UTC(2026, 6, 5))).toBe(true)
    expect(heatingSeason(23, Date.UTC(2026, 0, 5))).toBe(false)
  })
})
