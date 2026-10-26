// lib/worldlab/buildingOffer.server.ts
// Angebot für ein reales Haus der Erdkarte (aus den gespeicherten OSM-Daten) und
// die Angaben, mit denen die Datenbank es übernimmt (acquire_earth_building).
// Gemeinsam für den Kauf eines Hauses und eines Flurstücks samt Häusern.

import type { createServiceClient } from '@/lib/supabase/service'
import { municipalityLabel } from './municipality.server'
import { geoToLocalMeters } from '@/lib/world/spatial/earthSpatial'
import { realVenueKind } from './venueConversion'
import { buildingFacts, buildingPrice, fitOutValue, locationFactor, notForSaleReason, plannedResidents, RENT_PER_RESIDENT, type BuildingFacts, type GeoPoint, type SettlementPoint } from './buildingOffer'

export type Supabase = ReturnType<typeof createServiceClient>
export type FeatureRow = { id: string; region_id: string; geometry: { kind?: string; coordinates?: unknown }; properties: Record<string, unknown> | null }

export const BLOCK_NAMES: Record<string, string> = { house: 'Wohnhaus', row: 'Mehrfamilienhaus', hall: 'Halle', factory: 'Fabrik', church: 'Kirche', shed: 'Schuppen' }

export interface Offer {
  forSale: boolean
  reason?: string
  price?: number
  seller?: string
  residents?: number
  /** Bewohner, die beim Kauf als Personen einziehen (das Haus war bisher ohne Personen im Spiel). */
  newResidents?: number
  rentPerInterval?: number
  /** Lokalart eines Hauses, das laut Kartendaten schon Lokal ist, und sein Ausbauwert im Preis. */
  venue?: string | null
  fitOut?: number
  /** Lageaufschlag (1 = ohne), nächste Ortsmitte und Abstand dorthin. */
  location?: { factor: number; place: string | null; distanceM: number | null }
  name?: string
  /** OSM-Tags des Grundrisses (Lokalart, Anschrift, Geschosse). */
  tags?: Record<string, unknown>
  facts?: BuildingFacts
  features?: FeatureRow[]
}

// Ortsmitten (OSM place=*) aus region_features; wenige Dutzend, kurz zwischengespeichert.
let settlementCache: { at: number; rows: SettlementPoint[] } | null = null
async function settlements(supabase: Supabase): Promise<SettlementPoint[]> {
  if (settlementCache && Date.now() - settlementCache.at < 10 * 60_000) return settlementCache.rows
  const { data } = await supabase.from('region_features').select('geometry,properties').eq('feature_type', 'settlement').limit(2000)
  const seen = new Set<string>()
  const rows = (data ?? []).flatMap(row => {
    const props = (row.properties ?? {}) as Record<string, unknown>
    const at = (row.geometry as { coordinates?: { lat?: number; lon?: number } } | null)?.coordinates
    const name = String(props.name ?? '').trim(), place = String(props.place ?? '')
    if (!name || !at || !Number.isFinite(at.lat) || !Number.isFinite(at.lon)) return []
    const key = `${name}:${place}:${at.lat!.toFixed(4)}:${at.lon!.toFixed(4)}`
    if (seen.has(key)) return []
    seen.add(key)
    return [{ name, place, lat: Number(at.lat), lon: Number(at.lon) }]
  })
  settlementCache = { at: Date.now(), rows }
  return rows
}

/** Lageaufschlag für einen Punkt der Erde (Innenstadt teurer). */
export async function locationAt(supabase: Supabase, point: GeoPoint) {
  return locationFactor(point, await settlements(supabase))
}

export async function offerFor(supabase: Supabase, source: string): Promise<Offer> {
  const { data } = await supabase.from('region_features').select('id,region_id,geometry,properties')
    .eq('feature_type', 'building').eq('properties->>noxia_source_id', source).limit(10)
  const features = (data ?? []) as FeatureRow[]
  const feature = features.find(row => Array.isArray(row.geometry?.coordinates) && (row.geometry.coordinates as unknown[]).length >= 3)
  if (!feature) return { forSale: false, reason: 'Gebäude nicht in den Kartendaten' }
  const properties = feature.properties ?? {}
  const ring = (feature.geometry.coordinates as Array<{ lat: number; lon: number }>).filter(p => Number.isFinite(p?.lat) && Number.isFinite(p?.lon))
  const facts = buildingFacts(ring, properties)
  if (!facts) return { forSale: false, reason: 'Grundriss unbrauchbar' }
  const street = String(properties['addr:street'] ?? '').trim(), number = String(properties['addr:housenumber'] ?? '').trim()
  const name = String(properties.name ?? '').trim() || (street && number ? `${street} ${number}` : BLOCK_NAMES[facts.kind] ?? 'Gebäude')

  const why = notForSaleReason(properties, facts.kind)
  if (why) return { forSale: false, reason: why, name, facts, tags: properties }
  const [{ data: owned }, { data: cleared }] = await Promise.all([
    supabase.from('tile_entities').select('id,is_state_owned').eq('source_ref', source).limit(1),
    supabase.from('earth_cleared_buildings').select('source_ref').eq('source_ref', source).limit(1),
  ])
  // Ein reales Lokal, das (noch) dem Ort gehört, ist verkäuflich (Thomas, 25.10.2026).
  const venue = realVenueKind(properties)
  const ownedByTown = Boolean(owned?.length && venue && (owned[0] as { is_state_owned?: boolean }).is_state_owned)
  if (owned?.length && !ownedByTown) return { forSale: false, reason: 'gehört bereits jemandem', name, facts, tags: properties }
  if (cleared?.length) return { forSale: false, reason: 'abgerissen', name, facts, tags: properties }

  // Steht schon ein NOXIA-Gebäude darauf (die Karte zeichnet es auf diesem Grundriss)?
  const span = Math.max(facts.w, facts.d) / 2 / 111320
  const { data: onTop } = await supabase.from('tile_entities').select('id,latitude_deg,longitude_deg,footprint_width_m,footprint_depth_m')
    .eq('entity_type', 'building').eq('status', 'active')
    .gte('latitude_deg', facts.centre.lat - span).lte('latitude_deg', facts.centre.lat + span)
    .gte('longitude_deg', facts.centre.lon - span * 1.7).lte('longitude_deg', facts.centre.lon + span * 1.7).limit(1)
  if (onTop?.length && !ownedByTown) return { forSale: false, reason: 'gehört bereits jemandem', name, facts }

  // Bewohner: Wohnzuweisungen an diesen Grundriss; ihre Miete erhöht den Preis.
  const ids = features.map(row => row.id)
  const { data: homes } = await supabase.from('person_assignments').select('person_id')
    .in('region_feature_id', ids).eq('is_active', true).eq('assignment_type', 'home')
  const people = (homes ?? []).map(row => String(row.person_id))
  let rentPerInterval = 0
  if (people.length) {
    const { data: tenancies } = await supabase.from('person_tenancies').select('rent_per_billing').in('person_id', people).eq('status', 'active')
    rentPerInterval = (tenancies ?? []).reduce((sum, row) => sum + Number(row.rent_per_billing ?? 0), 0)
  }
  // Echte Wohnhäuser sind bewohnt: wer dort lebt, zieht beim Kauf als Person ins Spiel ein und zahlt Miete.
  // Ein Lokal bringt keine neuen Bewohner mit; seine Wohnungen im Obergeschoss vergibt der Wohnungsmarkt.
  const newResidents = people.length || venue ? 0 : plannedResidents(facts.kind, facts.areaM2, facts.levels)
  rentPerInterval += newResidents * RENT_PER_RESIDENT

  const location = await locationAt(supabase, facts.centre)
  const { data: earth } = await supabase.from('locations').select('id').eq('slug', 'earth').maybeSingle()
  const { data: publicActor } = earth ? await supabase.from('location_public_actors').select('actor_id,actors(display_name)').eq('location_id', earth.id).maybeSingle() : { data: null }
  const actor = publicActor as { actors?: { display_name?: string } | null } | null
  return {
    forSale: true, name, facts, features, tags: properties,
    price: buildingPrice({ areaM2: facts.areaM2, levels: facts.levels, kind: facts.kind, rentPerInterval, locationFactor: location.factor, fitOut: fitOutValue(properties) }),
    location, venue, fitOut: fitOutValue(properties),
    seller: await municipalityLabel(supabase, String(properties['addr:city'] ?? '')) ?? actor?.actors?.display_name ?? 'Gemeinde',
    residents: people.length + newResidents, newResidents, rentPerInterval,
  }
}


/** Angaben für acquire_earth_building (ohne Spieler und Preis). */
export async function acquireItem(supabase: Supabase, source: string, offer: Offer) {
  const facts = offer.facts!
  const regionId = offer.features?.[0]?.region_id
  const { data: region } = regionId ? await supabase.from('celestial_regions').select('slug,center_lat,center_lon').eq('id', regionId).maybeSingle() : { data: null }
  const local = region ? geoToLocalMeters(facts.centre, { lat: Number(region.center_lat), lon: Number(region.center_lon) }) : { eastM: 0, northM: 0 }
  const living = (facts.kind === 'house' || facts.kind === 'row') && !offer.venue
  return {
    source, lat: facts.centre.lat, lon: facts.centre.lon, w: facts.w, d: facts.d, rotation: facts.rotationDeg,
    name: offer.name ?? null, region: region?.slug ?? null, x: local.eastM, y: local.northM,
    capacity: living ? Math.max(offer.residents ?? 0, plannedResidents(facts.kind, facts.areaM2, facts.levels)) : 0,
    features: (offer.features ?? []).map(row => row.id),
    residents: offer.newResidents ?? 0, rent: RENT_PER_RESIDENT,
  }
}
