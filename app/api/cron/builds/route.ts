// app/api/cron/builds/route.ts
// Erstellt: 31.05.2026
// Aktualisiert: 09.10.2026 — Bugfix: Bau-Abschluss wird dem Spieler gemeldet (publishBuildCompleted
//               wurde nie aufgerufen, der Toast „Bau abgeschlossen!" konnte nie erscheinen)
// Vorher:       10.09.2026 — atomarer Build-Abschluss über NOXIA Game Core
// Version:      1.2.1
//
// Cron-Job: Prüft fällige Bauaufträge. Die eigentliche Zustandsänderung liegt
// ausschließlich im transaktionalen Core-Command noxia_complete_build().

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { completeBuildCommand } from '@/lib/game/core/commands'
import { CRON_SECRET_HEADER } from '@/lib/game/config'
import { BUILDINGS } from '@/lib/game/buildings/index'
import { publishBuildCompleted } from '@/lib/ably/server'

export async function GET(req: NextRequest) {
  const secret = req.headers.get(CRON_SECRET_HEADER)
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const completed: Record<string, unknown>[] = []
  const failed: string[] = []

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

        const result = await completeBuildCommand(build.id, !buildable.planned)

        // Nur melden, wenn dieser Lauf den Bau wirklich abgeschlossen hat. Die
        // Meldung ist reine Anzeige: schlägt sie fehl, bleibt der Bau gültig.
        if (!result.idempotent && build.profile_id) {
          try {
            await publishBuildCompleted(build.profile_id, {
              entityId: String(result.entity_id ?? build.buildable_id),
              entityName: buildable.name,
              locationSlug: build.locations?.slug ?? '',
            })
          } catch (notifyErr) {
            console.error(`Build ${build.id}: Abschlussmeldung fehlgeschlagen:`, notifyErr)
          }
        }

        completed.push({
          buildId: build.id,
          profileId: build.profile_id,
          buildable: buildable.name,
          location: build.locations?.slug,
          tileRow: build.tile_row,
          tileCol: build.tile_col,
          entityId: result.entity_id ?? null,
          idempotent: result.idempotent ?? false,
        })
      } catch (buildErr) {
        console.error(`Build ${build.id} fehlgeschlagen:`, buildErr)
        failed.push(build.id)
      }
    }

    return NextResponse.json({
      ok: true,
      tick: 'builds',
      completed: completed.length,
      failed: failed.length,
      builds: completed,
    })
  } catch (err) {
    console.error('Builds cron error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
