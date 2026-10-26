import { describe, expect, it } from 'vitest'
import { establishmentFor, establishmentKind, establishmentName, isPersonalPractice } from './establishments'

describe('establishments from real places', () => {
  it('maps OSM tags to a fitting function', () => {
    expect(establishmentKind({ shop: 'car' })).toBe('autohaus')
    expect(establishmentKind({ shop: 'car_repair' })).toBe('werkstatt')
    expect(establishmentKind({ shop: 'pet' })).toBe('tierbedarf')
    expect(establishmentKind({ amenity: 'veterinary', name: 'Tierarztpraxis Dr. Müller' })).toBe('tierarzt')
    expect(establishmentKind({ building: 'industrial', name: 'Becker-Jostes' })).toBe('industrie')
    expect(establishmentKind({ amenity: 'cafe' })).toBeNull()
  })

  it('never turns a personal practice into a business', () => {
    expect(isPersonalPractice({ amenity: 'doctors', name: 'Praxis Dr. Schmidt' })).toBe(true)
    expect(isPersonalPractice({ office: 'lawyer', name: 'Kanzlei Meier' })).toBe(true)
    expect(establishmentFor({ office: 'lawyer', name: 'Kanzlei Meier' }, 'osm:node:1')).toBeNull()
  })

  it('invents a stable name that never contains the real one', () => {
    const tags = { building: 'industrial', name: 'Becker-Jostes', 'addr:street': 'Hauptstraße' }
    const a = establishmentFor(tags, 'osm:way:42')!
    const b = establishmentFor(tags, 'osm:way:42')!
    expect(a.name).toBe(b.name)
    expect(a.name.toLowerCase()).not.toContain('becker')
    expect(a.realName).toBe('Becker-Jostes')
    expect(a.room).toBe('workshop')
    expect(establishmentName('baeckerei', { 'addr:street': 'Kirchplatz' }, 'x')).toMatch(/Kirch|Röhrtal|Sorpe|Sauerland|Hochsauerland|Bergland|Talgrund|Waldrand/)
  })
})
