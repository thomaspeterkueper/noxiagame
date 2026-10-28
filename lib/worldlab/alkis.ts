// lib/worldlab/alkis.ts
// Flurstücke aus den amtlichen Liegenschaftskatastern der Länder (ALKIS,
// vereinfachtes Schema der AdV, „WFS … ALKIS Vereinfacht“).
// Thomas, 25.10.2026: Kaufen und Bauen richten sich nach Flurstücken, nicht nach Häusern.
//
// Die Dienste liefern GML 3.2 in UTM 32 (EPSG:25832), Mecklenburg-Vorpommern nur
// in UTM 33 (EPSG:25833). Der Leser hier ist bewusst nachsichtig: Namensraum-Präfix
// egal, posList oder einzelne pos, mehrteilige Flächen (größter Teil zählt).
// Alle Dienste am 25.10.2026 aus Vercel abgefragt (Antwort mit Flurstücken).

import { fromUtm, toUtm } from './utm'

export type GeoPoint = { lat: number; lon: number }

export interface Parcel {
  id: string
  ring: GeoPoint[]
  props: Record<string, string>
}

export interface CadastreService {
  key: string
  land: string
  url: string
  /** UTM-Zone für Abfrage und Antwort */
  zone: 32 | 33
  /** grobes Gebiet des Landes (ein oder mehrere Rechtecke) – an den Grenzen fragen wir beide Länder */
  boxes: ReadonlyArray<{ south: number; north: number; west: number; east: number }>
  /** Quellenvermerk laut Lizenz */
  attribution: string
  /** Dienst bietet ave:NutzungFlurstueck (Nutzungsart und Bezeichnung je Flurstück, z. B. Wald/Nadelholz, Landwirtschaft/Grünland) */
  usageLayer?: boolean
}

export const CADASTRE_SERVICES: readonly CadastreService[] = [
  { key: 'nw', land: 'Nordrhein-Westfalen', url: 'https://www.wfs.nrw.de/geobasis/wfs_nw_alkis_vereinfacht', zone: 32,
    boxes: [{ south: 50.3, north: 52.55, west: 5.85, east: 9.47 }], attribution: 'ALKIS NRW, dl-de/zero-2-0', usageLayer: true },
  { key: 'he', land: 'Hessen', url: 'https://www.gds.hessen.de/wfs2/aaa-suite/cgi-bin/alkis/vereinf/wfs', zone: 32,
    boxes: [{ south: 49.39, north: 50.6, west: 7.77, east: 10.24 }, { south: 50.6, north: 51.66, west: 8.1, east: 10.24 }], attribution: '© HVBG, Geobasisdaten Hessen', usageLayer: true },
  { key: 'rp', land: 'Rheinland-Pfalz', url: 'https://geo5.service24.rlp.de/wfs/alkis_rp.fcgi', zone: 32,
    boxes: [{ south: 48.96, north: 50.95, west: 6.11, east: 8.51 }], attribution: '© GeoBasis-DE / LVermGeoRP, dl-de/by-2-0' },
  { key: 'hh', land: 'Hamburg', url: 'https://geodienste.hamburg.de/WFS_HH_ALKIS_vereinfacht', zone: 32,
    boxes: [{ south: 53.39, north: 53.97, west: 8.42, east: 10.33 }], attribution: 'Freie und Hansestadt Hamburg, LGV, dl-de/by-2-0' },
  { key: 'st', land: 'Sachsen-Anhalt', url: 'https://www.geodatenportal.sachsen-anhalt.de/wss/service/ST_LVermGeo_ALKIS_WFS_OpenData/guest', zone: 32,
    boxes: [{ south: 50.93, north: 53.05, west: 10.56, east: 13.19 }], attribution: '© GeoBasis-DE / LVermGeo ST, dl-de/by-2-0' },
  { key: 'sn', land: 'Sachsen', url: 'https://geodienste.sachsen.de/aaa/public_alkis/vereinf/wfs', zone: 32,
    boxes: [{ south: 50.17, north: 51.69, west: 11.87, east: 15.04 }], attribution: 'GeoSN, dl-de/by-2-0', usageLayer: true },
  { key: 'bb', land: 'Brandenburg', url: 'https://isk.geobasis-bb.de/ows/alkis_vereinf_wfs', zone: 32,
    boxes: [{ south: 51.36, north: 53.56, west: 11.26, east: 14.77 }], attribution: '© GeoBasis-DE/LGB, dl-de/by-2-0', usageLayer: true },
  { key: 'mv', land: 'Mecklenburg-Vorpommern', url: 'https://www.geodaten-mv.de/dienste/alkis_wfs_einfach', zone: 33,
    boxes: [{ south: 53.11, north: 54.69, west: 10.59, east: 14.42 }], attribution: '© GeoBasis-DE/M-V', usageLayer: true },
]

/** Dienste, deren Land den Punkt (grob) enthält – an Grenzen mehrere. */
export function cadastreServicesAt(p: GeoPoint) {
  return CADASTRE_SERVICES.filter(({ boxes }) => boxes.some(box => p.lat >= box.south && p.lat <= box.north && p.lon >= box.west && p.lon <= box.east))
}
export const hasCadastre = (p: GeoPoint) => cadastreServicesAt(p).length > 0
/** Quelle eines gespeicherten Flurstücks („alkis_nw“ …). */
export const cadastreSource = (service: CadastreService) => `alkis_${service.key}`
export function cadastreAttribution(source: string | null | undefined) {
  const service = CADASTRE_SERVICES.find(item => cadastreSource(item) === source)
  return service ? `ALKIS ${service.land} – ${service.attribution}` : 'Liegenschaftskataster'
}

/** Zelle für den Abruf (rund 450 × 420 m), damit jede Gegend nur einmal geholt wird. */
export const PARCEL_CELL_LAT = 0.004, PARCEL_CELL_LON = 0.006
export function parcelCell(p: GeoPoint) {
  const i = Math.floor(p.lat / PARCEL_CELL_LAT), j = Math.floor(p.lon / PARCEL_CELL_LON)
  return { key: `${i}:${j}`, south: i * PARCEL_CELL_LAT, north: (i + 1) * PARCEL_CELL_LAT, west: j * PARCEL_CELL_LON, east: (j + 1) * PARCEL_CELL_LON }
}

/** GetFeature-Adresse für einen Ausschnitt (Rand in WGS84, Abfrage in der UTM-Zone des Dienstes). */
export function parcelRequestUrl(box: { south: number; north: number; west: number; east: number }, startIndex = 0, count = 1000, service: CadastreService = CADASTRE_SERVICES[0], typeName = 'ave:Flurstueck') {
  const zone = service.zone
  const corners = [toUtm(box.south, box.west, zone), toUtm(box.south, box.east, zone), toUtm(box.north, box.west, zone), toUtm(box.north, box.east, zone)]
  const e1 = Math.floor(Math.min(...corners.map(c => c.e))), e2 = Math.ceil(Math.max(...corners.map(c => c.e)))
  const n1 = Math.floor(Math.min(...corners.map(c => c.n))), n2 = Math.ceil(Math.max(...corners.map(c => c.n)))
  const srs = `urn:ogc:def:crs:EPSG::258${zone}`
  const params = new URLSearchParams({
    SERVICE: 'WFS', VERSION: '2.0.0', REQUEST: 'GetFeature', TYPENAMES: typeName,
    SRSNAME: srs, BBOX: `${e1},${n1},${e2},${n2},${srs}`,
    COUNT: String(count), STARTINDEX: String(startIndex),
  })
  return `${service.url}?${params}`
}

const decode = (text: string) => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').trim()

function ringsOf(xml: string): number[][] {
  const rings: number[][] = []
  // Nur Außenringe (exterior), keine Löcher
  for (const exterior of xml.matchAll(/<(?:\w+:)?exterior\b[^>]*>([\s\S]*?)<\/(?:\w+:)?exterior>/g)) {
    const body = exterior[1]
    const list = body.match(/<(?:\w+:)?posList\b[^>]*>([^<]+)<\/(?:\w+:)?posList>/)
    const values = list ? list[1].trim().split(/\s+/).map(Number)
      : [...body.matchAll(/<(?:\w+:)?pos\b[^>]*>([^<]+)<\/(?:\w+:)?pos>/g)].flatMap(m => m[1].trim().split(/\s+/).map(Number))
    if (values.length >= 6 && values.every(Number.isFinite)) rings.push(values)
  }
  return rings
}

function ringArea(values: number[]) {
  let sum = 0
  for (let i = 0; i + 3 < values.length; i += 2) sum += values[i] * values[i + 3] - values[i + 2] * values[i + 1]
  return Math.abs(sum) / 2
}

/** Flurstücke aus einer GetFeature-Antwort (GML). */
export function parseParcels(gml: string, zone = 32): Parcel[] {
  const out: Parcel[] = []
  for (const match of gml.matchAll(/<((?:\w+:)?Flurstueck)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
    const attrs = match[2], body = match[3]
    const props: Record<string, string> = {}
    for (const leaf of body.matchAll(/<(?:\w+:)?(\w+)(?:\s[^>]*)?>([^<>]{0,600})<\/(?:\w+:)?\1>/g)) {
      const key = leaf[1]
      if (/^(posList|pos|coordinates)$/.test(key)) continue
      if (!(key in props)) props[key] = decode(leaf[2])
    }
    const rings = ringsOf(body)
    if (!rings.length) continue
    const outer = rings.reduce((best, ring) => ringArea(ring) > ringArea(best) ? ring : best)
    const ring: GeoPoint[] = []
    for (let i = 0; i + 1 < outer.length; i += 2) {
      const p = fromUtm(outer[i], outer[i + 1], zone)
      ring.push({ lat: Math.round(p.lat * 1e7) / 1e7, lon: Math.round(p.lon * 1e7) / 1e7 })
    }
    if (ring.length > 3 && ring[0].lat === ring[ring.length - 1].lat && ring[0].lon === ring[ring.length - 1].lon) ring.pop()
    const gmlId = attrs.match(/(?:\w+:)?id="([^"]+)"/)?.[1]
    const id = props.flstkennz || props.idflurst || gmlId || props.oid
    if (!id || ring.length < 3) continue
    out.push({ id: id.slice(0, 64), ring, props })
  }
  return out
}

/** Bezeichnung wie im Grundbuch: „Gemarkung Sundern, Flur 12, Flurstück 345/6“. */
export function parcelLabel(props: Record<string, string>) {
  const number = props.flstnrzae ? props.flstnrzae + (props.flstnrnen ? '/' + props.flstnrnen : '') : ''
  return [props.gemarkung && `Gemarkung ${props.gemarkung}`, props.flur && `Flur ${Number(props.flur) || props.flur.replace(/^flur\s*/i, '')}`, number && `Flurstück ${number}`].filter(Boolean).join(', ') || 'Flurstück'
}

/** Vorherrschende Nutzung aus „tntxt“ (z. B. „Wohnbaufläche;512|Straßenverkehr;12“). */
export function parcelUsage(props: Record<string, string>) {
  const parts = String(props.tntxt ?? props.nutzung ?? '').split('|').map(part => { const [name, area] = part.split(';'); return { name: (name ?? '').trim(), area: Number(area) || 0 } }).filter(part => part.name)
  if (!parts.length) return null
  return parts.sort((a, b) => b.area - a.area)[0].name
}

/** Nutzungen, die die Gemeinde nicht verkauft (öffentliche Flächen, Verkehr, Gewässer). */
export function parcelNotForSale(usage: string | null): string | null {
  if (!usage) return null
  if (/straße|strasse|weg|platz|bahn|verkehr|flug|schiff|hafen/i.test(usage)) return 'Verkehrsfläche'
  if (/gewässer|gewaesser|fluss|see|hafenbecken|meer/i.test(usage)) return 'Gewässer'
  if (/friedhof|besonderer funktionaler (prägung|praegung)|öffentlich|oeffentlich/i.test(usage)) return 'öffentliche Fläche'
  return null
}

/** Bodenwert je m² nach Nutzung (Credits). */
export function landRate(usage: string | null) {
  if (!usage) return 3
  if (/wohnbau|gemischt/i.test(usage)) return 4
  if (/industrie|gewerbe|handel/i.test(usage)) return 3
  if (/landwirtschaft|grünland|ackerland|gartenland/i.test(usage)) return 0.6
  if (/wald|gehölz|heide|moor|unland/i.test(usage)) return 0.4
  if (/sport|freizeit|erholung/i.test(usage)) return 1.5
  return 2
}

/** Nutzungsabschnitt eines Flurstücks (ave:NutzungFlurstueck): Art, Bezeichnung, Fläche (m²). */
export interface ParcelUsePiece { parcel: string; art: string; bez: string | null; m2: number }

/** Nutzungsabschnitte aus einer GetFeature-Antwort (Fläche in m² aus der UTM-Geometrie). */
export function parseUsePieces(gml: string): ParcelUsePiece[] {
  const out: ParcelUsePiece[] = []
  for (const match of gml.matchAll(/<((?:\w+:)?NutzungFlurstueck)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
    const body = match[2]
    const field = (name: string) => { const v = body.match(new RegExp(`<(?:\\w+:)?${name}>([^<]*)<`))?.[1]; return v ? decode(v) : null }
    const parcel = field('flstkennz'), art = field('nutzart')
    if (!parcel || !art) continue
    const m2 = ringsOf(body).reduce((sum, ring) => sum + ringArea(ring), 0)
    out.push({ parcel, art, bez: field('bez'), m2: Math.round(m2) })
  }
  return out
}

/** Nutzungen je Flurstück zusammenfassen, größte zuerst. */
export function usesByParcel(pieces: readonly ParcelUsePiece[]) {
  const map = new Map<string, Map<string, { art: string; bez: string | null; m2: number }>>()
  for (const piece of pieces) {
    const uses = map.get(piece.parcel) ?? new Map()
    const key = piece.art + '|' + (piece.bez ?? '')
    const entry = uses.get(key) ?? { art: piece.art, bez: piece.bez, m2: 0 }
    entry.m2 += piece.m2
    uses.set(key, entry)
    map.set(piece.parcel, uses)
  }
  return new Map([...map].map(([parcel, uses]) => [parcel, [...uses.values()].sort((a, b) => b.m2 - a.m2)]))
}
