// app/api/game/ships/route.ts
// Aktualisiert: 09.10.2026 — erstes eigenes Schiff setzt kaufmännische Qualifikation voraus
//               (Handelserfahrung oder Grundausbildung, s. lib/game/merchantQualification.ts)
// Vorher:       10.09.2026 — atomarer Schiffstyp-Kauf/-Wechsel
// Version:      0.5.1

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buyShipTypeCommand } from '@/lib/game/core/commands'
import { COMMERCIAL_BASICS_MODULES, MERCHANT_EXPERIENCE_SALES, merchantStanding } from '@/lib/game/merchantQualification'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.split(' ')[1]
  const { data: { user } } = await serviceClient.auth.getUser(token)
  return user
}

function shipPurchaseError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('NOXIA_TRANSIT_SHIP_MUTATION_FORBIDDEN') || message.includes('NOXIA_TRANSIT_CARGO_MUTATION_FORBIDDEN')) {
    return NextResponse.json({ error: 'Schiff kann während eines laufenden Transits nicht gewechselt werden.', code: 'SHIP_IN_TRANSIT' }, { status: 409 })
  }
  if (message.includes('NOXIA_SHIP_TYPE_NOT_FOUND')) return NextResponse.json({ error: 'Schiffstyp nicht gefunden' }, { status: 404 })
  // Nur noch möglich, solange Migration 20261009140000 (Erstkauf) nicht eingespielt ist.
  if (message.includes('NOXIA_SHIP_NOT_FOUND')) return NextResponse.json({ error: 'Der Erstkauf eines Schiffs ist noch nicht freigeschaltet.', code: 'FIRST_SHIP_PURCHASE_PENDING' }, { status: 409 })
  if (message.includes('NOXIA_SHIP_TYPE_NOT_FOR_SALE')) return NextResponse.json({ error: 'Dieses Schiff steht nicht zum Verkauf.' }, { status: 400 })
  if (message.includes('NOXIA_PROFILE_NOT_FOUND')) return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })
  if (message.includes('NOXIA_SHIP_TYPE_ALREADY_OWNED')) return NextResponse.json({ error: 'Du hast dieses Schiff bereits.' }, { status: 400 })
  if (message.includes('NOXIA_SHIP_PURCHASE_CREDITS_INSUFFICIENT')) return NextResponse.json({ error: 'Unzureichende Credits.' }, { status: 400 })
  if (message.includes('NOXIA_SHIP_TYPE_WRONG_LOCATION')) {
    const match = message.match(/NOXIA_SHIP_TYPE_WRONG_LOCATION:([^ ·]+)/)
    const availableAt = match?.[1] ?? 'diesem Standort'
    const place: Record<string, string> = { moon: 'dem Mond', mars: 'dem Mars', earth: 'der Erde', phobos: 'Phobos' }
    return NextResponse.json({ error: `Dieses Schiff gibt es nur in der Werft auf ${place[availableAt] ?? availableAt}.` }, { status: 400 })
  }
  console.error('ship purchase command failed:', message)
  return NextResponse.json({ error: 'Schiffskauf fehlgeschlagen' }, { status: 500 })
}

async function buyShip(userId: string, shipTypeId: string | null) {
  if (!shipTypeId) return NextResponse.json({ error: 'Fehlende Ship Type ID' }, { status: 400 })

  // Wer noch kein Schiff besitzt, handelt über Spediteure. Das erste eigene
  // Schiff setzt Handelserfahrung oder die kaufmännische Grundausbildung voraus.
  const { count: shipCount } = await serviceClient.from('ships').select('id', { count: 'exact', head: true }).eq('profile_id', userId)
  if ((shipCount ?? 0) === 0) {
    const [tradesR, modulesR] = await Promise.all([
      serviceClient.from('trade_transactions').select('resource, from_location, profit, traded_at').eq('profile_id', userId).order('traded_at', { ascending: true }).limit(500),
      serviceClient.from('player_learning_progress').select('module_id').eq('profile_id', userId).eq('completed', true),
    ])
    const standing = merchantStanding((tradesR.data ?? []) as any, (modulesR.data ?? []).map((m: any) => String(m.module_id)))
    if (!standing.qualified) {
      return NextResponse.json({
        error: `Für das erste eigene Schiff fehlt die kaufmännische Qualifikation: ${standing.salesElsewhere} von ${MERCHANT_EXPERIENCE_SALES} Fernverkäufen oder ${standing.commercialBasicsCompleted} von ${COMMERCIAL_BASICS_MODULES} Grundmodulen.`,
        code: 'MERCHANT_QUALIFICATION_REQUIRED',
      }, { status: 403 })
    }
  }

  try {
    const result = await buyShipTypeCommand(userId, shipTypeId)
    return NextResponse.json({
      ok: true,
      newCredits: result.new_credits,
      shipTypeId: result.ship_type_id,
      cargoMax: result.cargo_max,
      speedMult: result.speed_mult,
    })
  } catch (error) {
    return shipPurchaseError(error)
  }
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  if (!action) {
    const [{ data: shipTypes }, { data: ships }] = await Promise.all([
      serviceClient.from('ship_types').select('*').order('cost_credits'),
      serviceClient
        .from('ships')
        .select('id, ship_type_id, location, is_active, created_at')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: true }),
    ])

    const currentShip: any = (ships as any[])?.find(ship => ship.is_active)
      ?? (ships as any[])?.[0]
      ?? null

    return NextResponse.json({
      shipTypes: shipTypes ?? [],
      currentShipTypeId: currentShip?.ship_type_id ?? 'freighter_mk1',
      currentLocation: currentShip?.location ?? 'moon',
    })
  }

  if (action === 'list') {
    const { data: ships } = await serviceClient
      .from('ships')
      .select('id, ship_type_id, location, cargo_max, is_active')
      .eq('profile_id', user.id)
      .order('is_active', { ascending: false })
    return NextResponse.json({ ships: ships ?? [] })
  }

  if (action === 'buy') {
    return buyShip(user.id, searchParams.get('shipTypeId'))
  }

  return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
  }

  if (body?.action !== 'buy') return NextResponse.json({ error: 'POST unterstützt hier nur buy' }, { status: 400 })
  return buyShip(user.id, typeof body?.shipTypeId === 'string' ? body.shipTypeId : null)
}
