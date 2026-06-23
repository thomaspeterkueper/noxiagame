// app/api/game/bank/route.ts
// Erstellt:     22.06.2026
// Aktualisiert: 22.06.2026 — calcCollateral: ship_types als separate Query (PostgREST FK-Fix), try/catch
// Version:      0.3.2
//
// v0.3.0:
//   - status: Promise.all für parallele DB-Queries (Collateral + Clearance gleichzeitig)
//   - loan/repay: Sicherheiten-Warnung wenn Kredit > Limit nach Portfolioänderung
//   - action=collateral: gibt jetzt auch collateralWarning zurück
//
// v0.2.0:
//   - Kredit-Voraussetzung: academy_completions.module_id = 'finanzgrundlagen'
//   - Kreditlimit = Sicherheitenwert × 0.7 (Gebäude-Ertragswert + Schiff-Restwert)
//   - action=collateral, action=compound_preview
//
// v0.1.0 – Initiale Version: deposit, withdraw, loan, repay, status
//
// Tabellen: bank_accounts, bank_ledger (Migration 027)
//           academy_completions        (Migration 028)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Konstanten ────────────────────────────────────────────────────────────────
const DEPOSIT_RATE        = 0.005   // +0.5%/Tick Einlagen-Zinsen
const LOAN_RATE           = 0.020   // -2.0%/Tick Kredit-Zinsen (Zinseszins)
const COLLATERAL_RATIO    = 0.70    // max. 70% des Sicherheitenwerts als Kredit
const SHIP_RESIDUAL_RATIO = 0.60    // Schiff: 60% des Kaufpreises als Restwert
const MAX_CREDIT_LIMIT    = 50_000  // absolutes Maximum
const MIN_LOAN            = 100
const MIN_DEPOSIT         = 10
const CREDIT_MODULE_ID    = 'finanzgrundlagen'  // Pflicht-Modul für Kredit

// ── Auth ──────────────────────────────────────────────────────────────────────
async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.split(' ')[1]
  const { data: { user } } = await serviceClient.auth.getUser(token)
  return user
}

// ── Konto holen oder anlegen ──────────────────────────────────────────────────
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
    .insert({ profile_id: userId, location_id: locationId, deposit: 0, loan: 0 })
    .select()
    .single()
  return created
}

// ── Schulungsnachweis prüfen ──────────────────────────────────────────────────
async function hasCreditClearance(userId: string): Promise<boolean> {
  try {
    const { data, error } = await serviceClient
      .from('academy_completions')
      .select('id')
      .eq('profile_id', userId)
      .eq('module_id', CREDIT_MODULE_ID)
      .maybeSingle()
    if (error) return false  // Tabelle fehlt oder anderer DB-Fehler
    return !!data
  } catch {
    return false
  }
}

// ── Sicherheitenwert berechnen ────────────────────────────────────────────────
async function calcCollateral(userId: string): Promise<{
  total:     number
  buildings: { id: string; name: string; locationName: string; ertragswert: number }[]
  ships:     { id: string; name: string; shipTypeId: string; restwert: number }[]
}> {
  try {
  // Gebäude: Ertragswert aus market_prices
  const { data: entities } = await serviceClient
    .from('tile_entities')
    .select('id, entity_id, location_id, locations(name)')
    .eq('profile_id', userId)
    .eq('entity_type', 'building')

  const buildings: { id: string; name: string; locationName: string; ertragswert: number }[] = []

  for (const e of entities ?? []) {
    // Produktion aus config (hardcoded Referenzwerte für Sicherheitenbewertung)
    const PRODUCTION: Record<string, { resource: string; amount: number }> = {
      mine:           { resource: 'metal',  amount: 5 },
      solar:          { resource: 'energy', amount: 4 },
      ice_drill:      { resource: 'water',  amount: 4 },
      water_recycler: { resource: 'water',  amount: 2 },
    }
    const prod = PRODUCTION[e.entity_id]
    if (!prod) continue  // Habitate, Akademien etc. — kein Ertragswert

    const { data: mp } = await serviceClient
      .from('market_prices')
      .select('sell_price')
      .eq('location_id', e.location_id)
      .eq('resource', prod.resource)
      .maybeSingle()

    const sellPrice  = Number(mp?.sell_price ?? 30)
    const ertragswert = prod.amount * sellPrice * 20  // FAKTOR 20 wie buildingSale.ts

    buildings.push({
      id:           e.id,
      name:         e.entity_id,
      locationName: (e as any).locations?.name ?? '',
      ertragswert,
    })
  }

  // Schiffe: Restwert = cost_credits × SHIP_RESIDUAL_RATIO
  // ACHTUNG: ship_types FK ist nicht im PostgREST-Schema-Cache → separate Query
  const { data: ships } = await serviceClient
    .from('ships')
    .select('id, ship_type_id')
    .eq('profile_id', userId)
    .eq('is_active', true)

  const shipCollateral: { id: string; name: string; shipTypeId: string; restwert: number }[] = []

  if ((ships ?? []).length > 0) {
    const typeIds = [...new Set((ships ?? []).map((s: any) => s.ship_type_id))]
    const { data: shipTypes } = await serviceClient
      .from('ship_types')
      .select('id, name, cost_credits')
      .in('id', typeIds)

    const typeMap = new Map((shipTypes ?? []).map((t: any) => [t.id, t]))

    for (const s of (ships ?? []) as any[]) {
      const st      = typeMap.get(s.ship_type_id)
      const cost    = Number((st as any)?.cost_credits ?? 0)
      const restwert = Math.round(cost * SHIP_RESIDUAL_RATIO)
      if (restwert <= 0) continue
      shipCollateral.push({
        id:         s.id,
        name:       (st as any)?.name ?? s.ship_type_id,
        shipTypeId: s.ship_type_id,
        restwert,
      })
    }
  }

  const totalBuildings = buildings.reduce((s, b) => s + b.ertragswert, 0)
  const totalShips     = shipCollateral.reduce((s, sh) => s + sh.restwert, 0)

  return {
    total:     totalBuildings + totalShips,
    buildings,
    ships:     shipCollateral,
  }
  } catch (err) {
    console.error('calcCollateral error:', err)
    return { total: 0, buildings: [], ships: [] }
  }
}

// ── Zinseszins-Preview ────────────────────────────────────────────────────────
function compoundPreview(principal: number, rate: number, ticks: number): { tick: number; balance: number }[] {
  const result = []
  let balance = principal
  for (let t = 1; t <= ticks; t++) {
    balance = Math.round(balance * (1 + rate))
    result.push({ tick: t, balance })
  }
  return result
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const action       = searchParams.get('action') ?? 'status'
  const locationSlug = searchParams.get('location')
  const amount       = parseInt(searchParams.get('amount') ?? '0', 10)

  if (!locationSlug) return NextResponse.json({ error: 'location fehlt' }, { status: 400 })

  // Location auflösen
  const { data: loc } = await serviceClient
    .from('locations')
    .select('id, slug, name')
    .eq('slug', locationSlug)
    .single()
  if (!loc) return NextResponse.json({ error: 'Location nicht gefunden' }, { status: 404 })

  // Bank-Gebäude prüfen
  const { data: bankBuilding } = await serviceClient
    .from('tile_entities')
    .select('id')
    .eq('location_id', loc.id)
    .eq('entity_id', 'bank')
    .eq('entity_type', 'building')
    .maybeSingle()
  if (!bankBuilding) {
    return NextResponse.json({ error: 'Keine Bank an diesem Standort.' }, { status: 403 })
  }

  // Spielerprofil
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('id, credits')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })

  const account  = await getOrCreateAccount(user.id, loc.id)
  const deposit  = Number(account.deposit ?? 0)
  const loan     = Number(account.loan    ?? 0)

  // ── SICHERHEITEN-ÜBERSICHT ─────────────────────────────────────────────────
  if (action === 'collateral') {
    const collateral  = await calcCollateral(user.id)
    const creditLimit = Math.min(MAX_CREDIT_LIMIT, Math.round(collateral.total * COLLATERAL_RATIO))
    const hasModule   = await hasCreditClearance(user.id)
    const collateralWarning = loan > creditLimit && loan > 0
      ? { overLimit: loan - creditLimit, message: `Kredit übersteigt Sicherheitenwert um ${(loan - creditLimit).toLocaleString('de')} Cr.` }
      : null

    return NextResponse.json({
      collateral,
      creditLimit,
      collateralRatio:  COLLATERAL_RATIO,
      hasModule,
      moduleId:         CREDIT_MODULE_ID,
      collateralWarning,
    })
  }

  // ── ZINSESZINS-PREVIEW ─────────────────────────────────────────────────────
  if (action === 'compound_preview') {
    const principal = amount > 0 ? amount : 1000
    return NextResponse.json({
      loan:    compoundPreview(principal, LOAN_RATE,    20),
      deposit: compoundPreview(principal, DEPOSIT_RATE, 20),
      loanRate:    LOAN_RATE,
      depositRate: DEPOSIT_RATE,
    })
  }

  // Kreditlimit (Sicherheitenwert-basiert)
  const collateral  = await calcCollateral(user.id)
  const creditLimit = Math.min(MAX_CREDIT_LIMIT, Math.round(collateral.total * COLLATERAL_RATIO))
  const availableLoan = Math.max(0, creditLimit - loan)

  // ── STATUS ─────────────────────────────────────────────────────────────────
  if (action === 'status') {
    // Parallele Queries — kein sequenzielles Warten
    const [ledgerResult, hasModule] = await Promise.all([
      serviceClient
        .from('bank_ledger')
        .select('*')
        .eq('profile_id', user.id)
        .eq('location_id', loc.id)
        .order('created_at', { ascending: false })
        .limit(20),
      hasCreditClearance(user.id),
    ])

    // Sicherheiten-Warnung: Kredit > aktuelles Limit?
    const collateralWarning = loan > creditLimit && loan > 0
      ? {
          overLimit:        loan - creditLimit,
          requiredRepayment: Math.ceil(loan - creditLimit),
          message:          `Kredit übersteigt Sicherheitenwert um ${(loan - creditLimit).toLocaleString('de')} Cr. Bitte tilgen oder Sicherheiten erhöhen.`,
        }
      : null

    return NextResponse.json({
      location:        loc.slug,
      locationName:    loc.name,
      credits:         profile.credits,
      deposit,
      loan,
      creditLimit,
      availableLoan,
      depositRate:     DEPOSIT_RATE,
      loanRate:        LOAN_RATE,
      hasModule,
      moduleId:        CREDIT_MODULE_ID,
      collateralTotal: collateral.total,
      collateralWarning,
      ledger:          ledgerResult.data ?? [],
    })
  }

  // ── EINZAHLEN ──────────────────────────────────────────────────────────────
  if (action === 'deposit') {
    if (!Number.isFinite(amount) || amount < MIN_DEPOSIT)
      return NextResponse.json({ error: `Mindesteinlage: ${MIN_DEPOSIT} Cr` }, { status: 400 })
    if (amount > profile.credits)
      return NextResponse.json({ error: 'Nicht genug Credits' }, { status: 400 })

    const newCredits = profile.credits - amount
    const newDeposit = deposit + amount

    await serviceClient.from('profiles').update({ credits: newCredits }).eq('id', user.id)
    await serviceClient.from('bank_accounts').update({ deposit: newDeposit }).eq('id', account.id)
    await serviceClient.from('bank_ledger').insert({
      profile_id: user.id, location_id: loc.id,
      entry_type: 'deposit', amount, balance_after: newDeposit,
      note: `Einzahlung ${amount} Cr`,
    })

    return NextResponse.json({ ok: true, credits: newCredits, deposit: newDeposit, loan,
      msg: `${amount} Cr eingezahlt. Einlage: ${newDeposit} Cr` })
  }

  // ── AUSZAHLEN ──────────────────────────────────────────────────────────────
  if (action === 'withdraw') {
    if (!Number.isFinite(amount) || amount < 1)
      return NextResponse.json({ error: 'Ungültiger Betrag' }, { status: 400 })
    if (amount > deposit)
      return NextResponse.json({ error: `Nicht genug Guthaben. Verfügbar: ${deposit} Cr` }, { status: 400 })

    const newCredits = profile.credits + amount
    const newDeposit = deposit - amount

    await serviceClient.from('profiles').update({ credits: newCredits }).eq('id', user.id)
    await serviceClient.from('bank_accounts').update({ deposit: newDeposit }).eq('id', account.id)
    await serviceClient.from('bank_ledger').insert({
      profile_id: user.id, location_id: loc.id,
      entry_type: 'withdrawal', amount, balance_after: newDeposit,
      note: `Auszahlung ${amount} Cr`,
    })

    return NextResponse.json({ ok: true, credits: newCredits, deposit: newDeposit, loan,
      msg: `${amount} Cr ausgezahlt` })
  }

  // ── KREDIT AUFNEHMEN ───────────────────────────────────────────────────────
  if (action === 'loan') {
    // Schulungsnachweis prüfen
    const hasModule = await hasCreditClearance(user.id)
    if (!hasModule) {
      return NextResponse.json({
        error:    'Schulungsnachweis fehlt',
        moduleId: CREDIT_MODULE_ID,
        hint:     'Schließe das Modul "Finanzgrundlagen" in der Akademie ab um Kredite aufnehmen zu können.',
      }, { status: 403 })
    }

    if (!Number.isFinite(amount) || amount < MIN_LOAN)
      return NextResponse.json({ error: `Mindestkreditbetrag: ${MIN_LOAN} Cr` }, { status: 400 })
    if (amount > availableLoan)
      return NextResponse.json({
        error: `Kreditlimit überschritten. Verfügbar: ${availableLoan} Cr`,
        creditLimit, currentLoan: loan, availableLoan,
      }, { status: 400 })

    const newCredits = profile.credits + amount
    const newLoan    = loan + amount

    await serviceClient.from('profiles').update({ credits: newCredits }).eq('id', user.id)
    await serviceClient.from('bank_accounts').update({ loan: newLoan }).eq('id', account.id)
    await serviceClient.from('bank_ledger').insert({
      profile_id: user.id, location_id: loc.id,
      entry_type: 'loan_taken', amount, balance_after: newLoan,
      note: `Kredit aufgenommen: ${amount} Cr (Schulden gesamt: ${newLoan} Cr)`,
    })

    const newAvailable = Math.max(0, creditLimit - newLoan)
    const loanWarning  = newLoan > creditLimit
      ? { overLimit: newLoan - creditLimit, message: `Kredit übersteigt Sicherheitenwert. Bitte ${Math.ceil(newLoan - creditLimit).toLocaleString('de')} Cr tilgen.` }
      : null

    return NextResponse.json({
      ok: true, credits: newCredits, deposit, loan: newLoan,
      availableLoan: newAvailable,
      collateralWarning: loanWarning,
      msg: `${amount} Cr Kredit aufgenommen. Zinssatz: ${(LOAN_RATE * 100).toFixed(1)}%/Tick`,
    })
  }

  // ── KREDIT TILGEN ──────────────────────────────────────────────────────────
  if (action === 'repay') {
    if (!Number.isFinite(amount) || amount < 1)
      return NextResponse.json({ error: 'Ungültiger Betrag' }, { status: 400 })
    if (loan <= 0)
      return NextResponse.json({ error: 'Kein ausstehender Kredit' }, { status: 400 })

    const repayAmount = Math.min(amount, loan)
    if (repayAmount > profile.credits)
      return NextResponse.json({ error: `Nicht genug Credits. Benötigt: ${repayAmount} Cr` }, { status: 400 })

    const newCredits = profile.credits - repayAmount
    const newLoan    = loan - repayAmount

    await serviceClient.from('profiles').update({ credits: newCredits }).eq('id', user.id)
    await serviceClient.from('bank_accounts').update({ loan: newLoan }).eq('id', account.id)
    await serviceClient.from('bank_ledger').insert({
      profile_id: user.id, location_id: loc.id,
      entry_type: 'loan_repaid', amount: repayAmount, balance_after: newLoan,
      note: `Kredit getilgt: ${repayAmount} Cr (Restschuld: ${newLoan} Cr)`,
    })

    return NextResponse.json({
      ok: true, credits: newCredits, deposit, loan: newLoan,
      availableLoan: Math.max(0, creditLimit - newLoan),
      msg: newLoan === 0 ? 'Kredit vollständig getilgt!' : `${repayAmount} Cr getilgt. Restschuld: ${newLoan} Cr`,
    })
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
}
