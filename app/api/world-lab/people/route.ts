// app/api/world-lab/people/route.ts
// Authenticated coarse presence for named Earth residents on the continuous world map.
// Source of truth is person_surface_presence; no client-side inference of hidden positions.
//
// 28.10.2026 (NOXIA-NPC-RELIGION-0002, sichtbares Gehen): zusätzlich `states` je
// aktiver Person – Tätigkeit, Schlaf und die Wohnung als Ausgangspunkt. Die Karte
// zeichnet damit Wege zwischen den autoritativen Orten und lässt Schlafende in
// ihrer Wohnung, statt sie auf einer beliebigen Straße auftauchen zu lassen.
// Kein neuer Aufenthaltsort: Die Wohnung ist eine bestehende Zuweisung.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { isAsleepAction } from '@/lib/game/population/circadian'

export async function GET(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: earth } = await supabase.from('locations').select('id').eq('slug', 'earth').maybeSingle()
  if (!earth) return NextResponse.json({ people: [], states: [] })

  const [presenceQ, peopleQ, homesQ] = await Promise.all([
    supabase
      .from('person_surface_presence')
      .select('person_id,latitude_deg,longitude_deg,spatial_region_id,source_kind,source_ref,confidence,updated_tick,people!inner(display_name,simulation_tier)')
      .eq('location_id', earth.id)
      .not('latitude_deg', 'is', null)
      .not('longitude_deg', 'is', null)
      .limit(250),
    supabase
      .from('people')
      .select('id,activity_state,last_action')
      .eq('current_location_id', earth.id)
      .eq('simulation_tier', 'active')
      .limit(400),
    supabase
      .from('person_assignments')
      .select('person_id,tile_entity_id,region_feature_id')
      .eq('location_id', earth.id)
      .eq('assignment_type', 'home')
      .eq('is_active', true)
      .limit(400),
  ])

  if (presenceQ.error) return NextResponse.json({ error: presenceQ.error.message }, { status: 500 })

  // Wohnungen: nur bestehende Gebäude mit Geodaten.
  type HomeTile = { id: string; latitude_deg: number | null; longitude_deg: number | null }
  type PersonRow = { id: string; activity_state: string | null; last_action: string | null }
  type HomeFeature = { id: string; geometry: { kind?: string; coordinates?: unknown } | null }
  // Wohnung: ein Gebäude des Spiels oder ein reales, nicht gekauftes Haus (Grundriss).
  const homeByPerson = new Map<string, string>()
  const featureHomeByPerson = new Map<string, string>()
  for (const row of (homesQ.data ?? []) as Array<{ person_id: string; tile_entity_id: string | null; region_feature_id: string | null }>) {
    const id = String(row.person_id)
    if (row.tile_entity_id && !homeByPerson.has(id)) homeByPerson.set(id, String(row.tile_entity_id))
    else if (!row.tile_entity_id && row.region_feature_id && !featureHomeByPerson.has(id)) featureHomeByPerson.set(id, String(row.region_feature_id))
  }
  const tileIds = [...new Set(homeByPerson.values())]
  const featureIds = [...new Set(featureHomeByPerson.values())]
  const [tilesQ, featuresQ] = await Promise.all([
    tileIds.length
      ? supabase.from('tile_entities').select('id,latitude_deg,longitude_deg').in('id', tileIds)
      : Promise.resolve({ data: [] as HomeTile[], error: null }),
    featureIds.length
      ? supabase.from('region_features').select('id,geometry').in('id', featureIds)
      : Promise.resolve({ data: [] as HomeFeature[], error: null }),
  ])
  const tileById = new Map(((tilesQ.data ?? []) as HomeTile[]).map(row => [String(row.id), row]))
  const featureCenter = new Map<string, { lat: number; lon: number }>()
  for (const row of (featuresQ.data ?? []) as HomeFeature[]) {
    const geometry = row.geometry
    const points = geometry?.kind === 'polygon' && Array.isArray(geometry.coordinates)
      ? (geometry.coordinates as Array<{ lat?: unknown; lon?: unknown }>).map(p => ({ lat: Number(p?.lat), lon: Number(p?.lon) })).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon))
      : geometry?.kind === 'point' ? [{ lat: Number((geometry.coordinates as { lat?: unknown })?.lat), lon: Number((geometry.coordinates as { lon?: unknown })?.lon) }].filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon)) : []
    if (points.length) featureCenter.set(String(row.id), { lat: points.reduce((a, p) => a + p.lat, 0) / points.length, lon: points.reduce((a, p) => a + p.lon, 0) / points.length })
  }

  const states = ((peopleQ.data ?? []) as PersonRow[]).map(row => {
    const tile = tileById.get(homeByPerson.get(String(row.id)) ?? '')
    const lat = Number(tile?.latitude_deg), lon = Number(tile?.longitude_deg)
    const featureHome = featureCenter.get(featureHomeByPerson.get(String(row.id)) ?? '') ?? null
    return {
      id: String(row.id),
      activityState: String(row.activity_state ?? ''),
      asleep: isAsleepAction(row.last_action),
      home: tile && Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : featureHome,
    }
  })

  return NextResponse.json({
    people: (presenceQ.data ?? [])
      .filter((row: any) => row.people?.simulation_tier === 'active')
      .map((row: any) => ({
        id: String(row.person_id),
        displayName: String(row.people?.display_name ?? row.person_id),
        lat: Number(row.latitude_deg),
        lon: Number(row.longitude_deg),
        spatialRegionId: row.spatial_region_id ? String(row.spatial_region_id) : null,
        sourceKind: String(row.source_kind),
        sourceRef: String(row.source_ref),
        confidence: Number(row.confidence ?? 0),
        updatedTick: Number(row.updated_tick ?? 0),
      }))
      .filter((row: any) => Number.isFinite(row.lat) && Number.isFinite(row.lon)),
    states,
  }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
}
