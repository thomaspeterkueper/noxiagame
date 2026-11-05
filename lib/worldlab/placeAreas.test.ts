import { describe, expect, it } from 'vitest'
import { cemeteryQuery, cemeteryRows } from './placeAreas.server'
import { knownPlaceName } from './placeNames'

describe('Friedhöfe nachholen', () => {
  it('fragt Friedhof und Begräbnisplatz ab', () => {
    const q = cemeteryQuery({ south: 51.32, west: 7.99, north: 51.324, east: 7.996 })
    expect(q).toContain('landuse=cemetery')
    expect(q).toContain('amenity=grave_yard')
  })
  it('macht aus einem Weg eine Fläche mit Name und Kennung', () => {
    const ring = [{ lat: 51.321, lon: 7.997 }, { lat: 51.322, lon: 7.997 }, { lat: 51.322, lon: 7.999 }, { lat: 51.321, lon: 7.997 }]
    const [row] = cemeteryRows([{ type: 'way', id: 42, tags: { landuse: 'cemetery', name: 'Neuer Friedhof' }, geometry: ring }])
    expect(row.feature_type).toBe('place_area')
    expect(row.properties).toMatchObject({ visual_class: 'cemetery', name: 'Neuer Friedhof', noxia_source_id: 'osm:way:42' })
    expect(cemeteryRows([{ type: 'way', id: 1, tags: {}, geometry: ring.slice(0, 2) }])).toHaveLength(0)
  })
  it('kennt den Namen der Auferstehungskapelle', () => expect(knownPlaceName('osm:way:246550928')).toBe('Auferstehungskapelle'))
})
