// ============================================================
// NOXIA – Cron: Marktpreise aktualisieren
// Läuft alle 2 Minuten (vercel.json)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  PRICE_PRESSURE_HIGH,
  PRICE_PRESSURE_LOW,
  STOCK_LOW_THRESHOLD,
  STOCK_HIGH_THRESHOLD,
  PRICE_MIN,
  PRICE_MAX,
  CRON_SECRET_HEADER,
} from '@/lib/game/config'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const secret = req.headers.get(CRON_SECRET_HEADER)
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const results: Record<string, unknown>[] = []

  try {
    // Alle Marktpreise mit Lagerbeständen laden
    const { data: prices, error: priceError } = await supabase
      .from('market_prices')
      .select('*, locations(slug)')

    if (priceError) throw priceError

    for (const price of prices ?? []) {
      // Lagerbestand für diese Ressource laden
      const { data: res, error: resError } = await supabase
        .from('location_resources')
        .select('stock')
        .eq('location_id', price.location_id)
        .eq('resource', price.resource)
        .single()

      if (resError) continue

      const stock = res?.stock ?? 0

      // Preisdruck berechnen
      let multiplier = 1.0
      if (stock < STOCK_LOW_THRESHOLD) {
        multiplier = PRICE_PRESSURE_HIGH   // Knappheit → Preis steigt
      } else if (stock > STOCK_HIGH_THRESHOLD) {
        multiplier = PRICE_PRESSURE_LOW    // Überfluss → Preis sinkt
      }

      if (multiplier === 1.0) continue     // kein Update nötig

      // Neue Preise berechnen
      const newBuy = Math.round(
        Math.max(PRICE_MIN, Math.min(PRICE_MAX, price.buy_price * multiplier))
      )
      const newSell = Math.round(
        Math.max(PRICE_MIN, Math.min(PRICE_MAX - 1, price.sell_price * multiplier))
      )

      // sell muss immer unter buy bleiben
      const safeSell = Math.min(newSell, newBuy - 1)

      const { error: updateError } = await supabase
        .from('market_prices')
        .update({ buy_price: newBuy, sell_price: safeSell })
        .eq('id', price.id)

      if (updateError) throw updateError

      results.push({
        location: price.locations?.slug,
        resource: price.resource,
        stock,
        buy:  { before: price.buy_price,  after: newBuy },
        sell: { before: price.sell_price, after: safeSell },
        multiplier,
      })
    }

    return NextResponse.json({ ok: true, tick: 'prices', results })

  } catch (err) {
    console.error('Prices tick error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}