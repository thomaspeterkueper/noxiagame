// lib/worldlab/parcelOffer.server.ts
// Flurstück der Erdkarte: wem es gehört, welche Häuser darauf stehen, was es kostet.
// Thomas, 25.10.2026: Kaufen und Bauen richten sich nach Flurstücken – sonst
// könnte man im Garten eines anderen bauen.

import { geoToMerc, mercPerGroundMetre, mercToGeo, tileAt, tileOrigin, TILE_SIZE_MERC, type GeoPoint } from './mercator'
import { landRate, parcelNotForSale } from './alkis'
import { buildingValue } from './buildingOffer'
import { acquireItem, offerFor, type Supabase } from './buildingOffer.server'
import { loadTile } from './tileSource.server'

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
  const { data } = await supabase.from('earth_parcels').select('id,ring,label,usage,area_m2,centre_lat,centre_lon')
    .lte('min_lat', p.lat).gte('max_lat', p.lat).lte('min_lon', p.lon).gte('max_lon', p.lon).limit(20)
  return ((data ?? []) as ParcelRow[]).find(row => Array.isArray(row.ring) && insideRing(p, row.ring)) ?? null
}

/** Flurstücke, die ein Rechteck (Mitte, Maße, Drehung) berühren, mit Eigentümer. */
export async function parcelsAround(supabase: Supabase, p: GeoPoint, radiusM: number) {
  const dLat = radiusM / 111320, dLon = radiusM / (111320 * Math.cos(p.lat * Math.PI / 180))
  const { data } = await supabase.from('earth_parcels').select('id,ring,usage')
    .lte('min_lat', p.lat + dLat).gte('max_lat', p.lat - dLat).lte('min_lon', p.lon + dLon).gte('max_lon', p.lon - dLon).limit(200)
  const rows = (data ?? []) as Array<{ id: string; ring: GeoPoint[]; usage: string | null }>
  const { data: owners } = rows.length ? await supabase.from('earth_parcel_owners').select('parcel_id,profile_id').in('parcel_id', rows.map(row => row.id)) : { data: [] }
  const owner = new Map((owners ?? []).map(row => [String(row.parcel_id), String(row.profile_id)]))
  return rows.map(row => ({ ...row, owner: owner.get(row.id) ?? null }))
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
  owned: boolean; own: boolean
  forSale: boolean; reason?: string; price?: number; seller?: string
  buildings: Array<{ source: string; name: string; residents: number }>
  residents: number; rentPerInterval: number
  items?: Array<Awaited<ReturnType<typeof acquireItem>>>
}

export async function parcelOffer(supabase: Supabase, id: string, profileId: string | null): Promise<ParcelOffer | null> {
  const { data: row } = await supabase.from('earth_parcels').select('id,ring,label,usage,area_m2,centre_lat,centre_lon').eq('id', id).maybeSingle()
  if (!row) return null
  const parcel = row as ParcelRow
  const areaM2 = Math.round(parcel.area_m2 ?? ringAreaM2(parcel.ring))
  const base = { id: parcel.id, label: parcel.label ?? 'Flurstück', areaM2, usage: parcel.usage, buildings: [] as ParcelOffer['buildings'], residents: 0, rentPerInterval: 0 }
  const { data: owner } = await supabase.from('earth_parcel_owners').select('profile_id').eq('parcel_id', id).maybeSingle()
  if (owner) return { ...base, owned: true, own: owner.profile_id === profileId, forSale: false, reason: owner.profile_id === profileId ? 'gehört dir' : 'gehört einem anderen Spieler' }
  const blocked = parcelNotForSale(parcel.usage)
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
    value += buildingValue({ areaM2: offer.facts.areaM2, levels: offer.facts.levels, kind: offer.facts.kind, rentPerInterval: offer.rentPerInterval ?? 0 })
    items.push(await acquireItem(supabase, source, offer))
  }
  const { data: earth } = await supabase.from('locations').select('id').eq('slug', 'earth').maybeSingle()
  const { data: publicActor } = earth ? await supabase.from('location_public_actors').select('actor_id,actors(display_name)').eq('location_id', earth.id).maybeSingle() : { data: null }
  const seller = (publicActor as { actors?: { display_name?: string } | null } | null)?.actors?.display_name ?? 'Gemeinde'
  const price = Math.max(500, Math.round((areaM2 * landRate(parcel.usage) + value) / 50) * 50)
  return { ...base, owned: false, own: false, forSale: true, price, seller, items }
}
