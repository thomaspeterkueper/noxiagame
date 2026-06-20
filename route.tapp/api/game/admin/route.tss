// app/api/game/admin/route.ts
// Erstellt: 20.06.2026
// Version:  1.0.0
//
// Liefert alle Verwaltungsdaten einer Station für das Admin-Overlay.
// Öffentlich lesbar (kein Auth nötig) — Kolonie-Daten sind transparent.
//
// ?location=moon|mars|phobos

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(req.url)
  const locationSlug = searchParams.get('location')

  if (!locationSlug) {
    return NextResponse.json({ error: 'location fehlt' }, { status: 400 })
  }

  // ── Standort ─────────────────────────────────────────────────────────────
  const { data: loc } = await supabase
    .from('locations')
    .select('id, slug, name, population, population_max, is_supplied, governor_profile_id')
    .eq('slug', locationSlug)
    .single()

  if (!loc) return NextResponse.json({ error: 'Kolonie nicht gefunden' }, { status: 404 })

  // ── Governor-Name ────────────────────────────────────────────────────────
  let governorName: string | null = null
  if (loc.governor_profile_id) {
    const { data: gov } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', loc.governor_profile_id)
      .single()
    governorName = gov?.username ?? null
  }

  // ── Lagerbestand ─────────────────────────────────────────────────────────
  const { data: resources } = await supabase
    .from('location_resources')
    .select('resource, stock, consumption, production')
    .eq('location_id', loc.id)

  // ── Steuersätze ──────────────────────────────────────────────────────────
  const { data: settings } = await supabase
    .from('colony_settings')
    .select('tax_property, tax_transaction, tax_landing')
    .eq('location_id', loc.id)
    .maybeSingle()

  // ── Treasury (Lifetime-Summen aus View) ───────────────────────────────────
  const { data: treasury } = await supabase
    .from('colony_treasury')
    .select('total_income, total_expenses, balance, last_tick')
    .eq('location_id', loc.id)
    .maybeSingle()

  // ── Letzte Ledger-Einträge (Einnahmen/Ausgaben, letzte 20) ────────────────
  const { data: ledger } = await supabase
    .from('colony_ledger')
    .select('tick, entry_type, amount, note, profile_id, profiles(username)')
    .eq('location_id', loc.id)
    .order('created_at', { ascending: false })
    .limit(20)

  // ── Offene Aufträge dieser Kolonie ────────────────────────────────────────
  const { data: orders } = await supabase
    .from('trade_orders')
    .select('id, resource, amount, reward, expires_at, status, for_profile_id')
    .eq('location_id', loc.id)
    .eq('status', 'open')
    .is('for_profile_id', null)   // nur öffentliche Aufträge
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({
    location: {
      slug:          loc.slug,
      name:          loc.name,
      population:    loc.population,
      populationMax: loc.population_max,
      isSupplied:    loc.is_supplied,
      governorId:    loc.governor_profile_id,
      governorName,
    },
    resources: resources ?? [],
    settings: {
      taxProperty:    Number(settings?.tax_property    ?? 0),
      taxTransaction: Number(settings?.tax_transaction ?? 0),
      taxLanding:     Number(settings?.tax_landing     ?? 0),
    },
    treasury: {
      balance:       Number(treasury?.balance       ?? 0),
      totalIncome:   Number(treasury?.total_income  ?? 0),
      totalExpenses: Number(treasury?.total_expenses ?? 0),
      lastTick:      Number(treasury?.last_tick     ?? 0),
    },
    ledger:  ledger  ?? [],
    orders:  orders  ?? [],
  })
}
