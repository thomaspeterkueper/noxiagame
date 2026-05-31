// app/api/game/build/route.ts
// Erstellt: 31.05.2026
// Verwaltet Bauaufträge: starten, abbrechen, Status abfragen

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { BUILDABLE_ITEMS } from '@/lib/game/config'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Bearer Token aus Request lesen und User validieren
async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.split(' ')[1]
  const { data: { user } } = await serviceClient.auth.getUser(token)
  return user
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  // Aktive Bauaufträge laden
  if (!action) {
 // Alle Builds laden (building + complete) für Grid-Anzeige
const { data: builds } = await serviceClient
  .from('player_builds')
  .select('*, locations(slug, name)')
  .eq('profile_id', user.id)
  .in('status', ['building', 'complete'])  // ← beide Status
  .order('completes_at')

    // Fertige Builds automatisch abschließen
    const now = new Date()
    for (const build of builds ?? []) {
      if (new Date(build.completes_at) <= now) {
        await completeBuild(build, user.id)
      }
    }

    // Aktualisierte Liste zurückgeben
    const { data: activeBuild } = await serviceClient
      .from('player_builds')
      .select('*, locations(slug, name)')
      .eq('profile_id', user.id)
      .in('status', ['building', 'complete'])
      .order('completes_at')

    return NextResponse.json({ builds: activeBuild ?? [] })
  }

  // Bauauftrag starten
  if (action === 'start') {
    const buildableId  = searchParams.get('buildableId')
    const locationSlug = searchParams.get('location')
    const tileRow      = parseInt(searchParams.get('tileRow') ?? '0')
    const tileCol      = parseInt(searchParams.get('tileCol') ?? '0')

    if (!buildableId || !locationSlug) {
      return NextResponse.json({ error: 'Fehlende Parameter' }, { status: 400 })
    }

    const buildable = BUILDABLE_ITEMS[buildableId]
    if (!buildable) {
      return NextResponse.json({ error: 'Unbekannter Bautyp' }, { status: 400 })
    }

    // Spieler-Credits prüfen
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single()

    if (!profile || profile.credits < buildable.cost) {
      return NextResponse.json({ error: 'Unzureichende Credits.' }, { status: 400 })
    }

    // Kolonie finden
    const { data: location } = await serviceClient
      .from('locations')
      .select('id')
      .eq('slug', locationSlug)
      .single()

    if (!location) {
      return NextResponse.json({ error: 'Kolonie nicht gefunden' }, { status: 404 })
    }

    // Prüfen ob auf dieser Kachel schon gebaut wird
    const { data: existing } = await serviceClient
      .from('player_builds')
      .select('id')
      .eq('profile_id', user.id)
      .eq('location_id', location.id)
      .eq('tile_row', tileRow)
      .eq('tile_col', tileCol)
      .in('status', ['building', 'complete'])
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'Auf dieser Kachel wird bereits gebaut.' }, { status: 400 })
    }

    // Fertigstellungszeitpunkt berechnen (Ticks × 24h da Cron täglich)
    const completesAt = new Date()
    completesAt.setHours(completesAt.getHours() + buildable.buildTimeTicks * 24)

    // Bauauftrag erstellen
    await serviceClient.from('player_builds').insert({
      profile_id:   user.id,
      buildable_id: buildableId,
      target_type:  buildable.type,
      location_id:  location.id,
      tile_row:     tileRow,
      tile_col:     tileCol,
      status:       'building',
      completes_at: completesAt.toISOString(),
    })

    // Credits abziehen
    await serviceClient
      .from('profiles')
      .update({ credits: profile.credits - buildable.cost })
      .eq('id', user.id)

    return NextResponse.json({
      ok:          true,
      newCredits:  profile.credits - buildable.cost,
      buildable:   buildable.name,
      completesAt: completesAt.toISOString(),
    })
  }

  // Bauauftrag abbrechen (50% Rückerstattung)
  if (action === 'cancel') {
    const buildId = searchParams.get('buildId')
    if (!buildId) return NextResponse.json({ error: 'Fehlende Build ID' }, { status: 400 })

    const { data: build } = await serviceClient
      .from('player_builds')
      .select('*')
      .eq('id', buildId)
      .eq('profile_id', user.id)
      .in('status', ['building', 'complete'])
      .single()

    if (!build) return NextResponse.json({ error: 'Bauauftrag nicht gefunden' }, { status: 404 })

    const buildable = BUILDABLE_ITEMS[build.buildable_id]
    const refund = Math.floor((buildable?.cost ?? 0) * 0.5)

    await serviceClient
      .from('player_builds')
      .update({ status: 'cancelled' })
      .eq('id', buildId)

    const { data: profile } = await serviceClient
      .from('profiles').select('credits').eq('id', user.id).single()

    if (profile) {
      await serviceClient
        .from('profiles')
        .update({ credits: profile.credits + refund })
        .eq('id', user.id)
    }

    return NextResponse.json({ ok: true, refund })
  }

  return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 })
}

// Hilfsfunktion: Fertigen Build aktivieren
async function completeBuild(build: any, profileId: string) {
  const buildable = BUILDABLE_ITEMS[build.buildable_id]
  if (!buildable) return

  // Status auf complete setzen
  await serviceClient
    .from('player_builds')
    .update({ status: 'complete' })
    .eq('id', build.id)

  // Gebäude in player_buildings eintragen (für Cron-Berechnung)
  if (buildable.type === 'building') {
    await serviceClient.from('player_buildings').insert({
      profile_id:  profileId,
      location_id: build.location_id,
      building:    build.buildable_id,
    })
  }
}