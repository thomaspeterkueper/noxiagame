// app/api/game/orders/route.ts
// Erstellt:     30.05.2026
// Aktualisiert: 10.09.2026 — atomare Auftragserfüllung im NOXIA Game Core
// Version:      0.3.0

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fulfillTradeOrderCommand } from '@/lib/game/core/commands'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.split(' ')[1]
  const { data: { user } } = await serviceClient.auth.getUser(token)
  return user
}

function commandStatus(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('NOXIA_ORDER_NOT_OPEN')) return 404
  if (message.includes('NOXIA_SHIP_NOT_FOUND') || message.includes('NOXIA_PROFILE_NOT_FOUND')) return 404
  if (message.includes('NOXIA_ORDER_WRONG_LOCATION') || message.includes('NOXIA_ORDER_CARGO_INSUFFICIENT')) return 400
  return 409
}

async function handle(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  if (!action) {
    const { data: orders } = await serviceClient
      .from('trade_orders')
      .select('*, locations(slug, name)')
      .eq('status', 'open')
      .order('reward', { ascending: false })
      .limit(10)

    return NextResponse.json({ orders: orders ?? [] })
  }

  if (action === 'fulfill') {
    const orderId = searchParams.get('orderId')
    if (!orderId) return NextResponse.json({ error: 'Fehlende Order ID' }, { status: 400 })

    const agreedRewardRaw = searchParams.get('agreedReward')
    const parsedReward = agreedRewardRaw != null ? Number.parseInt(agreedRewardRaw, 10) : null
    const agreedReward = parsedReward != null && Number.isFinite(parsedReward) ? parsedReward : null

    try {
      const result = await fulfillTradeOrderCommand(user.id, orderId, agreedReward)

      // Preserve the existing response contract: return the complete cargo map
      // after the atomic transaction, not just the resource changed by it.
      const { data: cargoRows } = await serviceClient
        .from('ship_cargo')
        .select('resource, amount')
        .eq('ship_id', result.ship_id)

      const newCargo: Record<string, number> = {}
      for (const cargo of cargoRows ?? []) newCargo[cargo.resource] = cargo.amount
      if (!(result.resource in newCargo)) newCargo[result.resource] = 0

      return NextResponse.json({
        ok: true,
        reward: result.reward,
        baseReward: result.base_reward,
        newCredits: result.credits,
        newCargo,
      })
    } catch (error) {
      console.error('Atomic trade fulfillment failed:', error)
      return NextResponse.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: commandStatus(error) },
      )
    }
  }

  return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 })
}

// GET remains for compatibility with the current client. New callers should use
// POST for state-changing actions; both paths reach the same authoritative DB command.
export async function GET(req: NextRequest) {
  return handle(req)
}

export async function POST(req: NextRequest) {
  return handle(req)
}
