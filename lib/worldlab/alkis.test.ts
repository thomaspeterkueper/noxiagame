import { describe, expect, it } from 'vitest'
import { CADASTRE_SERVICES, cadastreAttribution, cadastreServicesAt, parcelCell, parcelLabel, parcelNotForSale, parcelRequestUrl, parcelUsage, parseParcels, landRate } from './alkis'
import { toUtm, toUtm32 } from './utm'

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

// Echter Ausschnitt aus WFS NW ALKIS Vereinfacht (25.10.2026, Sundern, Elsternhagen 26)
const real = `<?xml version="1.0" encoding="utf-8"?>
<wfs:FeatureCollection numberReturned="1" xmlns="http://repository.gdi-de.org/schemas/adv/produkt/alkis-vereinfacht/2.0" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:wfs="http://www.opengis.net/wfs/2.0">
<wfs:member>
<Flurstueck gml:id="DENW07AL0000WdVkFL">
<gml:identifier codeSpace="urn:adv:oid:">urn:adv:oid:DENW07AL0000WdVkFL</gml:identifier>
<idflurst>DENW07AL0000WdVk</idflurst>
<flstkennz>05102800200355______</flstkennz>
<gemarkung>Sundern</gemarkung>
<flur>002</flur>
<flstnrzae>355</flstnrzae>
<gemeinde>Sundern (Sauerl.)</gemeinde>
<geometrie>
<gml:MultiSurface gml:id="flurstueck.id.94407765.geometrie.Geom_0" srsName="urn:ogc:def:crs:EPSG::25832" srsDimension="2">
<gml:surfaceMember>
<gml:Polygon gml:id="flurstueck.id.94407765.geometrie.Geom_1">
<gml:exterior>
<gml:LinearRing>
<gml:posList>430490.392 5688425.487 430493.383 5688421.741 430506.31 5688405.497 430507.997 5688403.445 430523.755 5688415.748 430500.911 5688444.319 430498.943 5688442.229 430494.753 5688435.094 430490.392 5688425.487</gml:posList>
</gml:LinearRing>
</gml:exterior>
</gml:Polygon>
</gml:surfaceMember>
</gml:MultiSurface>
</geometrie>
<flaeche>660.0</flaeche>
<lagebeztxt>Elsternhagen 26</lagebeztxt>
<tntxt>Wohnbaufläche;660</tntxt>
</Flurstueck>
</wfs:member>
</wfs:FeatureCollection>`

describe('alkis', () => {
  it('reads a real answer of the NRW service', () => {
    const [p] = parseParcels(real)
    expect(p.id).toBe('05102800200355______')
    expect(p.ring).toHaveLength(8)
    expect(p.ring[0].lat).toBeCloseTo(51.3405, 2)
    expect(p.ring[0].lon).toBeCloseTo(8.0, 2)
    expect(p.props.lagebeztxt).toBe('Elsternhagen 26')
    expect(parcelLabel(p.props)).toBe('Gemarkung Sundern, Flur 2, Flurstück 355')
    expect(parcelUsage(p.props)).toBe('Wohnbaufläche')
  })

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

  it('picks the Land services, both at borders', () => {
    expect(cadastreServicesAt({ lat: 51.3255, lon: 8.0045 }).map(item => item.key)).toEqual(['nw'])
    expect(cadastreServicesAt({ lat: 52.52, lon: 13.405 }).map(item => item.key)).toContain('bb')
    expect(cadastreServicesAt({ lat: 51.0, lon: 9.2 }).map(item => item.key)).toEqual(['nw', 'he'])
    expect(cadastreServicesAt({ lat: 48.14, lon: 11.58 })).toEqual([]) // Bayern: kein offener Dienst
    expect(cadastreAttribution('alkis_bb')).toContain('GeoBasis-DE/LGB')
  })
  it('asks Mecklenburg-Vorpommern in UTM 33 and reads it back', () => {
    const mv = CADASTRE_SERVICES.find(item => item.key === 'mv')!
    const url = parcelRequestUrl(parcelCell({ lat: 54.0887, lon: 12.1405 }), 0, 1000, mv)
    expect(url).toContain('EPSG%3A%3A25833')
    expect(url.startsWith(mv.url)).toBe(true)
    const pos = [[54.0887, 12.1405], [54.0887, 12.141], [54.0891, 12.141], [54.0887, 12.1405]].map(([lat, lon]) => { const u = toUtm(lat, lon, 33); return `${u.e} ${u.n}` }).join(' ')
    const gml = `<Flurstueck gml:id="X"><flstkennz>130001</flstkennz><flur>1</flur><exterior><LinearRing><posList>${pos}</posList></LinearRing></exterior></Flurstueck>`
    const [parcel] = parseParcels(gml, 33)
    expect(parcel.ring[0].lat).toBeCloseTo(54.0887, 6)
    expect(parcel.ring[0].lon).toBeCloseTo(12.1405, 6)
  })
  it('reads other Länder spellings', () => {
    expect(parcelLabel({ gemarkung: 'Mainz', flur: 'Flur 17', flstnrzae: '54', flstnrnen: '10' })).toBe('Gemarkung Mainz, Flur 17, Flurstück 54/10')
    expect(parcelNotForSale('Flaeche Besonderer Funktionaler Praegung/Regierung und Verwaltung')).toBeTruthy()
    expect(parcelNotForSale('Strassenverkehr')).toBeTruthy()
  })
})
