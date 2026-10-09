// app/api/game/world/route.ts
// Erstellt:     30.05.2026
// Aktualisiert: 09.10.2026 — Kolonie-Chronik: NPC-Ereignisse (Begegnungen, Konflikte, Firmenverkäufe,
//               Produktion) aus population_events und npc_ledger im Feed; erfundener Fülltext entfernt
// Vorher:       28.08.2026 — Referenzorte (z. B. Erde) aus Live-Koloniestatistik entfernt
// Version:      0.12.0
//
// v0.3.0: HERZSCHLAG der Lazy-Tick-Engine. Vor dem Laden der Weltdaten
// werden fällige Ticks via runDueTicks() nachgerechnet (claim_due_ticks
// serialisiert über Advisory Lock — kein Doppellauf bei parallelen Requests).
// Außerdem: Tick-Anzeige liest jetzt aus tick_log statt der alten
// simulation_ticks-Tabelle.
// v0.2.0: 1t-Transaktionen werden zusammengefasst (groupTransactions).

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { BUILDINGS } from '@/lib/game/buildings/index'
import { economyChronicle, personChronicle, type ChronicleItem } from '@/lib/game/chronicle'

const CHRONICLE_PERSON_WINDOW_TICKS = 24
const CHRONICLE_ECONOMY_WINDOW_TICKS = 6
const SHORT_LOCATION_NAME: Record<string, string> = { moon: 'Mond', mars: 'Mars', phobos: 'Phobos', deimos: 'Deimos', earth: 'Erde' }

// Liest vorhandene Simulationsereignisse und formuliert sie als Feed-Zeilen.
// Fehler hier dürfen den Welt-Snapshot nie verhindern: dann bleibt die Chronik leer.
async function loadChronicle(supabase: ReturnType<typeof createServiceClient>, tickCount: number, locations: any[]): Promise<ChronicleItem[]> {
  try {
    const [eventsR, ledgerR] = await Promise.all([
      supabase.from('population_events')
        .select('tick, event_type, actor_person_id, related_person_id, location_id, payload')
        .in('event_type', ['person_conflict', 'social_interaction'])
        .gte('tick', tickCount - CHRONICLE_PERSON_WINDOW_TICKS)
        .order('tick', { ascending: false })
        .limit(80),
      supabase.from('npc_ledger')
        .select('tick, kind, resource, goods_delta, credit_delta, actor_id, location_id')
        .in('kind', ['sell', 'build', 'produce'])
        .gte('tick', tickCount - CHRONICLE_ECONOMY_WINDOW_TICKS)
        .order('tick', { ascending: false })
        .limit(120),
    ])
    const events = eventsR.data ?? []
    const ledger = ledgerR.data ?? []
    if (events.length === 0 && ledger.length === 0) return []

    const personIds = Array.from(new Set(events.flatMap((e: any) => [e.actor_person_id, e.related_person_id]).filter(Boolean)))
    const entityIds = Array.from(new Set(events.map((e: any) => e.payload?.tileEntityId).filter(Boolean)))
    const actorIds = Array.from(new Set(ledger.map((r: any) => r.actor_id).filter(Boolean)))

    const [peopleR, entitiesR, actorsR] = await Promise.all([
      personIds.length ? supabase.from('people').select('id, display_name').in('id', personIds) : Promise.resolve({ data: [] as any[] }),
      entityIds.length ? supabase.from('tile_entities').select('id, entity_id').in('id', entityIds) : Promise.resolve({ data: [] as any[] }),
      actorIds.length ? supabase.from('actors').select('id, display_name').in('id', actorIds) : Promise.resolve({ data: [] as any[] }),
    ])

    const people = new Map<string, string>((peopleR.data ?? []).map((p: any) => [p.id, p.display_name]))
    const entities = new Map<string, string>((entitiesR.data ?? []).map((e: any) => [e.id, e.entity_id]))
    const actors = new Map<string, string>((actorsR.data ?? []).map((a: any) => [a.id, a.display_name]))
    const locationNames = new Map<string, string>(locations.map((loc: any) => [loc.id, SHORT_LOCATION_NAME[loc.slug] ?? loc.name ?? loc.slug]))

    const lookups = {
      currentTick: tickCount,
      personName: (id: string | null) => (id ? people.get(id) : undefined),
      actorName: (id: string) => actors.get(id),
      locationName: (id: string | null) => (id ? locationNames.get(id) : undefined),
      buildingName: (tileEntityId: string | undefined) => {
        const entityId = tileEntityId ? entities.get(tileEntityId) : undefined
        return entityId ? (BUILDINGS[entityId]?.name ?? undefined) : undefined
      },
    }

    const personItems = personChronicle(events as any, lookups)
    const economyItems = economyChronicle(ledger as any, lookups)
    // Abwechselnd mischen, damit weder Personen noch Firmen den Feed allein füllen.
    const mixed: ChronicleItem[] = []
    for (let i = 0; i < Math.max(personItems.length, economyItems.length); i++) {
      if (personItems[i]) mixed.push(personItems[i])
      if (economyItems[i]) mixed.push(economyItems[i])
    }
    return mixed
  } catch (err) {
    console.error('world: chronicle failed:', err)
    return []
  }
}

const GROUP_WINDOW_MS = 60_000  // 60 Sekunden

function groupTransactions(rows: any[]): any[] {
  const grouped: any[] = []
  for (const t of rows) {
    const last = grouped[grouped.length - 1]
    const sameKind =
      last &&
      last.profile_id === t.profile_id &&
      last.resource === t.resource &&
      last.from_location === t.from_location &&
      last.to_location === t.to_location &&
      Math.abs(new Date(last.traded_at).getTime() - new Date(t.traded_at).getTime()) <= GROUP_WINDOW_MS

    if (sameKind) {
      last.amount += t.amount
      last.profit += t.profit
      last._count = (last._count ?? 1) + 1
    } else {
      grouped.push({ ...t, _count: 1 })
    }
  }
  return grouped
}

export async function GET() {
  const supabase = createServiceClient()

  // Aktuelle Tick-Nummer aus tick_log (nicht mehr simulation_ticks)
  const { data: lastTickRow } = await supabase
    .from('tick_log')
    .select('tick_number')
    .order('tick_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  const tickCount = Number(lastTickRow?.tick_number ?? 0)

  // Aktuelle Koloniedaten
  const { data: locations } = await supabase
    .from('locations')
    .select('*, location_resources(resource, stock, consumption, production)')
    .order('slug')

  // Nur die jüngste Transaktion wird hier für den globalen News-Ticker benötigt.
  // Historien/Statistiken werden über ihre eigenen Endpunkte geladen.
  const { data: rawTransactions } = await supabase
    .from('trade_transactions')
    .select('*, profiles(username)')
    .order('traded_at', { ascending: false })
    .limit(1)

  const transactions = groupTransactions(rawTransactions ?? [])

  // Nur tatsächlich simulierte Siedlungen gehören in Live-Statistik und Feed.
  // Referenzorte wie Erde dürfen weder die Einwohnerzahl verfälschen noch
  // Versorgungswarnungen erzeugen.
  const liveLocations = (locations ?? []).filter((loc: any) => loc.simulate_tick !== false)

  const news: { type: string; text: string; icon: string }[] = []
  for (const loc of liveLocations) {
    const name = loc.name ?? (loc.slug === 'moon' ? 'Mond' : loc.slug === 'mars' ? 'Mars' : loc.slug)
    const icon = loc.slug === 'moon' ? '🌙' : loc.slug === 'mars' ? '🔴' : loc.slug === 'phobos' ? '🪨' : loc.slug === 'deimos' ? '🛰️' : '🪐'
    if (!loc.is_supplied) {
      news.push({ type: 'danger', icon, text: `${name} meldet Versorgungsengpass` })
    }
    const water = loc.location_resources?.find((r: any) => r.resource === 'water')
    if (water && water.stock < 50) {
      news.push({ type: 'warning', icon: '💧', text: `${name}: Wasserreserven kritisch (${water.stock}t)` })
    }
    const popPct = Math.round((loc.population / Math.max(1, loc.population_max)) * 100)
    if (popPct > 80) {
      news.push({ type: 'warning', icon: '👥', text: `${name} nähert sich Bevölkerungsgrenze (${popPct}%)` })
    }
    if (loc.is_supplied && loc.population > 1000) {
      news.push({ type: 'success', icon, text: `${name} wächst – ${loc.population.toLocaleString('de')} Einwohner` })
    }
  }

  if (transactions.length > 0) {
    const lastTrade = transactions[0]
    const RESOURCE_LABELS: Record<string, string> = { water: 'Wasser', energy: 'Energie', metal: 'Metall' }
    const resource = RESOURCE_LABELS[String(lastTrade.resource)] ?? String(lastTrade.resource)
    news.push({
      type: 'info', icon: '📦',
      text: `${lastTrade.profiles?.username ?? 'Pilot'} handelte ${lastTrade.amount}t ${resource}`,
    })
  }

  // Warnungen zuerst (höchstens zwei), danach die Chronik, dann der Rest.
  const chronicle = await loadChronicle(supabase, tickCount, locations ?? [])
  const alerts = news.filter(n => n.type === 'danger' || n.type === 'warning').slice(0, 2)
  const rest = news.filter(n => n.type !== 'danger' && n.type !== 'warning')
  news.length = 0
  news.push(...alerts, ...chronicle, ...rest)

  if (news.length === 0) {
    news.push({ type: 'success', icon: '🟢', text: 'Alle Kolonien stabil versorgt' })
  }

  const totalPop = liveLocations.reduce((s: number, l: any) => s + Number(l.population ?? 0), 0)
  const suppliedCount = liveLocations.filter((l: any) => l.is_supplied).length

  return NextResponse.json({
    news:         news.slice(0, 8),
    chronicle,
    locations:    locations ?? [],
    transactions: transactions.slice(0, 1),
    stats: {
      totalPopulation:  totalPop,
      suppliedColonies: suppliedCount,
      totalColonies:    liveLocations.length,
      tickNumber:       tickCount,
    },
  }, {
    headers: {
      // Globaler, nicht benutzerspezifischer Snapshot. Kurzes CDN-Caching
      // verhindert, dass mehrere Tabs/Clients dieselben Tabellen gleichzeitig
      // lesen. Ably bleibt für ereignisgetriebene Aktualisierungen zuständig.
      'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
    },
  })
}
