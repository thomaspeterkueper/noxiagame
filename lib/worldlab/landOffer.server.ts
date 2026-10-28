// lib/worldlab/landOffer.server.ts
// Freies Land abstecken und kaufen, wo es kein offenes Kataster gibt (Thomas,
// 28.10.2026). Das gekaufte Land wird ein Flurstück wie die amtlichen (Quelle
// `noxia_land`): Grenzen auf der Karte, Bauen, Teilen, Weiterverkauf – alles wie
// beim Kataster. Geprüft wird gegen die Kartendaten:
//   * keine fremden Häuser, und 6 m Garten um sie (wie die Bauprüfung ohne Kataster),
//   * keine Straßen (Feld- und Waldwege stören nicht), keine Gewässer,
//   * keine öffentlichen Flächen (Park, Friedhof, Sportplatz, Parkplatz …),
//   * kein anderes Flurstück (amtlich oder abgesteckt).

import { geoToMerc, tileAt, tileOrigin, TILE_SIZE_MERC, type GeoPoint } from './mercator'
import { hasCadastre } from './alkis'
import { rectsOverlap } from './rects'
import { loadTile } from './tileSource.server'
import { parcelsAround } from './parcelOffer.server'
import { locationAt, type Supabase } from './buildingOffer.server'
import { municipalityLabel } from './municipality.server'
import {
  insidePolygon, landRateForArea, landSizeValid, lineTouchesPolygon, polygonAreaM2, polygonsOverlap, rectRing, toLocal,
  LAND_BLOCKING_AREAS, LAND_GARDEN_M, LAND_MAX_M, LAND_MIN_M, LAND_ROAD_HALF_WIDTH, LAND_USE_LABEL, type P,
} from './landPlot'

/** Quelle abgesteckter Grundstücke in earth_parcels. */
export const LAND_SOURCE = 'noxia_land'

export interface LandRequest { at: GeoPoint; w: number; d: number; rotation: number }
export interface LandOffer {
  available: boolean
  reason?: string
  ring: GeoPoint[]
  areaM2: number
  usage: string
  price?: number
  seller?: string
  place?: string | null
}

const round50 = (v: number) => Math.round(v / 50) * 50

export async function landOffer(supabase: Supabase, request: LandRequest): Promise<LandOffer> {
  const { at, w, d, rotation } = request
  const ring = rectRing(at, w, d, rotation)
  const local = ring.map(p => toLocal(at, p))
  const areaM2 = Math.round(polygonAreaM2(local))
  const base = { ring, areaM2, usage: 'Land' }
  if (!landSizeValid(w, d)) return { ...base, available: false, reason: `Seiten zwischen ${LAND_MIN_M} und ${LAND_MAX_M} m.` }
  if (hasCadastre(at)) return { ...base, available: false, reason: 'Hier gilt das amtliche Kataster – bitte ein Flurstück anklicken.' }

  // Andere Flurstücke (amtlich am Rand eines Katasterlandes oder abgesteckt)
  const others = await parcelsAround(supabase, at, Math.hypot(w, d) / 2 + 5)
  for (const other of others) {
    if (!Array.isArray(other.ring) || other.ring.length < 3) continue
    if (polygonsOverlap(local, other.ring.map(p => toLocal(at, p)))) return { ...base, available: false, reason: 'Überschneidet ein anderes Grundstück.' }
  }

  // Kartendaten der Kacheln um den Punkt
  const merc = geoToMerc(at)
  const home = tileAt(merc)
  let anyData = false
  let centreKind: string | null = null
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const tile = { x: home.x + dx, y: home.y + dy }
    const data = await loadTile(supabase, tile)
    if (data.roads.length || data.areas.length || data.blocks.length) anyData = true
    const origin = tileOrigin(tile), k = TILE_SIZE_MERC / data.size
    // Grundstück in Metern dieser Kachel
    const toTile = (p: GeoPoint): P => { const m = geoToMerc(p); return { x: (m.x - origin.x) / k, y: (origin.y - m.y) / k } }
    const plot = ring.map(toTile)
    const centre = toTile(at)
    const box = { x: centre.x, y: centre.y, hw: w / 2, hd: d / 2, a: rotation * Math.PI / 180 }
    for (const block of data.blocks) {
      const house = { x: block.x, y: block.y, hw: block.w / 2, hd: block.d / 2, a: block.a }
      if (rectsOverlap(box, { ...house, hw: house.hw + LAND_GARDEN_M, hd: house.hd + LAND_GARDEN_M })) {
        const name = block.nm ?? block.h ?? 'einem Haus'
        return { ...base, available: false, reason: `Zu nah an ${name} – das ist bebautes Land. Häuser kauft man einzeln.` }
      }
    }
    for (const road of data.roads) {
      const half = LAND_ROAD_HALF_WIDTH[road.c]
      if (!half) continue
      const line: P[] = []
      for (let i = 0; i + 1 < road.p.length; i += 2) line.push({ x: road.p[i], y: road.p[i + 1] })
      if (lineTouchesPolygon(line, plot, half)) return { ...base, available: false, reason: road.n ? `Hier verläuft die ${road.n}.` : 'Hier verläuft eine Straße.' }
    }
    for (const [i, river] of data.rivers.entries()) {
      const line: P[] = []
      for (let j = 0; j + 1 < river.length; j += 2) line.push({ x: river[j], y: river[j + 1] })
      if (lineTouchesPolygon(line, plot, (data.rw?.[i] ?? 5) / 2)) return { ...base, available: false, reason: 'Hier fließt ein Gewässer.' }
    }
    for (const area of data.areas) {
      const poly: P[] = []
      for (let j = 0; j + 1 < area.p.length; j += 2) poly.push({ x: area.p[j], y: area.p[j + 1] })
      if (poly.length < 3) continue
      const blocking = LAND_BLOCKING_AREAS[area.k]
      if (blocking && polygonsOverlap(plot, poly)) return { ...base, available: false, reason: `Hier ist ${blocking} – öffentliche oder fremde Fläche.` }
      if (!centreKind && insidePolygon(centre, poly) && centre.x >= 0 && centre.y >= 0 && centre.x <= data.size && centre.y <= data.size) centreKind = area.k
    }
  }
  if (!anyData) return { ...base, available: false, reason: 'Hier fehlen noch Kartendaten – erst Kartendaten nachladen.' }

  const location = await locationAt(supabase, at)
  const { data: earth } = await supabase.from('locations').select('id').eq('slug', 'earth').maybeSingle()
  const { data: publicActor } = earth ? await supabase.from('location_public_actors').select('actors(display_name)').eq('location_id', earth.id).maybeSingle() : { data: null }
  const seller = (location.place ? await municipalityLabel(supabase, location.place) : null)
    ?? (publicActor as { actors?: { display_name?: string } | null } | null)?.actors?.display_name ?? 'Gemeinde'
  const usage = LAND_USE_LABEL[centreKind ?? ''] ?? 'Land'
  const price = Math.max(500, round50(areaM2 * landRateForArea(centreKind) * location.factor))
  return { ...base, usage, available: true, price, seller, place: location.place }
}
