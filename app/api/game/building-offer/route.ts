// app/api/game/building-offer/route.ts
// Reale Gebäude der Erdkarte kaufen und (nur eigene, gekaufte) abreißen
// (Thomas, 25.10.2026; Request R-12, docs/workstreams/population-economy.md).
//
// GET  ?source=osm:way:123          → Angebot: Preis, Verkäufer, Bewohner, Miete – oder warum nicht verkäuflich
// POST { source }                    → kaufen (Preis rechnet der Server neu, Buchung atomar in buy_earth_building)
// POST { action: 'demolish', entityId } → eigenes gekauftes Gebäude abreißen (demolish_earth_building);
//                                        Bewohner ziehen in staatlichen Wohnraum
// POST { action: 'convert', entityId, type } → Nutzung ändern, halbe Baukosten (convert_earth_building)
// GET  ?conversions=<entityId>           → Bautypen, die in das gekaufte Gebäude passen
//
// Maße und Preis kommen aus den gespeicherten OSM-Daten (lib/worldlab/buildingOffer.ts),
// nie aus Angaben des Spielers.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { geoToLocalMeters } from '@/lib/world/spatial/earthSpatial'
import { getBuildingFootprint } from '@/lib/game/spatial/footprints'
import { buildingFacts, buildingPrice, notForSaleReason, plannedResidents, RENT_PER_RESIDENT, type BuildingFacts } from '@/lib/worldlab/buildingOffer'

type Supabase = ReturnType<typeof createServiceClient>
type FeatureRow = { id: string; region_id: string; geometry: { kind?: string; coordinates?: unknown }; properties: Record<string, unknown> | null }

const SOURCE = /^osm:(way|relation):\d+$/
const BLOCK_NAMES: Record<string, string> = { house: 'Wohnhaus', row: 'Mehrfamilienhaus', hall: 'Halle', factory: 'Fabrik', church: 'Kirche', shed: 'Schuppen' }
/** Umbau kostet die Hälfte des Neubaus (Thomas, 25.10.2026). */
const CONVERSION_SHARE = 0.5

const ERRORS: Record<string, [number, string]> = {
  NOXIA_CREDITS_INSUFFICIENT: [400, 'Nicht genug Credits.'],
  NOXIA_BUILDING_OWNED: [409, 'Das Gebäude gehört bereits jemandem.'],
  NOXIA_BUILDING_CLEARED: [409, 'Das Gebäude wurde abgerissen.'],
  NOXIA_BUILDING_INHABITED: [409, 'Im Gebäude wohnen noch Menschen – Abriss nicht möglich.'],
  NOXIA_BUILDING_NOT_OWNED: [403, 'Das Gebäude gehört dir nicht.'],
  NOXIA_BUILDING_NOT_ACQUIRED: [409, 'Nur gekaufte reale Gebäude können hier abgerissen werden.'],
  NOXIA_BUILDING_NOT_FOUND: [404, 'Gebäude nicht gefunden.'],
  NOXIA_BUILDING_STAFFED: [409, 'Im Gebäude arbeiten noch Menschen – Abriss nicht möglich.'],
  NOXIA_NO_STATE_HOUSING: [409, 'Für die Bewohner gibt es keinen freien staatlichen Wohnraum – Abriss nicht möglich.'],
  NOXIA_TYPE_INVALID: [400, 'Diese Nutzung gibt es nicht.'],
}
function failure(message: string) {
  const code = Object.keys(ERRORS).find(key => message.includes(key))
  const [status, text] = code ? ERRORS[code] : [500, 'Vorgang fehlgeschlagen.']
  return NextResponse.json({ error: text, code: code ?? null }, { status })
}

interface Offer {
  forSale: boolean
  reason?: string
  price?: number
  seller?: string
  residents?: number
  /** Bewohner, die beim Kauf als Personen einziehen (das Haus war bisher ohne Personen im Spiel). */
  newResidents?: number
  rentPerInterval?: number
  name?: string
  facts?: BuildingFacts
  features?: FeatureRow[]
}

async function offerFor(supabase: Supabase, source: string): Promise<Offer> {
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
  if (why) return { forSale: false, reason: why, name, facts }
  const [{ data: owned }, { data: cleared }] = await Promise.all([
    supabase.from('tile_entities').select('id').eq('source_ref', source).limit(1),
    supabase.from('earth_cleared_buildings').select('source_ref').eq('source_ref', source).limit(1),
  ])
  if (owned?.length) return { forSale: false, reason: 'gehört bereits jemandem', name, facts }
  if (cleared?.length) return { forSale: false, reason: 'abgerissen', name, facts }

  // Steht schon ein NOXIA-Gebäude darauf (die Karte zeichnet es auf diesem Grundriss)?
  const span = Math.max(facts.w, facts.d) / 2 / 111320
  const { data: onTop } = await supabase.from('tile_entities').select('id,latitude_deg,longitude_deg,footprint_width_m,footprint_depth_m')
    .eq('entity_type', 'building').eq('status', 'active')
    .gte('latitude_deg', facts.centre.lat - span).lte('latitude_deg', facts.centre.lat + span)
    .gte('longitude_deg', facts.centre.lon - span * 1.7).lte('longitude_deg', facts.centre.lon + span * 1.7).limit(1)
  if (onTop?.length) return { forSale: false, reason: 'gehört bereits jemandem', name, facts }

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
  const newResidents = people.length ? 0 : plannedResidents(facts.kind, facts.areaM2, facts.levels)
  rentPerInterval += newResidents * RENT_PER_RESIDENT

  const { data: earth } = await supabase.from('locations').select('id').eq('slug', 'earth').maybeSingle()
  const { data: publicActor } = earth ? await supabase.from('location_public_actors').select('actor_id,actors(display_name)').eq('location_id', earth.id).maybeSingle() : { data: null }
  const actor = publicActor as { actors?: { display_name?: string } | null } | null
  return {
    forSale: true, name, facts, features,
    price: buildingPrice({ areaM2: facts.areaM2, levels: facts.levels, kind: facts.kind, rentPerInterval }),
    seller: actor?.actors?.display_name ?? 'Gemeinde',
    residents: people.length + newResidents, newResidents, rentPerInterval,
  }
}

/** Bautypen, die in ein gekauftes Gebäude passen (Grundfläche), mit halbem Preis. */
async function conversions(supabase: Supabase, entityId: string) {
  const { data: row } = await supabase.from('tile_entities').select('entity_id,footprint_width_m,footprint_depth_m,source_ref').eq('id', entityId).maybeSingle()
  if (!row?.source_ref) return []
  const long = Math.max(Number(row.footprint_width_m), Number(row.footprint_depth_m)) + 2
  const short = Math.min(Number(row.footprint_width_m), Number(row.footprint_depth_m)) + 2
  const { data: definitions } = await supabase.from('building_definitions').select('key,name,cost_credits,allowed_locations,category').eq('is_active', true)
  return (definitions ?? []).flatMap(def => {
    const allowed = def.allowed_locations as string[] | null
    if (allowed?.length && !allowed.includes('earth')) return []
    if (def.key === row.entity_id || def.category === 'unique' || /spaceport|pad|landing|dock|harbour/.test(String(def.key))) return []
    const footprint = getBuildingFootprint(String(def.key))
    if (Math.max(footprint.widthM, footprint.depthM) > long || Math.min(footprint.widthM, footprint.depthM) > short) return []
    return [{ id: String(def.key), name: String(def.name), cost: Math.round(Number(def.cost_credits ?? 0) * CONVERSION_SHARE) }]
  }).sort((a, b) => a.cost - b.cost)
}

export async function GET(req: NextRequest) {
  const convertFor = req.nextUrl.searchParams.get('conversions')
  if (convertFor) {
    if (!await verifiedBearerUserId(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ conversions: await conversions(createServiceClient(), convertFor) }, { headers: { 'Cache-Control': 'no-store' } })
  }
  const source = String(req.nextUrl.searchParams.get('source') ?? '')
  if (!SOURCE.test(source)) return NextResponse.json({ forSale: false, reason: 'unbekanntes Gebäude' })
  const offer = await offerFor(createServiceClient(), source)
  return NextResponse.json({
    forSale: offer.forSale, reason: offer.reason, price: offer.price, seller: offer.seller,
    residents: offer.residents, newResidents: offer.newResidents, rentPerInterval: offer.rentPerInterval, name: offer.name,
    areaM2: offer.facts?.areaM2, levels: offer.facts?.levels,
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { action?: string; source?: string; entityId?: string }
  const supabase = createServiceClient()

  if (body.action === 'demolish') {
    if (!body.entityId) return NextResponse.json({ error: 'Gebäude fehlt.' }, { status: 400 })
    const { data, error } = await supabase.rpc('demolish_earth_building', { p_profile_id: profileId, p_entity_id: body.entityId })
    if (error) return failure(error.message)
    return NextResponse.json(data)
  }

  if (body.action === 'convert') {
    const type = String((body as { type?: string }).type ?? '')
    if (!body.entityId || !type) return NextResponse.json({ error: 'Gebäude oder Nutzung fehlt.' }, { status: 400 })
    const option = (await conversions(supabase, body.entityId)).find(item => item.id === type)
    if (!option) return NextResponse.json({ error: 'Diese Nutzung passt nicht in das Gebäude.' }, { status: 409 })
    const { data, error } = await supabase.rpc('convert_earth_building', { p_profile_id: profileId, p_entity_id: body.entityId, p_type: type, p_cost: option.cost })
    if (error) return failure(error.message)
    return NextResponse.json(data)
  }

  const source = String(body.source ?? '')
  if (!SOURCE.test(source)) return NextResponse.json({ error: 'Unbekanntes Gebäude.' }, { status: 400 })
  const offer = await offerFor(supabase, source)
  if (!offer.forSale || !offer.facts || !offer.price) return NextResponse.json({ error: `Nicht verkäuflich: ${offer.reason ?? 'unbekannt'}` }, { status: 409 })
  const facts = offer.facts

  // Lage im Bezugsrahmen der Region (wie die übrigen Erdgebäude: Meter ab Regionsmitte)
  const regionId = offer.features?.[0]?.region_id
  const { data: region } = regionId ? await supabase.from('celestial_regions').select('slug,center_lat,center_lon').eq('id', regionId).maybeSingle() : { data: null }
  const local = region ? geoToLocalMeters(facts.centre, { lat: Number(region.center_lat), lon: Number(region.center_lon) }) : { eastM: 0, northM: 0 }
  const living = facts.kind === 'house' || facts.kind === 'row'
  const { data, error } = await supabase.rpc('buy_earth_building', {
    p_profile_id: profileId, p_source_ref: source, p_price: offer.price,
    p_latitude: facts.centre.lat, p_longitude: facts.centre.lon,
    p_width: facts.w, p_depth: facts.d, p_rotation: facts.rotationDeg,
    p_display_name: offer.name ?? null, p_region_slug: region?.slug ?? null,
    p_x_m: local.eastM, p_y_m: local.northM,
    p_residential_capacity: living ? Math.max(offer.residents ?? 0, plannedResidents(facts.kind, facts.areaM2, facts.levels)) : 0,
    p_feature_ids: (offer.features ?? []).map(row => row.id),
    p_new_residents: offer.newResidents ?? 0,
    p_rent_per_resident: RENT_PER_RESIDENT,
  })
  if (error) return failure(error.message)
  const result = data as { entity_id: string; price: number; credits: number; residents: number }
  return NextResponse.json({ entityId: result.entity_id, price: result.price, credits: result.credits, residents: result.residents })
}
