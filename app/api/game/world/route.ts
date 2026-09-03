// app/api/game/world/route.ts
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { runDueTicks } from '@/lib/game/tick'
import { runPopulationTick } from '@/lib/game/population'

const GROUP_WINDOW_MS = 60_000

function groupTransactions(rows: any[]): any[] {
  const grouped: any[] = []
  for (const t of rows) {
    const last = grouped[grouped.length - 1]
    const sameKind = last && last.profile_id === t.profile_id && last.resource === t.resource && last.from_location === t.from_location && last.to_location === t.to_location && Math.abs(new Date(last.traded_at).getTime() - new Date(t.traded_at).getTime()) <= GROUP_WINDOW_MS
    if (sameKind) { last.amount += t.amount; last.profit += t.profit; last._count = (last._count ?? 1) + 1 }
    else grouped.push({ ...t, _count: 1 })
  }
  return grouped
}

export async function GET() {
  const supabase = createServiceClient()
  try { await runDueTicks(supabase) } catch (err) { console.error('runDueTicks (world heartbeat) error:', err) }

  const { data: lastTickRow } = await supabase.from('tick_log').select('tick_number').order('tick_number', { ascending: false }).limit(1).maybeSingle()
  const tickCount = Number(lastTickRow?.tick_number ?? 0)
  try { await runPopulationTick(supabase, tickCount) } catch (err) { console.error('runPopulationTick (world heartbeat) error:', err) }

  const { data: locations } = await supabase.from('locations').select('*, location_resources(resource, stock, consumption, production)').order('slug')
  const { data: rawTransactions } = await supabase.from('trade_transactions').select('*, profiles(username)').order('traded_at', { ascending: false }).limit(40)
  const transactions = groupTransactions(rawTransactions ?? [])
  const { data: celestialBodies } = await supabase.from('celestial_bodies').select('*').order('orbit_radius_au', { ascending: true })

  // Buildings and infrastructure are both world entities. The isometric renderer
  // needs roads to derive connectivity; filtering to buildings made the new
  // Sauerland road assets unreachable and forced visual fallbacks.
  const { data: allEntities } = await supabase
    .from('tile_entities')
    .select('id, profile_id, owner_class, owner_id, actor_id, occupant_id, entity_type, entity_id, tile_level, tile_row, tile_col, location_id, built_at, asking_price, lease_price, profiles(username), locations(id, slug, name), actors(display_name)')
    .in('entity_type', ['building', 'road'])
    .order('built_at', { ascending: true })

  const { data: facilities, error: facilitiesError } = await supabase.from('facility_instances').select('id, seed_key, location_id, facility_type, name, owner_class, owner_id, operator_id, public_access, facility_modules(id, seed_key, definition_key, tile_entity_id, operator_id, occupant_id, public_access)').order('created_at', { ascending: true })
  const { data: facilityModuleDefinitions, error: facilityDefinitionsError } = await supabase.from('facility_module_definitions').select('key, name, facility_type, role, description, footprint, capacity, capabilities, allowed_locations, requires_facility, adjacent_roles, buildable, balancing_status').order('facility_type').order('role')
  if (facilitiesError) console.warn('facility_instances unavailable:', facilitiesError.message)
  if (facilityDefinitionsError) console.warn('facility_module_definitions unavailable:', facilityDefinitionsError.message)

  const liveLocations = (locations ?? []).filter((loc: any) => loc.simulate_tick !== false)
  const news: { type: string; text: string; icon: string }[] = []
  for (const loc of liveLocations) {
    const name = loc.name ?? (loc.slug === 'moon' ? 'Mond' : loc.slug === 'mars' ? 'Mars' : loc.slug)
    const icon = loc.slug === 'moon' ? '🌙' : loc.slug === 'mars' ? '🔴' : loc.slug === 'phobos' ? '🪨' : '🪐'
    if (!loc.is_supplied) news.push({ type: 'danger', icon, text: `${name} meldet Versorgungsengpass` })
    const water = loc.location_resources?.find((r: any) => r.resource === 'water')
    if (water && water.stock < 50) news.push({ type: 'warning', icon: '💧', text: `${name}: Wasserreserven kritisch (${water.stock}t)` })
    const popPct = Math.round((loc.population / Math.max(1, loc.population_max)) * 100)
    if (popPct > 80) news.push({ type: 'warning', icon: '👥', text: `${name} nähert sich Bevölkerungsgrenze (${popPct}%)` })
    if (loc.is_supplied && loc.population > 1000) news.push({ type: 'success', icon, text: `${name} wächst – ${loc.population.toLocaleString('de')} Einwohner` })
  }
  if (transactions.length > 0) {
    const lastTrade = transactions[0]
    const RESOURCE_LABELS: Record<string, string> = { water: 'Wasser', energy: 'Energie', metal: 'Metall' }
    const resource = RESOURCE_LABELS[String(lastTrade.resource)] ?? String(lastTrade.resource)
    news.push({ type: 'info', icon: '📦', text: `${lastTrade.profiles?.username ?? 'Pilot'} handelte ${lastTrade.amount}t ${resource}` })
  }
  if (news.length === 0) { news.push({ type: 'success', icon: '🟢', text: 'Alle Kolonien stabil versorgt' }); news.push({ type: 'info', icon: '📈', text: 'Handelsvolumen im Sonnensystem steigt' }) }

  const totalPop = liveLocations.reduce((s: number, l: any) => s + Number(l.population ?? 0), 0)
  const suppliedCount = liveLocations.filter((l: any) => l.is_supplied).length
  return NextResponse.json({ news: news.slice(0, 5), locations: locations ?? [], transactions: transactions.slice(0, 10), entities: allEntities ?? [], facilities: facilities ?? [], facilityModuleDefinitions: facilityModuleDefinitions ?? [], celestialBodies: celestialBodies ?? [], stats: { totalPopulation: totalPop, suppliedColonies: suppliedCount, totalColonies: liveLocations.length, tickNumber: tickCount } })
}
