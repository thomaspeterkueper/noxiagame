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
  const supabase = createServiceClient()
  const offer = await offerFor(supabase, source)
  // Wo es Flurstücke gibt, kauft man das Flurstück samt Haus (Thomas, 25.10.2026).
  const parcel = offer.facts ? await parcelAt(supabase, offer.facts.centre) : null
  if (parcel) return NextResponse.json({ forSale: false, parcelId: parcel.id, reason: 'wird mit dem Flurstück verkauft', name: offer.name }, { headers: { 'Cache-Control': 'no-store' } })
  // Gehört einem Spieler: vielleicht bietet er es an
  const { data: entity } = await supabase.from('tile_entities').select('id,profile_id,profiles(username)').eq('source_ref', source).maybeSingle()
  if (entity) {
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
