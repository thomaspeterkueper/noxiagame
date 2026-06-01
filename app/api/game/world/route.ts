// app/api/game/world/route.ts
// Erstellt:     30.05.2026
// Aktualisiert: 01.06.2026
// Version:      0.2.0
//
// v0.2.0: Aufeinanderfolgende 1t-Transaktionen werden zusammengefasst.
// Grund: Der Kauf-/Verkauf-Loop im Client bucht jede Tonne als eigenen
// API-Call → ein 4t-Kauf erzeugt vier identische Transaktionszeilen.
// groupTransactions() fasst Einträge zusammen, die von DEMSELBEN Piloten,
// für DIESELBE Ressource, mit gleicher Richtung (from/to) und innerhalb
// eines kurzen Zeitfensters (GROUP_WINDOW_MS) stammen. amount und profit
// werden summiert. Echte, getrennte Handelsaktionen bleiben getrennt.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// Zeitfenster, innerhalb dessen gleichartige Transaktionen als eine gelten.
const GROUP_WINDOW_MS = 60_000  // 60 Sekunden

// Fasst aufeinanderfolgende gleichartige Transaktionen zu einer zusammen.
// Erwartet die Liste in absteigender Zeitsortierung (neueste zuerst).
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
      // Zeitabstand klein genug? (traded_at als ISO-String)
      Math.abs(new Date(last.traded_at).getTime() - new Date(t.traded_at).getTime()) <= GROUP_WINDOW_MS

    if (sameKind) {
      // In bestehende Gruppe einrechnen
      last.amount += t.amount
      last.profit += t.profit
      last._count = (last._count ?? 1) + 1
    } else {
      // Neue Gruppe (Kopie, damit wir das Original nicht mutieren)
      grouped.push({ ...t, _count: 1 })
    }
  }

  return grouped
}

export async function GET() {
  const supabase = createServiceClient()

  // Letzte 2 Ticks laden
  const { data: ticks } = await supabase
    .from('simulation_ticks')
    .select('*')
    .order('tick_number', { ascending: false })
    .limit(2)

  // Aktuelle Koloniedaten
  const { data: locations } = await supabase
    .from('locations')
    .select('*, location_resources(resource, stock, consumption, production)')
    .order('slug')

  // Letzte Transaktionen (Handelsgeschichte)
  // Mehr Rohzeilen laden, weil das Zusammenfassen die Anzahl reduziert.
  const { data: rawTransactions } = await supabase
    .from('trade_transactions')
    .select('*, profiles(username)')
    .order('traded_at', { ascending: false })
    .limit(40)

  // ── NEU: 1t-Loops zu sinnvollen Einträgen zusammenfassen ──────────────────
  const transactions = groupTransactions(rawTransactions ?? [])

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

  // Handelsaktivität (nutzt die zusammengefasste Liste)
  if (transactions.length > 0) {
    const lastTrade = transactions[0]
    const RESOURCE_LABELS: Record<string, string> = {
      water: 'Wasser',
      energy: 'Energie',
      metal: 'Metall',
    }
    const resource = RESOURCE_LABELS[String(lastTrade.resource)] ?? String(lastTrade.resource)
    news.push({
      type: 'info',
      icon: '📦',
      text: `${lastTrade.profiles?.username ?? 'Pilot'} handelte ${lastTrade.amount}t ${resource}`,
    })
  }

  if (news.length === 0) {
    news.push({ type: 'success', icon: '🟢', text: 'Alle Kolonien stabil versorgt' })
    news.push({ type: 'info', icon: '📈', text: 'Handelsvolumen im Sonnensystem steigt' })
  }

  // Weltstatistiken
  const totalPop = (locations ?? []).reduce((s: number, l: any) => s + l.population, 0)
  const suppliedCount = (locations ?? []).filter((l: any) => l.is_supplied).length
  const lastTick = ticks?.[0]
  const tickCount = lastTick?.tick_number ?? 0

  return NextResponse.json({
    news:         news.slice(0, 5),
    locations:    locations ?? [],
    transactions: transactions.slice(0, 10),  // nach dem Gruppieren auf 10 kürzen
    stats: {
      totalPopulation: totalPop,
      suppliedColonies: suppliedCount,
      totalColonies:   (locations ?? []).length,
      tickNumber:      tickCount,
    },
  })
}
