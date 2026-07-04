// route.ts
// Aktualisiert: 30.05.2026 — Bevölkerungsbasierte Preisanpassung
// Version:      0.2.0
// app/api/cron/prices/route.ts
// Erstellt: 30.05.2026
// Aktualisiert: 30.05.2026 – Bevölkerungsbasierte Preisanpassung

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

export async function GET(req: NextRequest) {
  const secret = req.headers.get(CRON_SECRET_HEADER)
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const results: Record<string, unknown>[] = []

  try {
    // Alle Marktpreise mit Lagerbeständen und Koloniedaten laden
    const { data: prices, error: priceError } = await supabase
      .from('market_prices')
      .select('*, locations(id, slug, population, population_max, is_supplied)')
    if (priceError) throw priceError

    for (const price of prices ?? []) {
      const loc = price.locations
      if (!loc) continue

      // Lagerbestand für diese Ressource laden
      const { data: res } = await supabase
        .from('location_resources')
        .select('stock, consumption, production')
        .eq('location_id', loc.id)
        .eq('resource', price.resource)
        .single()

      if (!res) continue

      const stock = res.stock ?? 0
      const consumption = res.consumption ?? 0
      const production = res.production ?? 0
      const balance = production - consumption

      // Preisdruck berechnen
      // 1. Lagerbestand-Druck
      let multiplier = 1.0
      if (stock < STOCK_LOW_THRESHOLD) {
        multiplier = PRICE_PRESSURE_HIGH  // Knappheit → Preis steigt
      } else if (stock > STOCK_HIGH_THRESHOLD) {
        multiplier = PRICE_PRESSURE_LOW   // Überfluss → Preis sinkt
      }

      // 2. Bilanz-Druck (sinkendes Lager = steigender Preis)
      if (balance < -5 && stock < 200) {
        multiplier = Math.max(multiplier, 1.03)  // zusätzlicher Druck
      } else if (balance > 5 && stock > 300) {
        multiplier = Math.min(multiplier, 0.98)  // Entspannung
      }

      // 3. Versorgungsstatus
      if (!loc.is_supplied && price.resource === 'water') {
        multiplier = Math.max(multiplier, 1.08)  // Wasserkrise
      }

      // 4. Bevölkerungsdruck (große Kolonien zahlen mehr)
      const popPct = loc.population / loc.population_max
      if (popPct > 0.7 && price.resource === 'water') {
        multiplier = Math.max(multiplier, 1.02)
      }

      if (multiplier === 1.0) {
        // Leichte Rückkehr zum Normalpreis (mean reversion)
        const basePrice = price.buy_price
        if (basePrice > 200) multiplier = 0.99
        else if (basePrice < 30) multiplier = 1.01
      }

      // Neue Preise berechnen
      const newBuy = Math.round(
        Math.max(PRICE_MIN, Math.min(PRICE_MAX, price.buy_price * multiplier))
      )
      const newSell = Math.round(
        Math.max(PRICE_MIN, Math.min(PRICE_MAX - 1, price.sell_price * multiplier))
      )
      const safeSell = Math.min(newSell, newBuy - 5)  // mind. 5 Cr Spread

      if (newBuy === price.buy_price && safeSell === price.sell_price) continue

      const { error: updateError } = await supabase
        .from('market_prices')
        .update({ buy_price: newBuy, sell_price: safeSell })
        .eq('id', price.id)

      if (updateError) throw updateError

      results.push({
        location:   loc.slug,
        resource:   price.resource,
        stock,
        balance,
        buy:  { before: price.buy_price,  after: newBuy },
        sell: { before: price.sell_price, after: safeSell },
        multiplier: multiplier.toFixed(3),
      })
    }

    return NextResponse.json({ ok: true, tick: 'prices', updated: results.length, results })

  } catch (err) {
    console.error('Prices tick error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}