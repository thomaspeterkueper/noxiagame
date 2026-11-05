// app/api/game/jobs/route.ts
// Erstellt: 30.10.2026 — Stellenliste der Agentur für Arbeit (R-21 Punkt 2)
// GET ?location=earth → { venues: { [tileEntityId]: { open: ShiftRole[], wages: { [role]: CrJeStunde } } } }
// Je Lokal des Ortes die Stellen, die dieser Spieler dort jetzt antreten könnte
// (frei, Arbeitgeber zahlungsfähig, keine Sperre, keine Pause) – noxia_player_shift_state.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'

const VENUES = ['cafe', 'bar', 'restaurant', 'hotel', 'nightclub']

export async function GET(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const slug = new URL(req.url).searchParams.get('location') ?? 'earth'
  const supabase = createServiceClient()
  const { data: location } = await supabase.from('locations').select('id').eq('slug', slug).maybeSingle()
  if (!location) return NextResponse.json({ error: 'Ort nicht gefunden.' }, { status: 404 })
  const { data: tiles } = await supabase.from('tile_entities').select('id').eq('location_id', location.id).eq('status', 'active').eq('entity_type', 'building').in('entity_id', VENUES).limit(200)
  const venues: Record<string, { open: string[]; wages: Record<string, number> }> = {}
  await Promise.all((tiles ?? []).map(async (tile: { id: string }) => {
    const { data } = await supabase.rpc('noxia_player_shift_state', { p_profile_id: profileId, p_tile_entity_id: tile.id })
    if (!data) return
    const blocked = Boolean(data.standing?.blockedUntil) || Boolean(data.standing?.nextShiftAt)
    venues[tile.id] = { open: blocked ? [] : (data.open ?? []), wages: data.wages ?? {} }
  }))
  return NextResponse.json({ venues })
}
