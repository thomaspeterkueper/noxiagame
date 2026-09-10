// app/api/game/bank/route.ts
// Aktualisiert: 10.09.2026 — atomare Game-Core-Bankcommands
// Version:      0.6.0

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { bankMutationCommand, type BankMutationAction } from '@/lib/game/core/commands'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DEPOSIT_RATE        = 0.005
const LOAN_RATE           = 0.020
const COLLATERAL_RATIO    = 0.70
const SHIP_RESIDUAL_RATIO = 0.60
const MAX_CREDIT_LIMIT    = 50_000
const CREDIT_MODULE_ID    = 'ECO-L0-000001'

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.split(' ')[1]
  const { data: { user } } = await serviceClient.auth.getUser(token)
  return user
}

const EMPTY_ACCOUNT = { id: null, deposit: 0, loan: 0 }

// Read-only by design. Account creation happens inside noxia_bank_mutation().
async function getAccount(userId: string, locationId: string) {
  const { data, error } = await serviceClient
    .from('bank_accounts')
    .select('*')
    .eq('profile_id', userId)
    .eq('location_id', locationId)
    .maybeSingle()
  if (error) {
    console.error('getAccount error:', error.message, error.code)
    return EMPTY_ACCOUNT
  }
  return data ?? EMPTY_ACCOUNT
}

async function hasCreditClearance(userId: string): Promise<boolean> {
  try {
    const { data, error } = await serviceClient
      .from('academy_completions')
      .select('module_id')
      .eq('profile_id', userId)
      .eq('module_id', CREDIT_MODULE_ID)
      .maybeSingle()
    if (error) return false
    return !!data
  } catch {
    return false
  }
}

async function calcCollateral(userId: string): Promise<{
  total: number
  buildings: { id: string; name: string; locationName: string; ertragswert: number }[]
  ships: { id: string; name: string; shipTypeId: string; restwert: number }[]
}> {
  try {
    const { data: entities } = await serviceClient
      .from('tile_entities')
      .select('id, entity_id, location_id, locations(name)')
      .eq('profile_id', userId)
      .eq('entity_type', 'building')

    const buildings: { id: string; name: string; locationName: string; ertragswert: number }[] = []
    const PRODUCTION: Record<string, { resource: string; amount: number }> = {
      mine:           { resource: 'metal',  amount: 5 },
      solar:          { resource: 'energy', amount: 4 },
      ice_drill:      { resource: 'water',  amount: 4 },
      water_recycler: { resource: 'water',  amount: 2 },
    }

    for (const e of entities ?? []) {
      const prod = PRODUCTION[e.entity_id]
      if (!prod) continue

      const { data: mp } = await serviceClient
        .from('market_prices')
        .select('sell_price')
        .eq('location_id', e.location_id)
        .eq('resource', prod.resource)
        .maybeSingle()

      const sellPrice = Number(mp?.sell_price ?? 30)
      buildings.push({
        id: e.id,
        name: e.entity_id,
        locationName: (e as any).locations?.name ?? '',
        ertragswert: prod.amount * sellPrice * 20,
      })
    }

    const { data: ships } = await serviceClient
      .from('ships')
      .select('id, ship_type_id')
      .eq('profile_id', userId)
      .eq('is_active', true)

    const shipCollateral: { id: string; name: string; shipTypeId: string; restwert: number }[] = []
    if ((ships ?? []).length > 0) {
      const typeIds = [...new Set((ships ?? []).map((s: any) => s.ship_type_id).filter(Boolean))]
      const { data: shipTypes } = typeIds.length > 0
        ? await serviceClient.from('ship_types').select('id, name, cost_credits').in('id', typeIds)
        : { data: [] as any[] }
      const typeMap = new Map((shipTypes ?? []).map((t: any) => [t.id, t]))

      for (const s of (ships ?? []) as any[]) {
        const st = typeMap.get(s.ship_type_id)
        const restwert = Math.round(Number((st as any)?.cost_credits ?? 0) * SHIP_RESIDUAL_RATIO)
        if (restwert <= 0) continue
        shipCollateral.push({
          id: s.id,
          name: (st as any)?.name ?? s.ship_type_id,
          shipTypeId: s.ship_type_id,
          restwert,
        })
      }
    }

    return {
      total: buildings.reduce((sum, b) => sum + b.ertragswert, 0)
        + shipCollateral.reduce((sum, ship) => sum + ship.restwert, 0),
      buildings,
      ships: shipCollateral,
    }
  } catch (err) {
    console.error('calcCollateral error:', err)
    return { total: 0, buildings: [], ships: [] }
  }
}

function compoundPreview(principal: number, rate: number, ticks: number): { tick: number; balance: number }[] {
  const result: { tick: number; balance: number }[] = []
  let balance = principal
  for (let tick = 1; tick <= ticks; tick++) {
    balance = Math.round(balance * (1 + rate))
    result.push({ tick, balance })
  }
  return result
}

function commandMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function bankCommandError(error: unknown) {
  const message = commandMessage(error)
  if (message.includes('NOXIA_BANK_NOT_AVAILABLE')) return NextResponse.json({ error: 'Keine Bank an diesem Standort.' }, { status: 403 })
  if (message.includes('NOXIA_BANK_MIN_DEPOSIT')) return NextResponse.json({ error: 'Mindesteinlage: 10 Cr' }, { status: 400 })
  if (message.includes('NOXIA_BANK_MIN_LOAN')) return NextResponse.json({ error: 'Mindestkreditbetrag: 100 Cr' }, { status: 400 })
  if (message.includes('NOXIA_BANK_CREDIT_CLEARANCE_REQUIRED')) return NextResponse.json({ error: 'Schulungsnachweis fehlt', moduleId: CREDIT_MODULE_ID, hint: 'Schließe das Modul "Finanzgrundlagen" in der Akademie ab um Kredite aufnehmen zu können.' }, { status: 403 })
  if (message.includes('NOXIA_BANK_CREDIT_LIMIT_EXCEEDED')) return NextResponse.json({ error: 'Kreditlimit überschritten.' }, { status: 400 })
  if (message.includes('NOXIA_BANK_DEPOSIT_INSUFFICIENT')) return NextResponse.json({ error: 'Nicht genug Guthaben.' }, { status: 400 })
  if (message.includes('NOXIA_BANK_NO_OUTSTANDING_LOAN')) return NextResponse.json({ error: 'Kein ausstehender Kredit' }, { status: 400 })
  if (message.includes('NOXIA_BANK_CREDITS_INSUFFICIENT')) return NextResponse.json({ error: 'Nicht genug Credits' }, { status: 400 })
  if (message.includes('NOXIA_PROFILE_NOT_FOUND')) return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })
  console.error('bank command failed:', message)
  return NextResponse.json({ error: 'Banktransaktion fehlgeschlagen' }, { status: 500 })
}

type BankRequestInput = {
  action: string
  location: string | null
  amount: number
}

async function handleBankRequest(req: NextRequest, input: BankRequestInput) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, location: locationSlug, amount } = input
  if (!locationSlug) return NextResponse.json({ error: 'location fehlt' }, { status: 400 })

  const { data: loc } = await serviceClient
    .from('locations')
    .select('id, slug, name')
    .eq('slug', locationSlug)
    .single()
  if (!loc) return NextResponse.json({ error: 'Location nicht gefunden' }, { status: 404 })

  const { data: bankBuilding } = await serviceClient
    .from('tile_entities')
    .select('id')
    .eq('location_id', loc.id)
    .eq('entity_id', 'bank')
    .eq('entity_type', 'building')
    .maybeSingle()
  if (!bankBuilding) return NextResponse.json({ error: 'Keine Bank an diesem Standort.' }, { status: 403 })

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('id, credits')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })

  const account = await getAccount(user.id, loc.id)
  const deposit = Number(account.deposit ?? 0)
  const loan = Number(account.loan ?? 0)

  if (action === 'collateral') {
    const collateral = await calcCollateral(user.id)
    const creditLimit = Math.min(MAX_CREDIT_LIMIT, Math.round(collateral.total * COLLATERAL_RATIO))
    const hasModule = await hasCreditClearance(user.id)
    const collateralWarning = loan > creditLimit && loan > 0
      ? { overLimit: loan - creditLimit, message: `Kredit übersteigt Sicherheitenwert um ${(loan - creditLimit).toLocaleString('de')} Cr.` }
      : null
    return NextResponse.json({ collateral, creditLimit, collateralRatio: COLLATERAL_RATIO, hasModule, moduleId: CREDIT_MODULE_ID, collateralWarning })
  }

  if (action === 'compound_preview') {
    const principal = amount > 0 ? amount : 1000
    return NextResponse.json({
      loan: compoundPreview(principal, LOAN_RATE, 20),
      deposit: compoundPreview(principal, DEPOSIT_RATE, 20),
      loanRate: LOAN_RATE,
      depositRate: DEPOSIT_RATE,
    })
  }

  const needsCollateral = action === 'status' || action === 'loan' || action === 'repay'
  const collateral = needsCollateral ? await calcCollateral(user.id) : { total: 0, buildings: [], ships: [] }
  const creditLimit = Math.min(MAX_CREDIT_LIMIT, Math.round(collateral.total * COLLATERAL_RATIO))
  const availableLoan = Math.max(0, creditLimit - loan)

  if (action === 'status') {
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

    const collateralWarning = loan > creditLimit && loan > 0
      ? {
          overLimit: loan - creditLimit,
          requiredRepayment: Math.ceil(loan - creditLimit),
          message: `Kredit übersteigt Sicherheitenwert um ${(loan - creditLimit).toLocaleString('de')} Cr. Bitte tilgen oder Sicherheiten erhöhen.`,
        }
      : null

    return NextResponse.json({
      location: loc.slug,
      locationName: loc.name,
      credits: profile.credits,
      deposit,
      loan,
      creditLimit,
      availableLoan,
      depositRate: DEPOSIT_RATE,
      loanRate: LOAN_RATE,
      hasModule,
      moduleId: CREDIT_MODULE_ID,
      collateralTotal: collateral.total,
      collateralWarning,
      ledger: ledgerResult.data ?? [],
    })
  }

  if (!['deposit', 'withdraw', 'loan', 'repay'].includes(action)) {
    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Ungültiger Betrag' }, { status: 400 })
  }

  try {
    const result = await bankMutationCommand(
      user.id,
      loc.id,
      action as BankMutationAction,
      amount,
      action === 'loan' ? creditLimit : null,
    )

    const nextAvailableLoan = Math.max(0, creditLimit - Number(result.loan))
    const collateralWarning = Number(result.loan) > creditLimit && Number(result.loan) > 0
      ? {
          overLimit: Number(result.loan) - creditLimit,
          message: `Kredit übersteigt Sicherheitenwert. Bitte ${Math.ceil(Number(result.loan) - creditLimit).toLocaleString('de')} Cr tilgen.`,
        }
      : null

    if (action === 'deposit') {
      return NextResponse.json({ ok: true, credits: result.credits, deposit: result.deposit, loan: result.loan, msg: `${result.amount} Cr eingezahlt. Einlage: ${result.deposit} Cr` })
    }
    if (action === 'withdraw') {
      return NextResponse.json({ ok: true, credits: result.credits, deposit: result.deposit, loan: result.loan, msg: `${result.amount} Cr ausgezahlt` })
    }
    if (action === 'loan') {
      return NextResponse.json({
        ok: true,
        credits: result.credits,
        deposit: result.deposit,
        loan: result.loan,
        availableLoan: nextAvailableLoan,
        collateralWarning,
        msg: `${result.amount} Cr Kredit aufgenommen. Zinssatz: ${(LOAN_RATE * 100).toFixed(1)}%/Tick`,
      })
    }

    return NextResponse.json({
      ok: true,
      credits: result.credits,
      deposit: result.deposit,
      loan: result.loan,
      availableLoan: nextAvailableLoan,
      msg: Number(result.loan) === 0 ? 'Kredit vollständig getilgt!' : `${result.amount} Cr getilgt. Restschuld: ${result.loan} Cr`,
    })
  } catch (error) {
    return bankCommandError(error)
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  return handleBankRequest(req, {
    action: searchParams.get('action') ?? 'status',
    location: searchParams.get('location'),
    amount: Number.parseInt(searchParams.get('amount') ?? '0', 10),
  })
}

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
  }

  return handleBankRequest(req, {
    action: typeof body?.action === 'string' ? body.action : 'status',
    location: typeof body?.location === 'string' ? body.location : null,
    amount: Number.parseInt(String(body?.amount ?? '0'), 10),
  })
}
