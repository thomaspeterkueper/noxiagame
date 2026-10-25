import { describe, expect, it } from 'vitest'
import { isConversionOnlyOnEarth, realVenueKind, venueConversionBlocker, venuePlan, VENUE_USAGES } from './venueConversion'

describe('venueConversion', () => {
  it('costs and build times match the former new-build prices', () => {
    expect([VENUE_USAGES.cafe.cost, VENUE_USAGES.bar.cost, VENUE_USAGES.restaurant.cost, VENUE_USAGES.hotel.cost]).toEqual([900, 1800, 2400, 3600])
    expect([VENUE_USAGES.cafe.buildTicks, VENUE_USAGES.bar.buildTicks, VENUE_USAGES.restaurant.buildTicks, VENUE_USAGES.hotel.buildTicks]).toEqual([1, 2, 2, 3])
  })

  it('upper floors become flats, the ground floor is the venue', () => {
    // Hauptstraße 72 in Sundern: 139 m², zwei Geschosse
    const plan = venuePlan('cafe', { areaM2: 139, levels: 2 })
    expect(plan.staffCapacity).toBe(2)
    expect(plan.residentialCapacity).toBe(3)
    expect(plan.transientCapacity).toBe(0)
    expect(venuePlan('bar', { areaM2: 80, levels: 1 }).residentialCapacity).toBe(0)
  })

  it('residents keep their place', () => {
    expect(venuePlan('cafe', { areaM2: 60, levels: 1, residents: 2 }).residentialCapacity).toBe(2)
    expect(venuePlan('hotel', { areaM2: 200, levels: 3, residents: 1 }).residentialCapacity).toBe(1)
  })

  it('hotel rooms come from the upper floors', () => {
    expect(venuePlan('hotel', { areaM2: 200, levels: 3 }).transientCapacity).toBe(16)
    expect(venuePlan('hotel', { areaM2: 100, levels: 1 }).transientCapacity).toBe(2)
    expect(venuePlan('hotel', { areaM2: 2000, levels: 6 }).transientCapacity).toBe(30)
  })

  it('staff grows with the house', () => {
    expect(venuePlan('restaurant', { areaM2: 90, levels: 1 }).staffCapacity).toBe(2)
    expect(venuePlan('restaurant', { areaM2: 300, levels: 1 }).staffCapacity).toBe(4)
  })

  it('a real venue needs no conversion to its own kind', () => {
    expect(realVenueKind({ amenity: 'bar', name: 'Metropol' })).toBe('bar')
    expect(venueConversionBlocker('restaurant', { areaM2: 150, tags: { amenity: 'restaurant' }, currentUsage: 'restaurant' })).toMatch(/schon/)
    expect(venueConversionBlocker('cafe', { areaM2: 150, tags: { amenity: 'restaurant' }, currentUsage: 'restaurant' })).toBeNull()
    expect(venueConversionBlocker('restaurant', { areaM2: 50, tags: { building: 'house' } })).toMatch(/Zu klein/)
    expect(venueConversionBlocker('cafe', { areaM2: 139, tags: { building: 'commercial' }, currentUsage: 'acquired_building' })).toBeNull()
    expect(venueConversionBlocker('cafe', { areaM2: 139, tags: {}, currentUsage: 'cafe' })).toMatch(/schon/)
  })

  it('venues are not newly built on Earth', () => {
    expect(isConversionOnlyOnEarth('cafe')).toBe(true)
    expect(isConversionOnlyOnEarth('hotel')).toBe(true)
    expect(isConversionOnlyOnEarth('factory')).toBe(false)
  })
})
