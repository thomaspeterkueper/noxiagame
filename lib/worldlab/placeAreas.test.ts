import { describe, expect, it } from 'vitest'
import { cemeteryQuery, cemeteryRows, parseOsmCemeteries } from './placeAreas.server'
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

describe('OSM-API als Ersatz', () => {
  it('liest Friedhofswege aus dem Kartenausschnitt', () => {
    const xml = `<osm><node id="1" lat="51.32" lon="7.99"/><node id="2" lat="51.321" lon="7.99"/><node id="3" lat="51.321" lon="7.992"/>
      <way id="9"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="1"/><tag k="landuse" v="cemetery"/><tag k="name" v="Alter Friedhof"/></way>
      <way id="10"><nd ref="1"/><nd ref="2"/><tag k="highway" v="residential"/></way></osm>`
    const ways = parseOsmCemeteries(xml)
    expect(ways).toHaveLength(1)
    expect(cemeteryRows(ways)[0].properties).toMatchObject({ name: 'Alter Friedhof', noxia_source_id: 'osm:way:9' })
  })
})
