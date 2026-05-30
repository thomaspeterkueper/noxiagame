// app/api/game/world/route.ts
// Erstellt: 30.05.2026

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

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
  const { data: transactions } = await supabase
    .from('trade_transactions')
    .select('*, profiles(username)')
    .order('traded_at', { ascending: false })
    .limit(10)

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

  // Handelsaktivität
  if (transactions && transactions.length > 0) {
    const lastTrade = transactions[0]
    const resource = { water: 'Wasser', energy: 'Energie', metal: 'Metall' }[lastTrade.resource] ?? lastTrade.resource
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
    transactions: transactions ?? [],
    stats: {
      totalPopulation: totalPop,
      suppliedColonies: suppliedCount,
      totalColonies:   (locations ?? []).length,
      tickNumber:      tickCount,
    },
  })
}