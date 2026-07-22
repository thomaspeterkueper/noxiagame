// app/api/game/world/route.ts
// Erstellt:     30.05.2026
// Aktualisiert: 20.07.2026 — actors(display_name) JOIN für NPC-Namen
// Version:      0.8.0
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

  // ── Multiplayer: tile_entities aller Spieler + Staatliche Gebäude ──────────
  // Liefert Gebäude für alle Kolonien — ColonyGrid kann fremde Gebäude zeigen.
  // Enthält profile_id, owner_class, entity_id, tile_row, tile_col, location_id.
  const { data: allEntities } = await supabase
    .from('tile_entities')
    .select('id, profile_id, owner_class, owner_id, actor_id, occupant_id, entity_type, entity_id, tile_level, tile_row, tile_col, location_id, built_at, asking_price, lease_price, profiles(username), locations(id, slug, name), actors(display_name)')
    .eq('entity_type', 'building')
    .order('built_at', { ascending: true })

  // Weltmeldungen generieren
  const news: { type: string; text: string; icon: string }[] = []
  for (const loc of locations ?? []) {
    const name = loc.slug === 'moon' ? 'Mond' : loc.slug === 'mars' ? 'Mars' : 'Phobos'
    const icon = loc.slug === 'moon' ? '🌙' : loc.slug === 'mars' ? '🔴' : '🪨'
    if (!loc.is_supplied) {
      news.push({ type: 'danger', icon, text: `${name} meldet Versorgungsengpass` })
    }
    const water = loc.location_resources?.find((r: any) => r.resource === 'water')
    if (water && water.stock < 50) {
      news.push({ type: 'warning', icon: '💧', text: `${name}: Wasserreserven kritisch (${water.stock}t)` })
    }
    const popPct = Math.round((loc.population / loc.population_max) * 100)
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

  const totalPop = (locations ?? []).reduce((s: number, l: any) => s + l.population, 0)
  const suppliedCount = (locations ?? []).filter((l: any) => l.is_supplied).length

  return NextResponse.json({
    news:         news.slice(0, 5),
    locations:    locations ?? [],
    transactions: transactions.slice(0, 10),
    entities:     allEntities ?? [],
    stats: {
      totalPopulation:  totalPop,
      suppliedColonies: suppliedCount,
      totalColonies:    (locations ?? []).length,
      tickNumber:       tickCount,
    },
  })
}
