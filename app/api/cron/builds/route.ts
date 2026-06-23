// app/api/cron/builds/route.ts
// Erstellt: 31.05.2026
// Aktualisiert: 23.06.2026 — BUILDABLE_ITEMS durch BUILDINGS aus buildings/index ersetzt
// Version:      1.1.0
//
// Cron-Job: Prüft fertige Bauaufträge und aktiviert sie.
// Läuft täglich um 11:00 UTC (vercel.json).
//
// Hinweis: completeBuild in build/route.ts erledigt dasselbe on-demand beim
// nächsten Dashboard-Load. Dieser Cron ist der Fallback für Spieler die
// mehrere Tage nicht einloggen.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { CRON_SECRET_HEADER } from '@/lib/game/config'
import { BUILDINGS } from '@/lib/game/buildings/index'

export async function GET(req: NextRequest) {
  const secret = req.headers.get(CRON_SECRET_HEADER)
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const completed: Record<string, unknown>[] = []
  const failed:    string[] = []

  try {
    const { data: readyBuilds, error: fetchError } = await supabase
      .from('player_builds')
      .select('*, locations(id, slug, population_max)')
      .eq('status', 'building')
      .lte('completes_at', new Date().toISOString())

    if (fetchError) throw fetchError

    for (const build of readyBuilds ?? []) {
      try {
        const buildable = BUILDINGS[build.buildable_id]
        if (!buildable) {
          failed.push(`Unbekannter buildable_id: ${build.buildable_id}`)
          continue
        }

        // Build-Status auf 'complete' setzen
        const { error: updateError } = await supabase
          .from('player_builds')
          .update({ status: 'complete' })
          .eq('id', build.id)

        if (updateError) throw updateError

        // Gebäude in tile_entities eintragen (Weltzustand)
        if (!buildable.planned) {
          const { error: entityError } = await supabase
            .from('tile_entities')
            .insert({
              profile_id:  build.profile_id,
              location_id: build.location_id,
              tile_level:  build.tile_level ?? 0,
              tile_row:    build.tile_row,
              tile_col:    build.tile_col,
              entity_type: 'building',
              entity_id:   build.buildable_id,
            })

          if (entityError) throw entityError
        }

        completed.push({
          buildId:   build.id,
          profileId: build.profile_id,
          buildable: buildable.name,
          location:  build.locations?.slug,
          tileRow:   build.tile_row,
          tileCol:   build.tile_col,
        })

      } catch (buildErr) {
        console.error(`Build ${build.id} fehlgeschlagen:`, buildErr)
        failed.push(build.id)
      }
    }

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
