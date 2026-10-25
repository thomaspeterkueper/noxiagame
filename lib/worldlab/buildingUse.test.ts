import { describe, expect, it } from 'vitest'
import { buildingSizeLine, buildingUseCode, buildingUseLine, conversionLine, readyAtLabel, venueKindLabel, venueOfferLine } from './buildingUse'

describe('world lab: present use of real buildings (W-4)', () => {
  it('reads the use from the building tags, the whole-house use first', () => {
    expect(buildingUseCode({ building: 'yes', amenity: 'bar' })).toBe('a:bar')
    expect(buildingUseCode({ building: 'retail', shop: 'bakery' })).toBe('s:bakery')
    expect(buildingUseCode({ building: 'hotel', tourism: 'hotel' })).toBe('t:hotel')
    expect(buildingUseCode({ building: 'apartments' })).toBe('b:apartments')
    expect(buildingUseCode({ visual_class: 'house' })).toBe('b:house')
    expect(buildingUseCode({ building: 'yes' })).toBeUndefined()
    expect(buildingUseCode({ building: 'yes', shop: 'yes' })).toBeUndefined()
  })

  it('names the use for the panel: building tag, shop inside, or only the shape', () => {
    expect(buildingUseLine({ code: 'a:bar', name: 'Metropol', kind: 'house' }).text).toBe('Bar „Metropol“')
    expect(buildingUseLine({ code: 's:bakery', kind: 'house' }).text).toBe('Bäckerei')
    expect(buildingUseLine({ code: 'b:apartments', kind: 'row' }).text).toBe('Mehrfamilienhaus')
    // Laden als OSM-Punkt im Haus geht vor building=*
    expect(buildingUseLine({ code: 'b:house', kind: 'house', poi: { name: 'Balkan Grill', label: 'Restaurant' } }).text).toBe('Restaurant „Balkan Grill“')
    const unknown = buildingUseLine({ kind: 'house' })
    expect(unknown.known).toBe(false)
    expect(unknown.text).toContain('Wohnhaus')
  })

  it('writes the size line', () => {
    expect(buildingSizeLine(118.6, 2)).toBe('119 m² Grundfläche · 2 Geschosse')
    expect(buildingSizeLine(1240, 1)).toBe('1.240 m² Grundfläche · 1 Geschoss')
  })
})

describe('world lab: venue conversion and purchase lines (W-5)', () => {
  it('lists a venue conversion with build time and places', () => {
    expect(conversionLine({ name: 'Bar', cost: 1800, buildTicks: 2, note: '2 Personal · 3 Wohnplätze' })).toBe('Bar · 1.800 Cr · Bauzeit 2 Std. · 2 Personal · 3 Wohnplätze')
    expect(conversionLine({ name: 'Bank', cost: 600, buildTicks: 0 })).toBe('Bank · 600 Cr · sofort')
  })

  it('says when a conversion is ready', () => {
    const now = new Date(2026, 9, 25, 20, 0)
    expect(readyAtLabel(new Date(2026, 9, 25, 21, 40).toISOString(), now)).toBe('fertig um 21:40')
    expect(readyAtLabel(new Date(2026, 9, 26, 9, 10).toISOString(), now)).toBe('fertig am 26.10. um 09:10')
    expect(readyAtLabel(new Date(2026, 9, 25, 19, 0).toISOString(), now)).toBe('gleich fertig')
    expect(readyAtLabel(null, now)).toBeNull()
  })

  it('names a real venue for sale with its fit-out', () => {
    expect(venueOfferLine('bar', 1800)).toBe('Bar, schon ausgebaut (+1.800 Cr)')
    expect(venueOfferLine('hotel', 0)).toBe('Hotel, schon ausgebaut')
    expect(venueOfferLine(null, 1800)).toBeNull()
    expect(venueKindLabel('cafe')).toBe('Café')
  })
})
