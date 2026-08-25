// app/api/game/admin/route.ts
// Erstellt: 20.06.2026
// Aktualisiert: 25.08.2026 — Schreibzugriffe für den Gouverneur ergänzt
//               (NOXIA-ECON-0002): Steuersätze setzen (action=setTaxRates)
//               und aus der Kolonie-Kasse abheben (action=withdraw). Beide
//               als GET mit Query-Parametern (Turbopack-POST-Bug, siehe
//               Tech-Setup "Bekannte Probleme #2"), beide nur für
//               locations.governor_profile_id === aufrufender Nutzer.
// Version:  1.1.0
//
// Liefert alle Verwaltungsdaten einer Station für das Admin-Overlay.
// Lesen ist öffentlich (kein Auth nötig) — Kolonie-Daten sind transparent.
// Schreiben (setTaxRates, withdraw) erfordert Auth + Gouverneur-Rolle.
//
// ?location=moon|mars|phobos
// ?action=setTaxRates&location=mars&taxProperty=0&taxTransaction=0.02&taxLanding=25  (Bearer erforderlich)
// ?action=withdraw&location=mars&amount=500                                          (Bearer erforderlich)

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.split(' ')[1]
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user
}

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(req.url)
  const locationSlug = searchParams.get('location')
  const action = searchParams.get('action')

  if (!locationSlug) {
    return NextResponse.json({ error: 'location fehlt' }, { status: 400 })
  }

  // ── Schreib-Aktionen: nur Gouverneur ─────────────────────────────────────
  if (action === 'setTaxRates' || action === 'withdraw') {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

    const { data: loc } = await supabase
      .from('locations')
      .select('id, governor_profile_id')
      .eq('slug', locationSlug)
      .single()

    if (!loc) return NextResponse.json({ error: 'Kolonie nicht gefunden' }, { status: 404 })
    if (loc.governor_profile_id !== user.id) {
      return NextResponse.json({ error: 'Nur der Gouverneur darf das ändern' }, { status: 403 })
    }

    if (action === 'setTaxRates') {
      const clamp = (v: number) => Math.max(0, Math.min(0.5, v))
      const taxProperty    = clamp(Number(searchParams.get('taxProperty')    ?? 0))
      const taxTransaction = clamp(Number(searchParams.get('taxTransaction') ?? 0))
      const taxLanding     = Math.max(0, Number(searchParams.get('taxLanding') ?? 0))  // Cr-Betrag, kein %-Satz

      const { error } = await supabase.from('colony_settings').upsert({
        location_id:     loc.id,
        tax_property:    taxProperty,
        tax_transaction: taxTransaction,
        tax_landing:     taxLanding,
        updated_at:      new Date().toISOString(),
        updated_by:      user.id,
      }, { onConflict: 'location_id' })

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, taxProperty, taxTransaction, taxLanding })
    }

    if (action === 'withdraw') {
      const amount = Math.round(Number(searchParams.get('amount') ?? 0))
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: 'Ungültiger Betrag' }, { status: 400 })
      }

      const { data: treasury } = await supabase
        .from('colony_treasury')
        .select('balance')
        .eq('location_id', loc.id)
        .maybeSingle()
      const balance = Number(treasury?.balance ?? 0)

      if (amount > balance) {
        return NextResponse.json({ error: `Kasse hat nur ${Math.round(balance)} Cr` }, { status: 400 })
      }

      const { data: lastTick } = await supabase
        .from('tick_log')
        .select('tick_number')
        .order('tick_number', { ascending: false })
        .limit(1)
        .maybeSingle()

      // Negativer Ledger-Eintrag = Ausgabe der Kolonie-Kasse (Abhebung).
      await supabase.from('colony_ledger').insert({
        location_id:   loc.id,
        tick:          Number(lastTick?.tick_number ?? 0),
        entry_type:    'governor_withdrawal',
        profile_id:    user.id,
        resource_type: null,
        amount:        -amount,
        note:          `Abhebung durch Gouverneur`,
      })

      const { data: profile } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', user.id)
        .single()

      await supabase.from('profiles')
        .update({ credits: (profile?.credits ?? 0) + amount })
        .eq('id', user.id)

      return NextResponse.json({ ok: true, withdrawn: amount, newBalance: balance - amount })
    }
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
