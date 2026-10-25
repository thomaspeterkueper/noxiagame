import { describe, expect, it } from 'vitest'
import { parcelCell, parcelLabel, parcelNotForSale, parcelRequestUrl, parcelUsage, parseParcels, landRate } from './alkis'
import { toUtm32 } from './utm'

function ringPosList(points: Array<[number, number]>) {
  return points.map(([lat, lon]) => { const u = toUtm32(lat, lon); return `${u.e.toFixed(3)} ${u.n.toFixed(3)}` }).join(' ')
}

const square: Array<[number, number]> = [[51.33, 8.0], [51.33, 8.0004], [51.3303, 8.0004], [51.3303, 8.0], [51.33, 8.0]]
const sample = `<?xml version="1.0"?><wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:ave="x">
<wfs:member><ave:Flurstueck gml:id="DENW36AL1000CHu9FL">
  <ave:geometrie><gml:MultiSurface srsName="urn:ogc:def:crs:EPSG::25832"><gml:surfaceMember><gml:Polygon><gml:exterior><gml:LinearRing>
    <gml:posList srsDimension="2">${ringPosList(square)}</gml:posList></gml:LinearRing></gml:exterior>
    <gml:interior><gml:LinearRing><gml:posList>1 2 3 4 5 6 1 2</gml:posList></gml:LinearRing></gml:interior></gml:Polygon></gml:surfaceMember></gml:MultiSurface></ave:geometrie>
  <ave:flstkennz>053456012003450006__</ave:flstkennz><ave:gemarkung>Sundern</ave:gemarkung><ave:flur>12</ave:flur>
  <ave:flstnrzae>345</ave:flstnrzae><ave:flstnrnen>6</ave:flstnrnen><ave:flaeche>612</ave:flaeche>
  <ave:lagebeztxt>Bogenstraße 15</ave:lagebeztxt><ave:tntxt>Wohnbaufläche;590|Straßenverkehr;22</ave:tntxt>
</ave:Flurstueck></wfs:member>
<wfs:member><Flurstueck gml:id="B"><exterior><LinearRing><pos>${ringPosList([[51.33, 8.001]])}</pos><pos>${ringPosList([[51.33, 8.0012]])}</pos><pos>${ringPosList([[51.3302, 8.0012]])}</pos><pos>${ringPosList([[51.33, 8.001]])}</pos></LinearRing></exterior></Flurstueck></wfs:member>
</wfs:FeatureCollection>`

describe('alkis', () => {
  it('reads parcels from GML (posList and single pos, with and without prefix)', () => {
    const parcels = parseParcels(sample)
    expect(parcels).toHaveLength(2)
    const [a, b] = parcels
    expect(a.id).toBe('053456012003450006__')
    expect(a.ring).toHaveLength(4)
    expect(a.ring[0].lat).toBeCloseTo(51.33, 6)
    expect(a.ring[1].lon).toBeCloseTo(8.0004, 6)
    expect(a.props.lagebeztxt).toBe('Bogenstraße 15')
    expect(parcelLabel(a.props)).toBe('Gemarkung Sundern, Flur 12, Flurstück 345/6')
    expect(parcelUsage(a.props)).toBe('Wohnbaufläche')
    expect(b.id).toBe('B')
    expect(b.ring).toHaveLength(3)
  })
  it('knows what is not for sale and land rates', () => {
    expect(parcelNotForSale('Straßenverkehr')).toBeTruthy()
    expect(parcelNotForSale('Fließgewässer')).toBeTruthy()
    expect(parcelNotForSale('Wohnbaufläche')).toBeNull()
    expect(landRate('Wohnbaufläche')).toBeGreaterThan(landRate('Wald'))
  })
  it('builds cells and requests', () => {
    const cell = parcelCell({ lat: 51.3305, lon: 8.0021 })
    expect(cell.south).toBeLessThanOrEqual(51.3305)
    expect(cell.north).toBeGreaterThan(51.3305)
    const url = parcelRequestUrl(cell)
    expect(url).toContain('TYPENAMES=ave%3AFlurstueck')
    expect(url).toContain('BBOX=4')
  })
})
