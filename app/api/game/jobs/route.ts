// app/api/game/jobs/route.ts
// Erstellt: 30.10.2026 — Stellenliste der Agentur für Arbeit (R-21 Punkt 2)
// GET ?location=earth → { venues: { [tileEntityId]: { open: ShiftRole[], wages: { [role]: CrJeStunde } } }, places: [{ id, typeId, name, lat, lon }] }
// `places` nennt auch reale Lokale (W-15), die nicht als NOXIA-Haus auf der Karte stehen.
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
  const { data: tiles } = await supabase.from('tile_entities').select('id,entity_id,display_name,latitude_deg,longitude_deg,source_tags').eq('location_id', location.id).eq('status', 'active').eq('entity_type', 'building').in('entity_id', VENUES).limit(200)
  // Reale Lokale ohne eigenes Personal sind geschlossen – dort gibt es keine Schicht (W-15, R-28).
  const realIds = (tiles ?? []).filter((t: any) => t.source_tags?.real_venue === true).map((t: any) => String(t.id))
  const { data: staffed } = realIds.length
    ? await supabase.from('person_assignments').select('tile_entity_id').in('tile_entity_id', realIds).eq('assignment_type', 'work').eq('is_active', true)
    : { data: [] as any[] }
  const withStaff = new Set((staffed ?? []).map((row: any) => String(row.tile_entity_id)))
  const usable = (tiles ?? []).filter((t: any) => t.source_tags?.real_venue !== true || withStaff.has(String(t.id)))
  const venues: Record<string, { open: string[]; wages: Record<string, number> }> = {}
  await Promise.all(usable.map(async (tile: any) => {
    const { data } = await supabase.rpc('noxia_player_shift_state', { p_profile_id: profileId, p_tile_entity_id: tile.id })
    if (!data) return
    const blocked = Boolean(data.standing?.blockedUntil) || Boolean(data.standing?.nextShiftAt)
    venues[tile.id] = { open: blocked ? [] : (data.open ?? []), wages: data.wages ?? {} }
  }))
  const label: Record<string, string> = { cafe: 'Café', bar: 'Bar', restaurant: 'Restaurant', hotel: 'Hotel', nightclub: 'Nachtclub' }
  const places = usable.filter((t: any) => t.latitude_deg != null && t.longitude_deg != null).map((t: any) => ({
    id: String(t.id), typeId: String(t.entity_id), lat: Number(t.latitude_deg), lon: Number(t.longitude_deg),
    name: t.display_name ? `${label[String(t.entity_id)] ?? 'Lokal'} · ${t.display_name}` : label[String(t.entity_id)] ?? 'Lokal',
  }))
  return NextResponse.json({ venues, places })
}
