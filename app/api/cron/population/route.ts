// app/api/cron/population/route.ts
// Erstellt: 30.05.2026
// Aktualisiert: 07.06.2026 – tile_entities, Basiswert-Neuberechnung,
//                            Überbelegung nach Habitat-Verkauf
//
// Kernprinzip: production und population_max werden jeden Tick FRISCH
// aus Basiswert + Gebäudebestand berechnet (nie inkrementell auf dem
// eigenen Output – das war die Ursache zweier Aufschaukel-Bugs).
// Dadurch sinken Kapazität/Produktion automatisch bei Gebäude-Verkauf.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  GROWTH_RATE,
  DECLINE_RATE,
  CONSUMPTION_PER_100,
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
    const { data: locations, error: locError } = await supabase
      .from('locations')
      .select('*')
    if (locError) throw locError

    for (const loc of locations ?? []) {
      // Ressourcenbestände laden
      const { data: resources, error: resError } = await supabase
        .from('location_resources')
        .select('*')
        .eq('location_id', loc.id)
      if (resError) throw resError

      const stock: Record<string, number> = {}
      const resMap: Record<string, any> = {}
      for (const r of resources ?? []) {
        stock[r.resource] = r.stock
        resMap[r.resource] = r
      }

      // Gebäudebestand dieser Kolonie (alle Spieler, alle Ebenen)
      const { data: buildings } = await supabase
        .from('tile_entities')
        .select('entity_id')
        .eq('location_id', loc.id)
        .eq('entity_type', 'building')

      const buildingCounts: Record<string, number> = {}
      for (const b of buildings ?? []) {
        buildingCounts[b.entity_id] = (buildingCounts[b.entity_id] ?? 0) + 1
      }

      const pop = loc.population

      // ── Kapazität: frisch aus Basis + Habitaten ──
      const popMax =
        (loc.base_population_max ?? loc.population_max) +
        (buildingCounts['habitat'] ?? 0) * 100

      // Verbrauch pro Tick
      const consumed = {
        water:  Math.ceil((pop / 100) * CONSUMPTION_PER_100.water),
        energy: Math.ceil((pop / 100) * CONSUMPTION_PER_100.energy),
        metal:  Math.ceil((pop / 100) * CONSUMPTION_PER_100.metal),
      }

      // Versorgung prüfen
      const isSupplied =
        (stock['water']  ?? 0) >= consumed.water &&
        (stock['energy'] ?? 0) >= consumed.energy &&
        (stock['metal']  ?? 0) >= consumed.metal

      // ── Lagerbestände: Produktion frisch aus Basis + Gebäuden ──
      for (const res of ['water', 'energy', 'metal'] as const) {
        const r = resMap[res]
        if (!r) continue

        const mineBonus  = res === 'metal'  ? (buildingCounts['mine']  ?? 0) * 5 : 0
        const solarBonus = res === 'energy' ? (buildingCounts['solar'] ?? 0) * 4 : 0
        const totalProd  = (r.base_production ?? r.production) + mineBonus + solarBonus

        const newStock = Math.max(0, r.stock + totalProd - consumed[res])

        await supabase
          .from('location_resources')
          .update({
            stock:       newStock,
            production:  totalProd,      // Anzeige-Wert; Quelle ist base_production
            consumption: consumed[res],
          })
          .eq('id', r.id)

        stock[res] = newStock
      }

      // ── Bevölkerung ──
      let newPop: number
      let overcrowded = false

      if (pop > popMax) {
        // Überbelegung (z.B. nach Habitat-Verkauf): Wohnungsnot.
        // Beschleunigter Rückgang Richtung Kapazität – unabhängig
        // von der Versorgung. Trifft die ganze Kolonie.
        overcrowded = true
        const decline = Math.ceil(pop * DECLINE_RATE)
        newPop = Math.max(popMax, pop - decline)
      } else {
        const rate = isSupplied ? GROWTH_RATE : -DECLINE_RATE
        newPop = Math.round(
          Math.max(0, Math.min(popMax, pop * (1 + rate)))
        )
      }

      await supabase
        .from('locations')
        .update({
          population:     newPop,
          population_max: popMax,
          is_supplied:    isSupplied,
        })
        .eq('id', loc.id)

      results.push({
        location:    loc.slug,
        population:  { before: pop, after: newPop, max: popMax },
        is_supplied: isSupplied,
        overcrowded,
        consumed,
        stock,
        buildings:   buildingCounts,
      })
    }

    // Tick protokollieren
    const { data: lastTick } = await supabase
      .from('simulation_ticks')
      .select('tick_number')
      .order('tick_number', { ascending: false })
      .limit(1)
      .single()

    const nextTick = (lastTick?.tick_number ?? 0) + 1

    await supabase.from('simulation_ticks').insert({
      tick_number: nextTick,
      finished_at: new Date().toISOString(),
      summary: {
        populations_updated: results.length,
        tick_type: 'population',
      },
    })

    return NextResponse.json({ ok: true, tick: 'population', tickNumber: nextTick, results })

  } catch (err) {
    console.error('Population tick error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
