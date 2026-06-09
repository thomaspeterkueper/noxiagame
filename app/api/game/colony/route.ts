// app/api/game/colony/route.ts
// Colony View API — vollständig autark, kein DashboardClient-Kontext
// GET: öffentliche Kolonie-Daten + Governor-Daten wenn berechtigt
// POST (als GET mit action=): Steuersätze setzen (nur Governor)
//
// FIX 08.06.2026: Spalten-/Tabellennamen an das echte Schema angepasst.
//   - location_resources / market_prices / trade_orders nutzen die Spalte
//     `resource` (nicht `resource_type`); die Auftragstabelle heißt
//     `trade_orders` (nicht `orders`).
//   - Per PostgREST-Alias `resource_type:resource` bleibt die JSON-Antwort
//     unverändert (resource_type), damit ColonyView.tsx nicht angefasst werden muss.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
// server.ts exportiert createClient (async, cookie-basiert) — hier als
// createServerClient aliasiert, damit der Aufrufname sprechend bleibt.
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const slug    = searchParams.get('slug')
  const action  = searchParams.get('action')

  if (!slug) {
    return NextResponse.json({ error: 'slug required' }, { status: 400 })
  }

  const service = createServiceClient()

  // ── 1. Kolonie-Basisdaten ─────────────────────────────────────────────────
  const { data: location, error: locErr } = await service
    .from('locations')
    .select('id, name, slug, population, population_max, governor_profile_id')
    .eq('slug', slug)
    .single()

  if (locErr || !location) {
    return NextResponse.json({ error: 'Kolonie nicht gefunden' }, { status: 404 })
  }

  // ── 2. Action: Steuersätze setzen ────────────────────────────────────────
  if (action === 'setTax') {
    return handleSetTax(req, searchParams, location, service)
  }

  // ── 3. Öffentliche Daten zusammenstellen ─────────────────────────────────
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
    // Lagerbestände  (Spalte heißt `resource`, Alias → resource_type)
    service
      .from('location_resources')
      .select('resource_type:resource, stock, production, consumption')
      .eq('location_id', locationId),

    // Marktpreise  (Spalte heißt `resource`, Alias → resource_type)
    service
      .from('market_prices')
      .select('resource_type:resource, buy_price, sell_price')
      .eq('location_id', locationId),

    // Aktive Aufträge  (Tabelle heißt `trade_orders`, Spalte `resource`)
    service
      .from('trade_orders')
      .select('id, resource_type:resource, amount, reward, expires_at')
      .eq('location_id', locationId)
      .eq('status', 'open')
      .order('reward', { ascending: false })
      .limit(10),

    // Steuereinstellungen
    service
      .from('colony_settings')
      .select('tax_property, tax_transaction, tax_landing, updated_at')
      .eq('location_id', locationId)
      .single(),

    // Zölle  (eigene Tabelle, nutzt resource_type by design)
    service
      .from('colony_tariffs')
      .select('resource_type, rate')
      .eq('location_id', locationId),

    // Treasury-Übersicht
    service
      .from('colony_treasury')
      .select('total_income, total_expenses, balance, last_tick')
      .eq('location_id', locationId)
      .single(),

    // Top-Eigentümer (aggregiert)
    service
      .from('tile_entities')
      .select('profile_id, profiles(username)')
      .eq('location_id', locationId)
      .eq('entity_type', 'building')
      .not('profile_id', 'is', null),

    // Governor-Profil
    location.governor_profile_id
      ? service
          .from('profiles')
          .select('id, username')
          .eq('id', location.governor_profile_id)
          .single()
      : Promise.resolve({ data: null, error: null }),
  ])

  // Top-Eigentümer aggregieren
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

  // Aktuelle Session prüfen: ist der Aufrufer der Governor?
  let isGovernor = false
  let currentUserId: string | null = null
  try {
    const supabase = await createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    currentUserId = session?.user?.id ?? null
    isGovernor = !!currentUserId && currentUserId === location.governor_profile_id
  } catch {
    // Nicht eingeloggt — kein Problem, Colony View ist öffentlich
  }

  return NextResponse.json({
    location: {
      id:              location.id,
      name:            location.name,
      slug:            location.slug,
      population:      location.population,
      population_max:  location.population_max,
    },
    governor: governorProfileRes.data ?? null,
    isGovernor,
    currentUserId,
    resources:   resourcesRes.data  ?? [],
    prices:      pricesRes.data     ?? [],
    orders:      ordersRes.data     ?? [],
    settings:    settingsRes.data   ?? { tax_property: 0, tax_transaction: 0, tax_landing: 0 },
    tariffs:     tariffRes.data     ?? [],
    treasury:    treasuryRes.data   ?? { total_income: 0, total_expenses: 0, balance: 0, last_tick: null },
    topOwners,
  })
}

// ── Hilfsfunktion: Steuersätze setzen ────────────────────────────────────────
async function handleSetTax(
  req: NextRequest,
  params: URLSearchParams,
  location: { id: string; governor_profile_id: string | null },
  service: ReturnType<typeof createServiceClient>
) {
  // Auth prüfen
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

  const taxProperty    = parseFloat(params.get('tax_property')    ?? '0')
  const taxTransaction = parseFloat(params.get('tax_transaction') ?? '0')
  const taxLanding     = parseFloat(params.get('tax_landing')     ?? '0')

  // Validierung
  if (
    isNaN(taxProperty)    || taxProperty    < 0 ||
    isNaN(taxTransaction) || taxTransaction < 0 || taxTransaction > 1 ||
    isNaN(taxLanding)     || taxLanding     < 0
  ) {
    return NextResponse.json({ error: 'Ungültige Steuersätze' }, { status: 400 })
  }

  const { error } = await service
    .from('colony_settings')
    .update({
      tax_property:    taxProperty,
      tax_transaction: taxTransaction,
      tax_landing:     taxLanding,
      updated_at:      new Date().toISOString(),
      updated_by:      userId,
    })
    .eq('location_id', location.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
