// ============================================================
// NOXIA – Cron: Bevölkerungswachstum
// Läuft alle 5 Minuten (vercel.json)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  GROWTH_RATE,
  DECLINE_RATE,
  CONSUMPTION_PER_100,
  CRON_SECRET_HEADER,
} from '@/lib/game/config'

export async function GET(req: NextRequest) {
  // Cron Secret prüfen
  const secret = req.headers.get(CRON_SECRET_HEADER)
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const results: Record<string, unknown>[] = []

  try {
    const { data: locations, error: locError } = await supabase
      .from('locations')
      .select('*')

    if (locError) throw locError

    for (const loc of locations ?? []) {
      const { data: resources, error: resError } = await supabase
        .from('location_resources')
        .select('*')
        .eq('location_id', loc.id)

      if (resError) throw resError

      const stock: Record<string, number> = {}
      for (const r of resources ?? []) {
        stock[r.resource] = r.stock
      }

      const pop = loc.population
      const needed = {
        water:  Math.ceil((pop / 100) * CONSUMPTION_PER_100.water),
        energy: Math.ceil((pop / 100) * CONSUMPTION_PER_100.energy),
        metal:  Math.ceil((pop / 100) * CONSUMPTION_PER_100.metal),
      }

      const isSupplied =
        (stock['water']  ?? 0) >= needed.water &&
        (stock['energy'] ?? 0) >= needed.energy &&
        (stock['metal']  ?? 0) >= needed.metal

      const rate = isSupplied ? GROWTH_RATE : -DECLINE_RATE
      const newPop = Math.round(
        Math.max(0, Math.min(loc.population_max, pop * (1 + rate)))
      )

      const { error: updateError } = await supabase
        .from('locations')
        .update({
          population:  newPop,
          is_supplied: isSupplied,
        })
        .eq('id', loc.id)

      if (updateError) throw updateError

      results.push({
        location:    loc.slug,
        population:  { before: pop, after: newPop },
        is_supplied: isSupplied,
        needed,
        stock,
      })
    }

    return NextResponse.json({ ok: true, tick: 'population', results })

  } catch (err) {
    console.error('Population tick error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}