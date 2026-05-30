// app/api/cron/orders/route.ts
// Erstellt: 30.05.2026
// Aktualisiert: 30.05.2026 – Bessere Auftragslogik mit Dringlichkeit

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

export async function GET(req: NextRequest) {
  const secret = req.headers.get(CRON_SECRET_HEADER)
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const created: Record<string, unknown>[] = []
  const expired: number[] = []

  try {
    // Abgelaufene Aufträge schließen
    const { data: expiredOrders } = await supabase
      .from('trade_orders')
      .update({ status: 'expired' })
      .eq('status', 'open')
      .lt('expires_at', new Date().toISOString())
      .select('id')

    expired.push(...(expiredOrders ?? []).map((o: any) => o.id))

    // Alle Kolonien mit Ressourcen laden
    const { data: locations } = await supabase
      .from('locations')
      .select('id, slug, name, population, is_supplied')

    for (const loc of locations ?? []) {
      const { data: resources } = await supabase
        .from('location_resources')
        .select('resource, stock, consumption, production')
        .eq('location_id', loc.id)

      for (const res of resources ?? []) {
        const balance = res.production - res.consumption
        const isUrgent = res.stock < STOCK_LOW_THRESHOLD
        const isSinking = balance < 0 && res.stock < 150

        if (!isUrgent && !isSinking) continue

        // Prüfen ob bereits offener Auftrag existiert
        const { data: existing } = await supabase
          .from('trade_orders')
          .select('id')
          .eq('location_id', loc.id)
          .eq('resource', res.resource)
          .eq('status', 'open')
          .limit(1)

        if (existing && existing.length > 0) continue

        // Marktpreis laden
        const { data: price } = await supabase
          .from('market_prices')
          .select('buy_price')
          .eq('location_id', loc.id)
          .eq('resource', res.resource)
          .single()

        if (!price) continue

        // Auftragsmenge basierend auf Dringlichkeit
        const urgencyMultiplier = 1.0
        const amount = Math.floor(
          (ORDER_MIN_AMOUNT + Math.random() * (ORDER_MAX_AMOUNT - ORDER_MIN_AMOUNT)) * urgencyMultiplier
        )

        // Belohnung: höher bei dringenden Aufträgen
        const rewardMult = isUrgent ? ORDER_REWARD_MULT * 1.3 : ORDER_REWARD_MULT
        const reward = Math.round(price.buy_price * amount * rewardMult)

        const expiresAt = new Date()
        expiresAt.setHours(expiresAt.getHours() + ORDER_EXPIRE_HOURS)

        const { error: insertError } = await supabase
          .from('trade_orders')
          .insert({
            location_id: loc.id,
            resource:    res.resource,
            amount,
            reward,
            expires_at:  expiresAt.toISOString(),
          })

        if (insertError) throw insertError

        created.push({
          location: loc.slug,
          resource: res.resource,
          amount,
          reward,
          stock:   res.stock,
          urgent:  isUrgent,
        })
      }
    }

    return NextResponse.json({
      ok: true,
      tick: 'orders',
      created: created.length,
      expired: expired.length,
      orders: created,
    })

  } catch (err) {
    console.error('Orders tick error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}