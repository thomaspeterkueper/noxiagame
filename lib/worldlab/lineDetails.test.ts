import { describe, expect, it } from 'vitest'
import { lineDetailQuery, lineDetailRows, parseOsmMap } from './lineDetails.server'

describe('line details', () => {
  it('asks for main roads, roundabouts and tracks', () => {
    const q = lineDetailQuery({ south: 51.33, west: 8.0, north: 51.334, east: 8.006 })
    expect(q).toContain('secondary|tertiary')
    expect(q).toContain('roundabout')
    expect(q).toContain('railway')
  })
  it('keeps full geometry and a few tags', () => {
    const rows = lineDetailRows([
      { type: 'way', id: 7, tags: { railway: 'rail', service: 'siding', operator: 'RLG' }, geometry: [{ lat: 51.33, lon: 8.0 }, { lat: 51.331, lon: 8.001 }, { lat: 51.332, lon: 8.0015 }, null] },
      { type: 'way', id: 8, tags: { highway: 'tertiary', junction: 'roundabout' }, geometry: [{ lat: 51.33, lon: 8.0 }] },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: 'osm:way:7', kind: 'rail', props: { railway: 'rail', service: 'siding' } })
    expect(rows[0].coords).toHaveLength(3)
  })
  it('reads the OSM API map extract', () => {
    const xml = `<osm><node id="1" visible="true" lat="51.33" lon="8.0"/><node id="2" lat="51.331" lon="8.001"/><node id="3" lat="51.332" lon="8.002"/>
      <way id="10"><nd ref="1"/><nd ref="2"/><nd ref="3"/><tag k="railway" v="rail"/><tag k="service" v="siding"/></way>
      <way id="11"><nd ref="1"/><nd ref="2"/><tag k="building" v="yes"/></way>
      <way id="12"><nd ref="2"/><nd ref="3"/><tag k="highway" v="residential"/><tag k="junction" v="roundabout"/></way></osm>`
    const ways = parseOsmMap(xml)
    expect(ways.map(w => w.id)).toEqual([10, 12])
    expect(lineDetailRows(ways)[0].coords).toHaveLength(3)
  })
})
