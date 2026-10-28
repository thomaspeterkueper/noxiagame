// app/api/world-lab/worship/route.ts
// Gottesdienste und Gebete (Thomas, 28.10.2026): wo, wann, läuft gerade?
//
// Quelle sind die Gastgeber der Ortsaktivität (REAL_PLACE_HOSTS) und die eine
// Spieluhr (tick_log). Ein Tick ist eine Stunde; `startedAt`/`endsAt` sind die
// echten Zeitpunkte von Beginn und Ende, damit der Innenraum den Ablauf zeigt.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { REAL_PLACE_HOSTS, resolveHostPlace } from '@/lib/game/population/realPlaceActivity'
import { ACTIVITY_GROUP_LABEL, scheduleAt, scheduledWindowsFor, windowStartLabel, type ScheduledRow } from '@/lib/game/population/worship'
import { TICK_INTERVAL_SECONDS } from '@/lib/game/tick'
import type { WorshipItem } from '@/lib/worldlab/worshipTypes'

type Geometry = { kind?: string; coordinates?: unknown } | null

function centroid(geometry: Geometry) {
  if (!geometry) return null
  const points = geometry.kind === 'polygon' && Array.isArray(geometry.coordinates)
    ? (geometry.coordinates as Array<{ lat?: unknown; lon?: unknown }>).map(p => ({ lat: Number(p?.lat), lon: Number(p?.lon) }))
    : geometry.kind === 'point' ? [{ lat: Number((geometry.coordinates as { lat?: unknown })?.lat), lon: Number((geometry.coordinates as { lon?: unknown })?.lon) }] : []
  const ok = points.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon))
  return ok.length ? { lat: ok.reduce((a, p) => a + p.lat, 0) / ok.length, lon: ok.reduce((a, p) => a + p.lon, 0) / ok.length } : null
}

export async function GET(req: NextRequest) {
  if (!await verifiedBearerUserId(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()

  const [{ data: last }, { data: hosts }] = await Promise.all([
    supabase.from('tick_log').select('tick_number,created_at').order('tick_number', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('people').select('id,person_key,display_name,public_role,current_location_id').in('person_key', REAL_PLACE_HOSTS.map(host => host.personKey)),
  ])
  const tick = Number(last?.tick_number ?? 0)
  const tickMs = TICK_INTERVAL_SECONDS * 1000
  // Ein Tick beginnt zur vollen Stunde, in der er beansprucht wurde (claim_due_ticks).
  const tickStartMs = last?.created_at ? Math.floor(Date.parse(String(last.created_at)) / tickMs) * tickMs : Date.now()
  const atTick = (t: number) => new Date(tickStartMs + (t - tick) * tickMs).toISOString()

  const { data: scheduled } = await supabase.from('population_events').select('payload').eq('event_type', 'place_activity_scheduled').gte('tick', tick - 24 * 14)
  const locationIds = [...new Set((hosts ?? []).map(row => String(row.current_location_id)))]
  const { data: locations } = locationIds.length ? await supabase.from('locations').select('id,slug').in('id', locationIds) : { data: [] }
  const slugOf = new Map((locations ?? []).map(row => [String(row.id), String(row.slug)]))

  const items: WorshipItem[] = []
  for (const spec of REAL_PLACE_HOSTS) {
    const host = (hosts ?? []).find(row => row.person_key === spec.personKey)
    if (!host) continue
    const place = await resolveHostPlace(supabase, { id: String(host.id), current_location_id: String(host.current_location_id) }, spec.place)
    if (!place) continue
    let name = '', source: string | null = null, at: { lat: number; lon: number } | null = null
    if (place.regionFeatureId) {
      const { data: feature } = await supabase.from('region_features').select('properties,geometry').eq('id', place.regionFeatureId).maybeSingle()
      const props = (feature?.properties ?? {}) as Record<string, unknown>
      name = String(props.name ?? '') || [props['addr:street'], props['addr:housenumber']].filter(Boolean).join(' ')
      source = props.noxia_source_id ? String(props.noxia_source_id) : null
      at = centroid(feature?.geometry as Geometry)
    } else {
      const { data: tile } = await supabase.from('tile_entities').select('display_name,source_ref,latitude_deg,longitude_deg').eq('id', place.tileEntityId).maybeSingle()
      name = String(tile?.display_name ?? 'Resonanzplatz')
      source = tile?.source_ref ? String(tile.source_ref) : null
      at = tile?.latitude_deg != null && tile?.longitude_deg != null ? { lat: Number(tile.latitude_deg), lon: Number(tile.longitude_deg) } : null
    }
    const extra = scheduledWindowsFor((scheduled ?? []) as ScheduledRow[], spec.personKey)
    const { running, next } = scheduleAt(spec.windows, tick, extra)
    let attendees = 0
    if (running) {
      const query = supabase.from('person_assignments').select('id', { count: 'exact', head: true })
        .eq('assignment_type', 'temporary').eq('is_active', true).like('role_code', 'visit:real_place:%').neq('person_id', host.id)
      const { count } = place.regionFeatureId ? await query.eq('region_feature_id', place.regionFeatureId) : await query.eq('tile_entity_id', place.tileEntityId)
      attendees = count ?? 0
    }
    items.push({
      id: spec.personKey,
      location: slugOf.get(String(host.current_location_id)) ?? null,
      name: name || 'Gotteshaus',
      source, at,
      tradition: spec.tradition,
      host: { id: String(host.id), name: String(host.display_name ?? ''), role: String(host.public_role ?? '') },
      running: running ? { kind: running.kind, label: running.label, group: ACTIVITY_GROUP_LABEL[running.kind], startedAt: atTick(running.startTick), endsAt: atTick(running.endTick), attendees } : null,
      next: next ? { kind: next.kind, label: next.label, group: ACTIVITY_GROUP_LABEL[next.kind], when: windowStartLabel(next.startTick), startsAt: atTick(next.startTick) } : null,
    })
  }
  return NextResponse.json({ tick, items }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
}
