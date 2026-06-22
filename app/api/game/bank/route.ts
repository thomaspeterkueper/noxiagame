// app/api/game/bank/route.ts
// Erstellt:     22.06.2026
// Aktualisiert: 22.06.2026 — Initiale Version: Einlagen, Kredite, Kontostand
// Version:      0.1.0
//
// Aktionen (GET mit ?action=...):
//   status   – Kontostand + Kreditlimit + Transaktionshistorie
//   deposit  – Einzahlung (Credits → Bankkonto)
//   withdraw – Auszahlung (Bankkonto → Credits)
//   loan     – Kredit aufnehmen
//   repay    – Kredit tilgen
//
// Zinsmechanik (wird vom Tick berechnet, nicht hier):
//   Einlagen:  +0.5%/Tick
//   Kredit:    -2.0%/Tick (Zinseszins)
//
// Kreditlimit:
//   Basis: 2.000 Cr
//   +1 Cr je gehandelter Tonne in den letzten 30 Ticks (Handelsvolumen-Bonus)
//   Max: 50.000 Cr
//
// Tabellen (Migration 027_bank.sql erforderlich):
//   bank_accounts  – ein Konto pro Spieler pro Location
//   bank_ledger    – append-only Buchungshistorie

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Zinssätze
const DEPOSIT_RATE     = 0.005   // +0.5% Einlagen-Zinsen pro Tick
const LOAN_RATE        = 0.020   // -2.0% Kredit-Zinsen pro Tick
const BASE_CREDIT_LIMIT = 2000   // Cr — Startlimit für neue Spieler
const MAX_CREDIT_LIMIT  = 50000  // Cr — absolutes Maximum
const MIN_LOAN          = 100    // Cr — Mindestkreditbetrag
const MIN_DEPOSIT       = 10     // Cr — Mindesteinlage

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.split(' ')[1]
  const { data: { user } } = await serviceClient.auth.getUser(token)
  return user
}

// Kreditlimit aus Handelsvolumen berechnen
async function calcCreditLimit(userId: string): Promise<number> {
  const { data } = await serviceClient
    .from('trade_transactions')
    .select('amount')
    .eq('profile_id', userId)
    .gte('traded_at', new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString())

  const totalVolume = (data ?? []).reduce((s: number, t: any) => s + (t.amount ?? 0), 0)
  return Math.min(MAX_CREDIT_LIMIT, BASE_CREDIT_LIMIT + totalVolume)
}

// Konto für Spieler+Location holen oder anlegen
async function getOrCreateAccount(userId: string, locationId: string) {
  const { data: existing } = await serviceClient
    .from('bank_accounts')
    .select('*')
    .eq('profile_id', userId)
    .eq('location_id', locationId)
    .maybeSingle()

  if (existing) return existing

  const { data: created } = await serviceClient
    .from('bank_accounts')
    .insert({
      profile_id:   userId,
      location_id:  locationId,
      deposit:      0,
      loan:         0,
    })
    .select()
    .single()

  return created
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const action     = searchParams.get('action') ?? 'status'
  const locationSlug = searchParams.get('location')
  const amountRaw  = searchParams.get('amount')
  const amount     = amountRaw ? parseInt(amountRaw, 10) : 0

  // Location-ID aus Slug auflösen
  if (!locationSlug) {
    return NextResponse.json({ error: 'location fehlt' }, { status: 400 })
  }

  const { data: loc } = await serviceClient
    .from('locations')
    .select('id, slug, name')
    .eq('slug', locationSlug)
    .single()

  if (!loc) return NextResponse.json({ error: 'Location nicht gefunden' }, { status: 404 })

  // Prüfen ob Bank-Gebäude an dieser Location existiert
  const { data: bankBuilding } = await serviceClient
    .from('tile_entities')
    .select('id')
    .eq('location_id', loc.id)
    .eq('entity_id', 'bank')
    .eq('entity_type', 'building')
    .maybeSingle()

  if (!bankBuilding) {
    return NextResponse.json({
      error: 'Keine Bank an diesem Standort. Baue zuerst eine Bank.',
    }, { status: 403 })
  }

  // Spielerprofil
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('id, credits')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })

  const account      = await getOrCreateAccount(user.id, loc.id)
  const creditLimit  = await calcCreditLimit(user.id)
  const deposit      = Number(account.deposit ?? 0)
  const loan         = Number(account.loan    ?? 0)
  const availableLoan = Math.max(0, creditLimit - loan)

  // ── STATUS ────────────────────────────────────────────────────────────────
  if (action === 'status') {
    const { data: ledger } = await serviceClient
      .from('bank_ledger')
      .select('*')
      .eq('profile_id', user.id)
      .eq('location_id', loc.id)
      .order('created_at', { ascending: false })
      .limit(20)

    return NextResponse.json({
      location:      loc.slug,
      locationName:  loc.name,
      credits:       profile.credits,
      deposit,
      loan,
      creditLimit,
      availableLoan,
      depositRate:   DEPOSIT_RATE,
      loanRate:      LOAN_RATE,
      ledger:        ledger ?? [],
    })
  }

  // ── EINZAHLEN ─────────────────────────────────────────────────────────────
  if (action === 'deposit') {
    if (!Number.isFinite(amount) || amount < MIN_DEPOSIT) {
      return NextResponse.json({ error: `Mindesteinlage: ${MIN_DEPOSIT} Cr` }, { status: 400 })
    }
    if (amount > profile.credits) {
      return NextResponse.json({ error: 'Nicht genug Credits' }, { status: 400 })
    }

    const newCredits = profile.credits - amount
    const newDeposit = deposit + amount

    await serviceClient.from('profiles')
      .update({ credits: newCredits })
      .eq('id', user.id)

    await serviceClient.from('bank_accounts')
      .update({ deposit: newDeposit })
      .eq('id', account.id)

    await serviceClient.from('bank_ledger').insert({
      profile_id:    user.id,
      location_id:   loc.id,
      entry_type:    'deposit',
      amount,
      balance_after: newDeposit,
      note:          `Einzahlung ${amount} Cr`,
    })

    return NextResponse.json({
      ok:      true,
      credits: newCredits,
      deposit: newDeposit,
      loan,
      msg:     `${amount} Cr eingezahlt. Einlage: ${newDeposit} Cr`,
    })
  }

  // ── AUSZAHLEN ─────────────────────────────────────────────────────────────
  if (action === 'withdraw') {
    if (!Number.isFinite(amount) || amount < 1) {
      return NextResponse.json({ error: 'Ungültiger Betrag' }, { status: 400 })
    }
    if (amount > deposit) {
      return NextResponse.json({
        error: `Nicht genug Guthaben. Verfügbar: ${deposit} Cr`,
      }, { status: 400 })
    }

    const newCredits = profile.credits + amount
    const newDeposit = deposit - amount

    await serviceClient.from('profiles')
      .update({ credits: newCredits })
      .eq('id', user.id)

    await serviceClient.from('bank_accounts')
      .update({ deposit: newDeposit })
      .eq('id', account.id)

    await serviceClient.from('bank_ledger').insert({
      profile_id:    user.id,
      location_id:   loc.id,
      entry_type:    'withdrawal',
      amount,
      balance_after: newDeposit,
      note:          `Auszahlung ${amount} Cr`,
    })

    return NextResponse.json({
      ok:      true,
      credits: newCredits,
      deposit: newDeposit,
      loan,
      msg:     `${amount} Cr ausgezahlt`,
    })
  }

  // ── KREDIT AUFNEHMEN ──────────────────────────────────────────────────────
  if (action === 'loan') {
    if (!Number.isFinite(amount) || amount < MIN_LOAN) {
      return NextResponse.json({ error: `Mindestkreditbetrag: ${MIN_LOAN} Cr` }, { status: 400 })
    }
    if (amount > availableLoan) {
      return NextResponse.json({
        error: `Kreditlimit überschritten. Verfügbar: ${availableLoan} Cr`,
        creditLimit,
        currentLoan: loan,
        availableLoan,
      }, { status: 400 })
    }

    const newCredits = profile.credits + amount
    const newLoan    = loan + amount

    await serviceClient.from('profiles')
      .update({ credits: newCredits })
      .eq('id', user.id)

    await serviceClient.from('bank_accounts')
      .update({ loan: newLoan })
      .eq('id', account.id)

    await serviceClient.from('bank_ledger').insert({
      profile_id:    user.id,
      location_id:   loc.id,
      entry_type:    'loan_taken',
      amount,
      balance_after: newLoan,
      note:          `Kredit aufgenommen: ${amount} Cr (Schulden gesamt: ${newLoan} Cr)`,
    })

    return NextResponse.json({
      ok:           true,
      credits:      newCredits,
      deposit,
      loan:         newLoan,
      availableLoan: Math.max(0, creditLimit - newLoan),
      msg:          `${amount} Cr Kredit aufgenommen. Zinsen: ${(LOAN_RATE * 100).toFixed(1)}%/Tick`,
    })
  }

  // ── KREDIT TILGEN ─────────────────────────────────────────────────────────
  if (action === 'repay') {
    if (!Number.isFinite(amount) || amount < 1) {
      return NextResponse.json({ error: 'Ungültiger Betrag' }, { status: 400 })
    }
    if (loan <= 0) {
      return NextResponse.json({ error: 'Kein ausstehender Kredit' }, { status: 400 })
    }

    const repayAmount = Math.min(amount, loan)  // max: offene Schulden tilgen
    if (repayAmount > profile.credits) {
      return NextResponse.json({
        error: `Nicht genug Credits. Benötigt: ${repayAmount} Cr`,
      }, { status: 400 })
    }

    const newCredits = profile.credits - repayAmount
    const newLoan    = loan - repayAmount

    await serviceClient.from('profiles')
      .update({ credits: newCredits })
      .eq('id', user.id)

    await serviceClient.from('bank_accounts')
      .update({ loan: newLoan })
      .eq('id', account.id)

    await serviceClient.from('bank_ledger').insert({
      profile_id:    user.id,
      location_id:   loc.id,
      entry_type:    'loan_repaid',
      amount:        repayAmount,
      balance_after: newLoan,
      note:          `Kredit getilgt: ${repayAmount} Cr (Restschuld: ${newLoan} Cr)`,
    })

    return NextResponse.json({
      ok:           true,
      credits:      newCredits,
      deposit,
      loan:         newLoan,
      availableLoan: Math.max(0, creditLimit - newLoan),
      msg:          newLoan === 0
        ? 'Kredit vollständig getilgt!'
        : `${repayAmount} Cr getilgt. Restschuld: ${newLoan} Cr`,
    })
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
}
