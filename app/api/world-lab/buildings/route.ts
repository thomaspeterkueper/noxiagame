// app/api/world-lab/buildings/route.ts
// Prototyp „eine Welt“: die NOXIA-Gebäude auf der Erde mit ihrer Position. Nur lesend.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'

export async function GET(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const { data: earth } = await supabase.from('locations').select('id').eq('slug', 'earth').maybeSingle()
  if (!earth) return NextResponse.json({ buildings: [] })
  const [{ data: rows }, { data: definitions }] = await Promise.all([
    supabase.from('tile_entities').select('id,entity_id,latitude_deg,longitude_deg,footprint_width_m,footprint_depth_m,rotation_deg,profile_id,owner_class,profiles(username),actors(display_name)')
      // Straßenstücke aus dem alten Bausystem gehören nicht in die Karte – Straßen kommen aus OpenStreetMap.
      .eq('location_id', earth.id).eq('entity_type', 'building').eq('status', 'active').neq('entity_id', 'road').not('latitude_deg', 'is', null).limit(1000),
    supabase.from('building_definitions').select('key,name'),
  ])
  const names = new Map<string, string>((definitions ?? []).map((row: any) => [String(row.key), String(row.name)]))
  return NextResponse.json({
    buildings: (rows ?? []).map((row: any) => ({
      id: row.id, typeId: row.entity_id, name: names.get(String(row.entity_id)) ?? row.entity_id,
      lat: Number(row.latitude_deg), lon: Number(row.longitude_deg),
      w: Number(row.footprint_width_m ?? 18), d: Number(row.footprint_depth_m ?? 14), rotation: Number(row.rotation_deg ?? 0),
      // Eigentümer wie in /api/game/build/spatial
      own: row.profile_id === profileId,
      ownerLabel: row.profile_id === profileId ? 'Dein Gebäude'
        : row.owner_class === 'STATE' ? 'Staatlich'
          : row.owner_class === 'CORPORATION' ? 'Corporation'
            : row.actors?.display_name ?? row.profiles?.username ?? 'Anderer Pilot',
    })),
  }, { headers: { 'Cache-Control': 'private, max-age=60' } })
}
