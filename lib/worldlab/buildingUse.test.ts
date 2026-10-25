import { describe, expect, it } from 'vitest'
import { buildingSizeLine, buildingUseCode, buildingUseLine } from './buildingUse'

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
