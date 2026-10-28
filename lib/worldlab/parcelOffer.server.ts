// lib/worldlab/parcelOffer.server.ts
// Flurstück der Erdkarte: wem es gehört, welche Häuser darauf stehen, was es kostet.
// Thomas, 25.10.2026: Kaufen und Bauen richten sich nach Flurstücken – sonst
// könnte man im Garten eines anderen bauen.

import { geoToMerc, mercPerGroundMetre, mercToGeo, tileAt, tileOrigin, TILE_SIZE_MERC, type GeoPoint } from './mercator'
import { cadastreAttribution, landRate, parcelNotForSale } from './alkis'
import { mergeRings } from './parcelGeometry'
import { landUse, type LandUse } from './landUse'
import { municipalityLabel } from './municipality.server'
import { buildingValue } from './buildingOffer'
import { acquireItem, locationAt, offerFor, type Supabase } from './buildingOffer.server'
import { loadTile } from './tileSource.server'
import { looksLikeStreetParcel, toLocal, type P } from './landPlot'

export type ParcelRow = { id: string; ring: GeoPoint[]; label: string | null; usage: string | null; area_m2: number | null; centre_lat: number; centre_lon: number }

export function insideRing(p: GeoPoint, ring: readonly GeoPoint[]) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j]
    if ((a.lat > p.lat) !== (b.lat > p.lat) && p.lon < (b.lon - a.lon) * (p.lat - a.lat) / (b.lat - a.lat) + a.lon) inside = !inside
  }
  return inside
}

export function ringAreaM2(ring: readonly GeoPoint[]) {
  if (ring.length < 3) return 0
  const lat0 = ring[0].lat, k = Math.cos(lat0 * Math.PI / 180) * 111320
  let sum = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length]
    sum += (a.lon * k) * (b.lat * 111320) - (b.lon * k) * (a.lat * 111320)
  }
  return Math.abs(sum) / 2
}

/** Flurstück, in dem ein Punkt liegt (nur gespeicherte Flurstücke). */
export async function parcelAt(supabase: Supabase, p: GeoPoint): Promise<ParcelRow | null> {
  const { data } = await supabase.from('earth_parcels').select('id,ring,label,usage,area_m2,centre_lat,centre_lon').is('retired_at', null)
    .lte('min_lat', p.lat).gte('max_lat', p.lat).lte('min_lon', p.lon).gte('max_lon', p.lon).limit(20)
  return ((data ?? []) as ParcelRow[]).find(row => Array.isArray(row.ring) && insideRing(p, row.ring)) ?? null
}

/** Flurstücke, die ein Rechteck (Mitte, Maße, Drehung) berühren, mit Eigentümer. */
export async function parcelsAround(supabase: Supabase, p: GeoPoint, radiusM: number) {
  const dLat = radiusM / 111320, dLon = radiusM / (111320 * Math.cos(p.lat * Math.PI / 180))
  const { data } = await supabase.from('earth_parcels').select('id,ring,usage,source').is('retired_at', null)
    .lte('min_lat', p.lat + dLat).gte('max_lat', p.lat - dLat).lte('min_lon', p.lon + dLon).gte('max_lon', p.lon - dLon).limit(200)
  const rows = (data ?? []) as Array<{ id: string; ring: GeoPoint[]; usage: string | null; source: string | null }>
  const { data: owners } = rows.length ? await supabase.from('earth_parcel_owners').select('parcel_id,profile_id').in('parcel_id', rows.map(row => row.id)) : { data: [] }
  const owner = new Map((owners ?? []).map(row => [String(row.parcel_id), String(row.profile_id)]))
  return rows.map(row => ({ ...row, owner: owner.get(row.id) ?? null }))
}

/** Ohne Nutzungsart (Hessen): Straße aus den Kartendaten erkennen (`looksLikeStreetParcel`). */
async function streetWithoutUsage(supabase: Supabase, ring: readonly GeoPoint[]): Promise<string | null> {
  const lats = ring.map(p => p.lat), lons = ring.map(p => p.lon)
  const a = tileAt(geoToMerc({ lat: Math.max(...lats), lon: Math.min(...lons) })), b = tileAt(geoToMerc({ lat: Math.min(...lats), lon: Math.max(...lons) }))
  if ((b.x - a.x + 1) * (b.y - a.y + 1) > 9) return null
  const origin0 = ring[0]
  const local = ring.map(p => toLocal(origin0, p))
  const roads: P[][] = []
  for (let x = a.x; x <= b.x; x++) for (let y = a.y; y <= b.y; y++) {
    const tile = { x, y }
    const data = await loadTile(supabase, tile)
    const origin = tileOrigin(tile), k = TILE_SIZE_MERC / data.size
    for (const road of data.roads) {
      if (road.c === 'path') continue
      const line: P[] = []
      for (let i = 0; i + 1 < road.p.length; i += 2) line.push(toLocal(origin0, mercToGeo({ x: origin.x + road.p[i] * k, y: origin.y - road.p[i + 1] * k })))
      roads.push(line)
    }
  }
  return looksLikeStreetParcel(local, roads) ? 'Verkehrsfläche' : null
}

/** OSM-Kennungen der Häuser, deren Mitte im Flurstück liegt. */
async function buildingsOn(supabase: Supabase, ring: readonly GeoPoint[]) {
  const lats = ring.map(p => p.lat), lons = ring.map(p => p.lon)
  const a = tileAt(geoToMerc({ lat: Math.max(...lats), lon: Math.min(...lons) })), b = tileAt(geoToMerc({ lat: Math.min(...lats), lon: Math.max(...lons) }))
  const sources = new Set<string>()
  for (let x = a.x; x <= b.x; x++) for (let y = a.y; y <= b.y; y++) {
    const tile = { x, y }
    const data = await loadTile(supabase, tile)
    const origin = tileOrigin(tile), k = mercPerGroundMetre(mercToGeo({ x: origin.x + TILE_SIZE_MERC / 2, y: origin.y - TILE_SIZE_MERC / 2 }).lat)
    for (const block of data.blocks) {
      if (!block.i) continue
      const centre = mercToGeo({ x: origin.x + block.x * k, y: origin.y - block.y * k })
      if (insideRing(centre, ring)) sources.add(block.i)
    }
  }
  return [...sources]
}

export interface ParcelOffer {
  id: string; label: string; areaM2: number; usage: string | null
  /** Quellenvermerk (Kataster des Landes oder „im Spiel vermessen“) */
  source: string
  /** Nutzung und was das Flurstück hergibt (NOXIA-MAT-0001) */
  land: LandUse
  owned: boolean; own: boolean
  /** von einem Spieler zum Verkauf angeboten */
  listed?: boolean
  /** Steuer auf Verkäufe unter Spielern (Satz des Verwaltungsbezirks, vorerst der Gemeinde) */
  taxRate?: number; district?: string | null
  /** eigene Nachbarflurstücke mit gemeinsamer Grenze – zum Zusammenlegen */
  neighbours?: Array<{ id: string; label: string; areaM2: number }>
  forSale: boolean; reason?: string; price?: number; seller?: string
  buildings: Array<{ source: string; name: string; residents: number }>
  residents: number; rentPerInterval: number
  items?: Array<Awaited<ReturnType<typeof acquireItem>>>
}

export async function parcelOffer(supabase: Supabase, id: string, profileId: string | null): Promise<ParcelOffer | null> {
  const { data: row } = await supabase.from('earth_parcels').select('id,ring,label,usage,area_m2,centre_lat,centre_lon,source,props').eq('id', id).is('retired_at', null).maybeSingle()
  if (!row) return null
  const parcel = row as ParcelRow & { source: string | null }
  const areaM2 = Math.round(parcel.area_m2 ?? ringAreaM2(parcel.ring))
  const source = parcel.source === 'noxia' ? 'im Spiel neu vermessen (aus amtlichen Flurstücken)'
    : parcel.source === 'noxia_land' ? 'im Spiel abgesteckt (hier gibt es kein offenes Kataster)'
      : cadastreAttribution(parcel.source)
  const props = (row as { props?: Record<string, unknown> }).props ?? {}
  const land = landUse(parcel.usage, typeof props.nutzbez === 'string' ? props.nutzbez : null, areaM2)
  const base = { id: parcel.id, label: parcel.label ?? 'Flurstück', areaM2, usage: parcel.usage, source, land, buildings: [] as ParcelOffer['buildings'], residents: 0, rentPerInterval: 0 }
  const { data: owner } = await supabase.from('earth_parcel_owners').select('profile_id,profiles(username)').eq('parcel_id', id).maybeSingle()
  if (owner) {
    const own = owner.profile_id === profileId
    const ownerName = (owner as { profiles?: { username?: string } | null }).profiles?.username ?? 'ein anderer Spieler'
    const { data: listing } = await supabase.from('earth_property_listings').select('price').eq('kind', 'parcel').eq('ref', id).maybeSingle()
    const sources = await buildingsOn(supabase, parcel.ring)
    for (const ref of sources) {
      const { data: entity } = await supabase.from('tile_entities').select('display_name,residential_capacity').eq('source_ref', ref).maybeSingle()
      if (entity) base.buildings.push({ source: ref, name: String(entity.display_name ?? 'Gebäude'), residents: 0 })
    }
    const neighbours = own ? await ownNeighbours(supabase, parcel, profileId!) : undefined
    const district = String(props.gemeinde ?? '') || null
    const { data: rate } = await supabase.rpc('earth_property_tax_rate', { p_district: district ?? '*' })
    Object.assign(base, { taxRate: Number(rate ?? 0.05), district })
    if (listing) return { ...base, owned: true, own, listed: true, neighbours, forSale: !own, price: Number(listing.price), seller: own ? 'du' : ownerName, reason: own ? 'von dir angeboten' : undefined }
    return { ...base, owned: true, own, neighbours, seller: own ? 'du' : ownerName, forSale: false, reason: own ? 'gehört dir' : `gehört ${ownerName}` }
  }
  const blocked = parcelNotForSale(parcel.usage) ?? (parcel.usage ? null : await streetWithoutUsage(supabase, parcel.ring))
  if (blocked) return { ...base, owned: false, own: false, forSale: false, reason: blocked }

  const sources = await buildingsOn(supabase, parcel.ring)
  const items: NonNullable<ParcelOffer['items']> = []
  let value = 0
  for (const source of sources) {
    const offer = await offerFor(supabase, source)
    if (!offer.forSale || !offer.facts) {
      if (offer.reason === 'abgerissen') continue
      return { ...base, owned: false, own: false, forSale: false, reason: `${offer.name ?? 'ein Haus'}: ${offer.reason ?? 'nicht verkäuflich'}` }
    }
    base.buildings.push({ source, name: offer.name ?? 'Gebäude', residents: offer.residents ?? 0 })
    base.residents += offer.residents ?? 0
    base.rentPerInterval += offer.rentPerInterval ?? 0
    value += buildingValue({ areaM2: offer.facts.areaM2, levels: offer.facts.levels, kind: offer.facts.kind, rentPerInterval: offer.rentPerInterval ?? 0, locationFactor: offer.location?.factor }) + (offer.fitOut ?? 0)
    items.push(await acquireItem(supabase, source, offer))
  }
  const { data: earth } = await supabase.from('locations').select('id').eq('slug', 'earth').maybeSingle()
  const { data: publicActor } = earth ? await supabase.from('location_public_actors').select('actor_id,actors(display_name)').eq('location_id', earth.id).maybeSingle() : { data: null }
  // Verkäufer ist die Stadt/Gemeinde laut Kataster; gebucht wird beim öffentlichen Akteur.
  const seller = await municipalityLabel(supabase, String((row as { props?: Record<string, unknown> }).props?.gemeinde ?? ''))
    ?? (publicActor as { actors?: { display_name?: string } | null } | null)?.actors?.display_name ?? 'Gemeinde'
  // Lage (Innenstadt teurer) auch auf den Boden; die Häuser tragen ihren Aufschlag schon im Wert.
  const location = await locationAt(supabase, { lat: Number(parcel.centre_lat), lon: Number(parcel.centre_lon) })
  const price = Math.max(500, Math.round((areaM2 * landRate(parcel.usage) * location.factor + value) / 50) * 50)
  return { ...base, owned: false, own: false, forSale: true, price, seller, items }
}

/** Eigene Flurstücke, die mit diesem eine Grenze teilen (zusammenlegbar). */
async function ownNeighbours(supabase: Supabase, parcel: ParcelRow, profileId: string) {
  const centre = { lat: parcel.centre_lat, lon: parcel.centre_lon }
  const radius = Math.sqrt(Math.max(ringAreaM2(parcel.ring), 100)) * 2 + 60
  const around = await parcelsAround(supabase, centre, radius)
  const out: NonNullable<ParcelOffer['neighbours']> = []
  for (const other of around) {
    if (other.id === parcel.id || other.owner !== profileId || !Array.isArray(other.ring)) continue
    if (!mergeRings(parcel.ring, other.ring)) continue
    const { data } = await supabase.from('earth_parcels').select('label,area_m2').eq('id', other.id).maybeSingle()
    out.push({ id: other.id, label: String(data?.label ?? 'Flurstück'), areaM2: Math.round(Number(data?.area_m2 ?? ringAreaM2(other.ring))) })
  }
  return out
}
