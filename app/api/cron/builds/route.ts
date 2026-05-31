// app/api/cron/builds/route.ts
// Erstellt: 31.05.2026
//
// Cron-Job: Prüft fertige Bauaufträge und aktiviert sie.
// Läuft täglich um 11:00 UTC (vercel.json).
//
// Was passiert:
// 1. Alle player_builds mit status='building' und completes_at <= NOW() laden
// 2. Status auf 'complete' setzen
// 3. Gebäude in player_buildings eintragen (für Cron-Produktionsberechnung)
// 4. Bei Habitat: population_max der Kolonie erhöhen
// 5. Tick in simulation_ticks protokollieren

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { BUILDABLE_ITEMS, CRON_SECRET_HEADER } from '@/lib/game/config'

export async function GET(req: NextRequest) {
  // Cron-Secret prüfen
  const secret = req.headers.get(CRON_SECRET_HEADER)
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const completed: Record<string, unknown>[] = []
  const failed:    string[] = []

  try {
    // Alle fertigen Bauaufträge laden
    const { data: readyBuilds, error: fetchError } = await supabase
      .from('player_builds')
      .select('*, locations(id, slug, population_max)')
      .eq('status', 'building')
      .lte('completes_at', new Date().toISOString())

    if (fetchError) throw fetchError

    for (const build of readyBuilds ?? []) {
      try {
        const buildable = BUILDABLE_ITEMS[build.buildable_id]
        if (!buildable) {
          failed.push(`Unbekannter buildable_id: ${build.buildable_id}`)
          continue
        }

        // 1. Build-Status auf 'complete' setzen
        const { error: updateError } = await supabase
          .from('player_builds')
          .update({ status: 'complete' })
          .eq('id', build.id)

        if (updateError) throw updateError

        // 2. Gebäude in player_buildings eintragen (wird vom Population-Cron genutzt)
        if (buildable.type === 'building') {
          const { error: buildingError } = await supabase
            .from('player_buildings')
            .insert({
              profile_id:  build.profile_id,
              location_id: build.location_id,
              building:    build.buildable_id,
            })

          if (buildingError) throw buildingError
        }

        // 3. Habitat-Bonus: population_max der Kolonie erhöhen
        if (build.buildable_id === 'habitat' && build.locations?.id) {
          const { error: popError } = await supabase
            .from('locations')
            .update({
              population_max: (build.locations.population_max ?? 1000) + 100
            })
            .eq('id', build.location_id)

          if (popError) throw popError
        }

        completed.push({
          buildId:    build.id,
          profileId:  build.profile_id,
          buildable:  buildable.name,
          location:   build.locations?.slug,
          tileRow:    build.tile_row,
          tileCol:    build.tile_col,
        })

      } catch (buildErr) {
        console.error(`Build ${build.id} fehlgeschlagen:`, buildErr)
        failed.push(build.id)
      }
    }

    // Tick protokollieren
    const { data: lastTick } = await supabase
      .from('simulation_ticks')
      .select('tick_number')
      .order('tick_number', { ascending: false })
      .limit(1)
      .single()

    await supabase.from('simulation_ticks').insert({
      tick_number: (lastTick?.tick_number ?? 0) + 1,
      finished_at: new Date().toISOString(),
      summary: {
        tick_type:  'builds',
        completed:  completed.length,
        failed:     failed.length,
      },
    })

    return NextResponse.json({
      ok:        true,
      tick:      'builds',
      completed: completed.length,
      failed:    failed.length,
      builds:    completed,
    })

  } catch (err) {
    console.error('Builds cron error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}