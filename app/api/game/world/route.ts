// app/api/game/world/route.ts
// Erstellt:     30.05.2026
// Aktualisiert: 28.08.2026 — Referenzorte (z. B. Erde) aus Live-Koloniestatistik entfernt
// Version:      0.11.0
//
// v0.3.0: HERZSCHLAG der Lazy-Tick-Engine. Vor dem Laden der Weltdaten
// werden fällige Ticks via runDueTicks() nachgerechnet (claim_due_ticks
// serialisiert über Advisory Lock — kein Doppellauf bei parallelen Requests).
// Außerdem: Tick-Anzeige liest jetzt aus tick_log statt der alten
// simulation_ticks-Tabelle.
// v0.2.0: 1t-Transaktionen werden zusammengefasst (groupTransactions).

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { runDueTicks } from '@/lib/game/tick'
import { runPopulationTick } from '@/lib/game/population'

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

  // ── HERZSCHLAG: fällige Ticks nachrechnen, BEVOR Daten geladen werden ──────
  // Idempotent & serialisiert (claim_due_ticks via Advisory Lock). Schlägt der
  // Tick fehl, liefern wir trotzdem die (alten) Weltdaten aus statt 500.
  try {
    await runDueTicks(supabase)
  } catch (err) {
    console.error('runDueTicks (world heartbeat) error:', err)
  }

  // Aktuelle Tick-Nummer aus tick_log (nicht mehr simulation_ticks)
  const { data: lastTickRow } = await supabase
    .from('tick_log')
    .select('tick_number')
    .order('tick_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  const tickCount = Number(lastTickRow?.tick_number ?? 0)

  // Living Population läuft auf demselben Welt-Herzschlag. Ein Fehler darf
  // niemals den restlichen Dashboard-Load blockieren.
  try {
    await runPopulationTick(supabase, tickCount)
  } catch (err) {
    console.error('runPopulationTick (world heartbeat) error:', err)
  }

  // Aktuelle Koloniedaten
  const { data: locations } = await supabase
    .from('locations')
    .select('*, location_resources(resource, stock, consumption, production)')
    .order('slug')

  // Letzte Transaktionen
  const { data: rawTransactions } = await supabase
    .from('trade_transactions')
    .select('*, profiles(username)')
    .order('traded_at', { ascending: false })
    .limit(40)

  const transactions = groupTransactions(rawTransactions ?? [])

  // ── celestial_bodies — alle Himmelskörper ────────────────────────────────────
  const { data: celestialBodies } = await supabase
    .from('celestial_bodies')
    .select('*')
    .order('orbit_radius_au', { ascending: true })

  // ── Multiplayer: tile_entities aller Spieler + Staatliche Gebäude ──────────
  const { data: allEntities } = await supabase
    .from('tile_entities')
    .select('id, profile_id, owner_class, owner_id, actor_id, occupant_id, entity_type, entity_id, tile_level, tile_row, tile_col, location_id, built_at, asking_price, lease_price, profiles(username), locations(id, slug, name), actors(display_name)')
    .eq('entity_type', 'building')
    .order('built_at', { ascending: true })

  // Nur tatsächlich simulierte Siedlungen gehören in Live-Statistik und Feed.
  // Referenzorte wie Erde dürfen weder die Einwohnerzahl verfälschen noch
  // Versorgungswarnungen erzeugen.
  const liveLocations = (locations ?? []).filter((loc: any) => loc.simulate_tick !== false)

  const news: { type: string; text: string; icon: string }[] = []
  for (const loc of liveLocations) {
    const name = loc.name ?? (loc.slug === 'moon' ? 'Mond' : loc.slug === 'mars' ? 'Mars' : loc.slug)
    const icon = loc.slug === 'moon' ? '🌙' : loc.slug === 'mars' ? '🔴' : loc.slug === 'phobos' ? '🪨' : '🪐'
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

  if (news.length === 0) {
    news.push({ type: 'success', icon: '🟢', text: 'Alle Kolonien stabil versorgt' })
    news.push({ type: 'info', icon: '📈', text: 'Handelsvolumen im Sonnensystem steigt' })
  }

  const totalPop = liveLocations.reduce((s: number, l: any) => s + Number(l.population ?? 0), 0)
  const suppliedCount = liveLocations.filter((l: any) => l.is_supplied).length

  return NextResponse.json({
    news:         news.slice(0, 5),
    locations:    locations ?? [],
    transactions: transactions.slice(0, 10),
    entities:     allEntities ?? [],
    celestialBodies: celestialBodies ?? [],
    stats: {
      totalPopulation:  totalPop,
      suppliedColonies: suppliedCount,
      totalColonies:    liveLocations.length,
      tickNumber:       tickCount,
    },
  })
}
