import { describe, expect, it } from 'vitest'
import { distanceKm, earthTripOffers, regionName, tripMode, tripPrice, tripSeconds } from './earthTrips'

const sundern = { lat: 51.3256, lon: 8.0042 }
const destinations = [
  { slug: 'ffm', ...regionName('Frankfurt am Main, Hessen, Deutschland'), at: { lat: 50.1106, lon: 8.6821 } },
  { slug: 'sauerland', ...regionName('Earth · Deutschland · Sauerland'), at: { lat: 51.325, lon: 8.005 } },
  { slug: 'datong', ...regionName('Datong, Shanxi, China'), at: { lat: 40.0923, lon: 113.2953 } },
  { slug: 'langen', ...regionName('Langen, Landkreis Offenbach, Hessen, 63225, Deutschland'), at: { lat: 49.9915, lon: 8.6667 } },
  { slug: 'sundern', ...regionName('Sundern, Hochsauerlandkreis, Nordrhein-Westfalen, 59846, Deutschland'), at: { lat: 51.3298, lon: 8.0073 } },
  { slug: 'menden', ...regionName('Menden (Sauerland), Märkischer Kreis, Nordrhein-Westfalen, Deutschland'), at: { lat: 51.4378, lon: 7.7954 } },
]

describe('trips on Earth from the travel agency', () => {
  it('names places from region labels', () => {
    expect(regionName('Frankfurt am Main, Hessen, Deutschland')).toEqual({ name: 'Frankfurt am Main', country: 'Deutschland' })
    expect(regionName('Earth · Deutschland · Sauerland')).toEqual({ name: 'Sauerland', country: 'Deutschland' })
    expect(regionName('Namibia · Erongo')).toEqual({ name: 'Erongo', country: 'Namibia' })
  })

  it('offers rail nearby and flights far away, never the place you are in', () => {
    const offers = earthTripOffers(sundern, destinations)
    expect(offers.map(offer => offer.slug)).toEqual(['menden', 'ffm', 'langen', 'datong'])
    expect(offers[1].mode).toBe('rail')
    expect(offers[3].mode).toBe('air')
    expect(Math.round(distanceKm(sundern, destinations[0].at))).toBeGreaterThan(140)
  })

  it('prices and times trips by distance, capped at five minutes', () => {
    expect(tripMode(170)).toBe('rail')
    expect(tripPrice(170)).toBe(34)
    expect(tripPrice(7600)).toBe(364)
    expect(tripSeconds(170)).toBe(115)
    expect(tripSeconds(7600)).toBe(300)
    expect(tripSeconds(1)).toBe(31) // eine halbe Stunde Spielzeit fürs Ein- und Aussteigen
  })
})
