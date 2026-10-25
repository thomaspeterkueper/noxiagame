// lib/worldlab/alkis.ts
// Flurstücke aus dem amtlichen Liegenschaftskataster NRW (ALKIS, vereinfachtes
// Schema, WFS NW ALKIS Vereinfacht; Datenlizenz Deutschland – Zero – 2.0).
// Thomas, 25.10.2026: Kaufen und Bauen richten sich nach Flurstücken, nicht nach Häusern.
//
// Der Dienst liefert GML 3.2 in UTM 32 (EPSG:25832). Der Leser hier ist bewusst
// nachsichtig: Namensraum-Präfix egal, posList oder einzelne pos, mehrteilige
// Flächen (größter Teil zählt).

import { fromUtm32, toUtm32 } from './utm'

export const ALKIS_NW_URL = 'https://www.wfs.nrw.de/geobasis/wfs_nw_alkis_vereinfacht'
export type GeoPoint = { lat: number; lon: number }

export interface Parcel {
  id: string
  ring: GeoPoint[]
  props: Record<string, string>
}

/** Ungefähres Gebiet von NRW – nur dort gibt es den Dienst. */
export function inNrw(p: GeoPoint) {
  return p.lat >= 50.3 && p.lat <= 52.55 && p.lon >= 5.85 && p.lon <= 9.47
}

/** Zelle für den Abruf (rund 450 × 420 m), damit jede Gegend nur einmal geholt wird. */
export const PARCEL_CELL_LAT = 0.004, PARCEL_CELL_LON = 0.006
export function parcelCell(p: GeoPoint) {
  const i = Math.floor(p.lat / PARCEL_CELL_LAT), j = Math.floor(p.lon / PARCEL_CELL_LON)
  return { key: `${i}:${j}`, south: i * PARCEL_CELL_LAT, north: (i + 1) * PARCEL_CELL_LAT, west: j * PARCEL_CELL_LON, east: (j + 1) * PARCEL_CELL_LON }
}

/** GetFeature-Adresse für einen Ausschnitt (Rand in WGS84, Abfrage in UTM 32). */
export function parcelRequestUrl(box: { south: number; north: number; west: number; east: number }, startIndex = 0, count = 1000) {
  const corners = [toUtm32(box.south, box.west), toUtm32(box.south, box.east), toUtm32(box.north, box.west), toUtm32(box.north, box.east)]
  const e1 = Math.floor(Math.min(...corners.map(c => c.e))), e2 = Math.ceil(Math.max(...corners.map(c => c.e)))
  const n1 = Math.floor(Math.min(...corners.map(c => c.n))), n2 = Math.ceil(Math.max(...corners.map(c => c.n)))
  const params = new URLSearchParams({
    SERVICE: 'WFS', VERSION: '2.0.0', REQUEST: 'GetFeature', TYPENAMES: 'ave:Flurstueck',
    SRSNAME: 'urn:ogc:def:crs:EPSG::25832', BBOX: `${e1},${n1},${e2},${n2},urn:ogc:def:crs:EPSG::25832`,
    COUNT: String(count), STARTINDEX: String(startIndex),
  })
  return `${ALKIS_NW_URL}?${params}`
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
export function parseParcels(gml: string): Parcel[] {
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
      const p = fromUtm32(outer[i], outer[i + 1])
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
  return [props.gemarkung && `Gemarkung ${props.gemarkung}`, props.flur && `Flur ${Number(props.flur) || props.flur}`, number && `Flurstück ${number}`].filter(Boolean).join(', ') || 'Flurstück'
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
  if (/straße|weg|platz|bahn|verkehr|flug|schiff|hafen/i.test(usage)) return 'Verkehrsfläche'
  if (/gewässer|fluss|see|hafenbecken|meer/i.test(usage)) return 'Gewässer'
  if (/friedhof|besonderer funktionaler prägung|öffentlich/i.test(usage)) return 'öffentliche Fläche'
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
