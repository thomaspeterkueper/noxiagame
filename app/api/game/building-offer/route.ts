// app/api/game/building-offer/route.ts
// Reale Gebäude der Erdkarte kaufen und (nur eigene, gekaufte) abreißen
// (Thomas, 25.10.2026; Request R-12, docs/workstreams/population-economy.md).
//
// GET  ?source=osm:way:123          → Angebot: Preis, Verkäufer, Bewohner, Miete – oder warum nicht verkäuflich
// POST { source }                    → kaufen (Preis rechnet der Server neu, Buchung atomar in buy_earth_building)
// POST { action: 'demolish', entityId } → eigenes gekauftes Gebäude abreißen (demolish_earth_building);
//                                        Bewohner ziehen in staatlichen Wohnraum
// POST { action: 'convert', entityId, type } → Nutzung ändern. Lokale (Café, Bar, Restaurant, Hotel):
//                                        Umbau mit vollen Baukosten und Bauzeit (start_earth_venue_conversion, R-13);
//                                        andere Nutzungen: halbe Baukosten, sofort (convert_earth_building)
// GET  ?conversions=<entityId>           → Nutzungen, die in das gekaufte Gebäude passen
// POST { action: 'list', entityId, price } / { action: 'unlist', entityId } → eigenes Haus (ohne Kataster) anbieten
// POST { action: 'buy-listed', entityId, price } → von einem Spieler angebotenes Haus kaufen (Geld an ihn)
//
// Maße und Preis kommen aus den gespeicherten OSM-Daten (lib/worldlab/buildingOffer.ts),
// nie aus Angaben des Spielers.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { getBuildingFootprint } from '@/lib/game/spatial/footprints'
import { acquireItem, offerFor, type Supabase } from '@/lib/worldlab/buildingOffer.server'
import { parcelAt } from '@/lib/worldlab/parcelOffer.server'
import { isVenueUsage, venueConversionBlocker, venuePlan } from '@/lib/worldlab/venueConversion'

const SOURCE = /^osm:(way|relation):\d+$/
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
  NOXIA_CONVERSION_PENDING: [409, 'Das Gebäude wird gerade umgebaut.'],
  NOXIA_BUILDING_IS_REAL_VENUE: [409, 'Das Haus ist schon ein Lokal und gehört dem Ort.'],
  NOXIA_PROPERTY_NOT_OWNED: [403, 'Das Gebäude gehört dir nicht.'],
  NOXIA_SOLD_WITH_PARCEL: [409, 'Dieses Haus wird mit dem Flurstück verkauft.'],
  NOXIA_LISTING_NOT_FOUND: [409, 'Das Angebot gibt es nicht mehr.'],
  NOXIA_OWN_LISTING: [409, 'Das ist dein eigenes Angebot.'],
  NOXIA_PRICE_CHANGED: [409, 'Der Preis hat sich geändert – bitte neu ansehen.'],
  NOXIA_PRICE_INVALID: [400, 'Ungültiger Preis.'],
}
function failure(message: string) {
  const code = Object.keys(ERRORS).find(key => message.includes(key))
  const [status, text] = code ? ERRORS[code] : [500, 'Vorgang fehlgeschlagen.']
  return NextResponse.json({ error: text, code: code ?? null }, { status })
}

type Conversion = { id: string; name: string; cost: number; buildTicks: number; venue: boolean; note?: string; plan?: ReturnType<typeof venuePlan> }

/**
 * Nutzungen, die in ein gekauftes Gebäude passen.
 * Lokale (R-13): volle Baukosten und Bauzeit, Mindestgröße statt Musterfläche,
 * nicht für Häuser, die laut Kartendaten schon Lokal sind. Personal-, Gäste-
 * und Wohnplätze nach Größe des Hauses (lib/worldlab/venueConversion.ts).
 * Andere Nutzungen: halber Neubaupreis, sofort (R-12).
 */
async function conversions(supabase: Supabase, entityId: string): Promise<Conversion[]> {
  const { data: row } = await supabase.from('tile_entities').select('entity_id,footprint_width_m,footprint_depth_m,source_ref,source_tags,building_levels,conversion_plan').eq('id', entityId).maybeSingle()
  if (!row?.source_ref || row.conversion_plan) return []
  const width = Number(row.footprint_width_m), depth = Number(row.footprint_depth_m)
  const long = Math.max(width, depth) + 2
  const short = Math.min(width, depth) + 2
  let tags = (row.source_tags ?? null) as Record<string, unknown> | null
  let levels = row.building_levels == null ? null : Number(row.building_levels)
  if (!tags || levels == null) {
    // Ohne gespeicherte Tags oder Geschosse: aus den Kartendaten (wie beim Kauf).
    const offer = await offerFor(supabase, String(row.source_ref))
    tags = tags ?? offer.tags ?? null
    levels = levels ?? offer.facts?.levels ?? 1
  }
  // Grundfläche wie im Innenraum (footprint_width_m × footprint_depth_m).
  const areaM2 = width * depth
  const { count: residents } = await supabase.from('person_assignments').select('id', { count: 'exact', head: true })
    .eq('tile_entity_id', entityId).eq('is_active', true).eq('assignment_type', 'home')
  const { data: definitions } = await supabase.from('building_definitions').select('key,name,cost_credits,build_time_ticks,allowed_locations,category').eq('is_active', true)
  return (definitions ?? []).flatMap((def): Conversion[] => {
    const key = String(def.key)
    const allowed = def.allowed_locations as string[] | null
    if (allowed?.length && !allowed.includes('earth')) return []
    if (key === row.entity_id || def.category === 'unique' || /spaceport|pad|landing|dock|harbour/.test(key)) return []
    if (isVenueUsage(key)) {
      if (venueConversionBlocker(key, { areaM2, tags, currentUsage: String(row.entity_id) })) return []
      const plan = venuePlan(key, { areaM2, levels, residents: residents ?? 0 })
      const note = [`${plan.staffCapacity} Personal`, plan.transientCapacity ? `${plan.transientCapacity} Zimmer` : null, plan.residentialCapacity ? `${plan.residentialCapacity} Wohnplätze` : null].filter(Boolean).join(' · ')
      return [{ id: key, name: String(def.name), cost: plan.cost, buildTicks: plan.buildTicks, venue: true, note, plan }]
    }
    const footprint = getBuildingFootprint(key)
    if (Math.max(footprint.widthM, footprint.depthM) > long || Math.min(footprint.widthM, footprint.depthM) > short) return []
    return [{ id: key, name: String(def.name), cost: Math.round(Number(def.cost_credits ?? 0) * CONVERSION_SHARE), buildTicks: 0, venue: false }]
  }).sort((a, b) => a.cost - b.cost)
}

export async function GET(req: NextRequest) {
  const convertFor = req.nextUrl.searchParams.get('conversions')
  if (convertFor) {
    if (!await verifiedBearerUserId(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const list = (await conversions(createServiceClient(), convertFor)).map(item => ({ id: item.id, name: item.name, cost: item.cost, buildTicks: item.buildTicks, venue: item.venue, note: item.note }))
    return NextResponse.json({ conversions: list }, { headers: { 'Cache-Control': 'no-store' } })
  }
  const source = String(req.nextUrl.searchParams.get('source') ?? '')
  if (!SOURCE.test(source)) return NextResponse.json({ forSale: false, reason: 'unbekanntes Gebäude' })
  const supabase = createServiceClient()
  const offer = await offerFor(supabase, source)
  // Wo es Flurstücke gibt, kauft man das Flurstück samt Haus (Thomas, 25.10.2026).
  const parcel = offer.facts ? await parcelAt(supabase, offer.facts.centre) : null
  if (parcel) return NextResponse.json({ forSale: false, parcelId: parcel.id, reason: 'wird mit dem Flurstück verkauft', name: offer.name }, { headers: { 'Cache-Control': 'no-store' } })
  // Gehört einem Spieler: vielleicht bietet er es an
  const { data: entity } = await supabase.from('tile_entities').select('id,profile_id,profiles(username)').eq('source_ref', source).maybeSingle()
  // Nur Spielerbesitz (Lokale des Ortes u. Ä. haben keinen Spieler als Eigentümer)
  if (entity?.profile_id) {
    const profileId = req.headers.get('authorization') ? await verifiedBearerUserId(req) : null
    const own = entity.profile_id === profileId
    const owner = (entity as { profiles?: { username?: string } | null }).profiles?.username ?? 'ein anderer Spieler'
    const { data: listing } = await supabase.from('earth_property_listings').select('price').eq('kind', 'building').eq('ref', entity.id).maybeSingle()
    return NextResponse.json({
      forSale: Boolean(listing) && !own, listed: Boolean(listing), own, entityId: entity.id, price: listing ? Number(listing.price) : undefined,
      seller: own ? 'du' : owner, reason: own ? (listing ? 'von dir angeboten' : 'gehört dir') : listing ? undefined : `gehört ${owner}`, name: offer.name,
      areaM2: offer.facts?.areaM2, levels: offer.facts?.levels,
    }, { headers: { 'Cache-Control': 'no-store' } })
  }
  return NextResponse.json({
    forSale: offer.forSale, reason: offer.reason, price: offer.price, seller: offer.seller,
    residents: offer.residents, newResidents: offer.newResidents, rentPerInterval: offer.rentPerInterval, name: offer.name,
    areaM2: offer.facts?.areaM2, levels: offer.facts?.levels, location: offer.location,
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

  if (body.action === 'list' || body.action === 'unlist') {
    const price = body.action === 'list' ? Math.round(Number((body as { price?: number }).price)) : null
    if (!body.entityId) return NextResponse.json({ error: 'Gebäude fehlt.' }, { status: 400 })
    if (body.action === 'list' && !(Number.isFinite(price) && price! >= 1)) return NextResponse.json({ error: 'Bitte einen Preis angeben.' }, { status: 400 })
    const { data, error } = await supabase.rpc('list_earth_property', { p_profile_id: profileId, p_kind: 'building', p_ref: body.entityId, p_price: price })
    if (error) return failure(error.message)
    return NextResponse.json(data)
  }

  if (body.action === 'buy-listed') {
    const price = Math.round(Number((body as { price?: number }).price))
    if (!body.entityId || !Number.isFinite(price)) return NextResponse.json({ error: 'Gebäude oder Preis fehlt.' }, { status: 400 })
    const { data, error } = await supabase.rpc('buy_listed_earth_property', { p_buyer_id: profileId, p_kind: 'building', p_ref: body.entityId, p_price: price })
    if (error) return failure(error.message)
    return NextResponse.json(data)
  }

  if (body.action === 'convert') {
    const type = String((body as { type?: string }).type ?? '')
    if (!body.entityId || !type) return NextResponse.json({ error: 'Gebäude oder Nutzung fehlt.' }, { status: 400 })
    const option = (await conversions(supabase, body.entityId)).find(item => item.id === type)
    if (!option) return NextResponse.json({ error: 'Diese Nutzung passt nicht in das Gebäude.' }, { status: 409 })
    if (option.venue && option.plan) {
      const { data, error } = await supabase.rpc('start_earth_venue_conversion', {
        p_profile_id: profileId, p_entity_id: body.entityId, p_type: type, p_cost: option.plan.cost, p_build_ticks: option.plan.buildTicks,
        p_staff_capacity: option.plan.staffCapacity, p_transient_capacity: option.plan.transientCapacity, p_residential_capacity: option.plan.residentialCapacity,
      })
      if (error) return failure(error.message)
      return NextResponse.json(data)
    }
    const { data, error } = await supabase.rpc('convert_earth_building', { p_profile_id: profileId, p_entity_id: body.entityId, p_type: type, p_cost: option.cost })
    if (error) return failure(error.message)
    return NextResponse.json(data)
  }

  const source = String(body.source ?? '')
  if (!SOURCE.test(source)) return NextResponse.json({ error: 'Unbekanntes Gebäude.' }, { status: 400 })
  const offer = await offerFor(supabase, source)
  if (!offer.forSale || !offer.facts || !offer.price) return NextResponse.json({ error: `Nicht verkäuflich: ${offer.reason ?? 'unbekannt'}` }, { status: 409 })
  if (await parcelAt(supabase, offer.facts.centre)) return NextResponse.json({ error: 'Dieses Haus wird mit dem Flurstück verkauft.' }, { status: 409 })
  const item = await acquireItem(supabase, source, offer)
  const { data, error } = await supabase.rpc('buy_earth_building', {
    p_profile_id: profileId, p_source_ref: source, p_price: offer.price,
    p_latitude: item.lat, p_longitude: item.lon, p_width: item.w, p_depth: item.d, p_rotation: item.rotation,
    p_display_name: item.name, p_region_slug: item.region, p_x_m: item.x, p_y_m: item.y,
    p_residential_capacity: item.capacity, p_feature_ids: item.features, p_new_residents: item.residents, p_rent_per_resident: item.rent,
  })
  if (error) return failure(error.message)
  const result = data as { entity_id: string; price: number; credits: number; residents: number }
  return NextResponse.json({ entityId: result.entity_id, price: result.price, credits: result.credits, residents: result.residents })
}
