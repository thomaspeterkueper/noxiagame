// app/api/world-lab/people/route.ts
// Authenticated coarse presence for named Earth residents on the continuous world map.
// Source of truth is person_surface_presence; no client-side inference of hidden positions.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'

export async function GET(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: earth } = await supabase.from('locations').select('id').eq('slug', 'earth').maybeSingle()
  if (!earth) return NextResponse.json({ people: [] })

  const { data, error } = await supabase
    .from('person_surface_presence')
    .select('person_id,latitude_deg,longitude_deg,spatial_region_id,source_kind,source_ref,confidence,updated_tick,people!inner(display_name,simulation_tier)')
    .eq('location_id', earth.id)
    .not('latitude_deg', 'is', null)
    .not('longitude_deg', 'is', null)
    .limit(250)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    people: (data ?? [])
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
  }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
}
