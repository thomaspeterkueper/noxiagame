// app/api/game/colony/route.ts
// Colony management/read-model API.
//
// The former public /colony/[slug] page has been retired. This endpoint remains
// because colony economy/governance is NOXIA domain logic and can be consumed by
// authenticated dashboard/admin surfaces without maintaining a second colony UI.
// GET: colony economy/governance snapshot
// GET ?action=setTax: mutate tax settings (governor only)

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug')
  const action = searchParams.get('action')

  if (!slug) {
    return NextResponse.json({ error: 'slug required' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: location, error: locErr } = await service
    .from('locations')
    .select('id, name, slug, population, population_max, governor_profile_id')
    .eq('slug', slug)
    .single()

  if (locErr || !location) {
    return NextResponse.json({ error: 'Kolonie nicht gefunden' }, { status: 404 })
  }

  if (action === 'setTax') {
    return handleSetTax(req, searchParams, location, service)
  }

  const locationId = location.id

  const [
    resourcesRes,
    pricesRes,
    ordersRes,
    settingsRes,
    tariffRes,
    treasuryRes,
    buildingsRes,
    governorProfileRes,
  ] = await Promise.all([
    service
      .from('location_resources')
      .select('resource_type:resource, stock, production, consumption')
      .eq('location_id', locationId),

    service
      .from('market_prices')
      .select('resource_type:resource, buy_price, sell_price')
      .eq('location_id', locationId),

    service
      .from('trade_orders')
      .select('id, resource_type:resource, amount, reward, expires_at')
      .eq('location_id', locationId)
      .eq('status', 'open')
      .order('reward', { ascending: false })
      .limit(10),

    service
      .from('colony_settings')
      .select('tax_property, tax_transaction, tax_landing, updated_at')
      .eq('location_id', locationId)
      .single(),

    service
      .from('colony_tariffs')
      .select('resource_type, rate')
      .eq('location_id', locationId),

    service
      .from('colony_treasury')
      .select('total_income, total_expenses, balance, last_tick')
      .eq('location_id', locationId)
      .single(),

    service
      .from('tile_entities')
      .select('profile_id, profiles(username)')
      .eq('location_id', locationId)
      .eq('entity_type', 'building')
      .not('profile_id', 'is', null),

    location.governor_profile_id
      ? service
          .from('profiles')
          .select('id, username')
          .eq('id', location.governor_profile_id)
          .single()
      : Promise.resolve({ data: null, error: null }),
  ])

  const ownerMap: Record<string, { username: string; count: number }> = {}
  for (const row of buildingsRes.data ?? []) {
    const pid = row.profile_id as string
    const username = (row.profiles as any)?.username ?? 'Unbekannt'
    if (!ownerMap[pid]) ownerMap[pid] = { username, count: 0 }
    ownerMap[pid].count++
  }
  const topOwners = Object.entries(ownerMap)
    .map(([profile_id, v]) => ({ profile_id, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  let isGovernor = false
  let currentUserId: string | null = null
  try {
    const supabase = await createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    currentUserId = session?.user?.id ?? null
    isGovernor = !!currentUserId && currentUserId === location.governor_profile_id
  } catch {
    // Anonymous reads remain allowed for now; write authorization is enforced below.
  }

  return NextResponse.json({
    location: {
      id: location.id,
      name: location.name,
      slug: location.slug,
      population: location.population,
      population_max: location.population_max,
    },
    governor: governorProfileRes.data ?? null,
    isGovernor,
    currentUserId,
    resources: resourcesRes.data ?? [],
    prices: pricesRes.data ?? [],
    orders: ordersRes.data ?? [],
    settings: settingsRes.data ?? { tax_property: 0, tax_transaction: 0, tax_landing: 0 },
    tariffs: tariffRes.data ?? [],
    treasury: treasuryRes.data ?? { total_income: 0, total_expenses: 0, balance: 0, last_tick: null },
    topOwners,
  })
}

async function handleSetTax(
  req: NextRequest,
  params: URLSearchParams,
  location: { id: string; governor_profile_id: string | null },
  service: ReturnType<typeof createServiceClient>,
) {
  let userId: string | null = null
  try {
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await service.auth.getUser(token)
    userId = user?.id ?? null
  } catch {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  if (!userId || userId !== location.governor_profile_id) {
    return NextResponse.json({ error: 'Nur der Governor darf Steuern setzen' }, { status: 403 })
  }

  const taxProperty = parseFloat(params.get('tax_property') ?? '0')
  const taxTransaction = parseFloat(params.get('tax_transaction') ?? '0')
  const taxLanding = parseFloat(params.get('tax_landing') ?? '0')

  if (
    isNaN(taxProperty) || taxProperty < 0 ||
    isNaN(taxTransaction) || taxTransaction < 0 || taxTransaction > 1 ||
    isNaN(taxLanding) || taxLanding < 0
  ) {
    return NextResponse.json({ error: 'Ungültige Steuersätze' }, { status: 400 })
  }

  const { error } = await service
    .from('colony_settings')
    .update({
      tax_property: taxProperty,
      tax_transaction: taxTransaction,
      tax_landing: taxLanding,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq('location_id', location.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
