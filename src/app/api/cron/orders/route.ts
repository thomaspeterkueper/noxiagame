// ============================================================
// NOXIA – Cron: Handelsaufträge generieren
// Läuft stündlich (vercel.json)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  ORDER_MIN_AMOUNT,
  ORDER_MAX_AMOUNT,
  ORDER_REWARD_MULT,
  ORDER_EXPIRE_HOURS,
  STOCK_LOW_THRESHOLD,
  CRON_SECRET_HEADER,
} from '@/lib/game/config'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const secret = req.headers.get(CRON_SECRET_HEADER)
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const created: Record<string, unknown>[] = []

  try {
    // Abgelaufene Aufträge schließen
    await supabase
      .from('trade_orders')
      .update({ status: 'expired' })
      .eq('status', 'open')
      .lt('expires_at', new Date().toISOString())

    // Kolonien mit knappen Ressourcen finden
    const { data: scarce, error: scarceError } = await supabase
      .from('location_resources')
      .select('*, locations(id, slug)')
      .lt('stock', STOCK_LOW_THRESHOLD)

    if (scarceError) throw scarceError

    for (const entry of scarce ?? []) {
      // Prüfen ob bereits offener Auftrag für diese Kolonie/Ressource existiert
      const { data: existing } = await supabase
        .from('trade_orders')
        .select('id')
        .eq('location_id', entry.location_id)
        .eq('resource', entry.resource)
        .eq('status', 'open')
        .limit(1)

      if (existing && existing.length > 0) continue

      // Marktpreis laden
      const { data: price } = await supabase
        .from('market_prices')
        .select('buy_price')
        .eq('location_id', entry.location_id)
        .eq('resource', entry.resource)
        .single()

      if (!price) continue

      // Auftrag generieren
      const amount = Math.floor(
        ORDER_MIN_AMOUNT + Math.random() * (ORDER_MAX_AMOUNT - ORDER_MIN_AMOUNT)
      )
      const reward = Math.round(price.buy_price * amount * ORDER_REWARD_MULT)
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + ORDER_EXPIRE_HOURS)

      const { error: insertError } = await supabase
        .from('trade_orders')
        .insert({
          location_id: entry.location_id,
          resource:    entry.resource,
          amount,
          reward,
          expires_at:  expiresAt.toISOString(),
        })

      if (insertError) throw insertError

      created.push({
        location: entry.locations?.slug,
        resource: entry.resource,
        amount,
        reward,
        stock:   entry.stock,
      })
    }

    return NextResponse.json({ ok: true, tick: 'orders', created })

  } catch (err) {
    console.error('Orders tick error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}