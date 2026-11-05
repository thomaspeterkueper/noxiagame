// app/api/world-lab/buildings/route.ts
// Prototyp „eine Welt“: die NOXIA-Gebäude auf der Erde mit ihrer Position. Nur lesend.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { buildingLabel, earthBuildingName } from '@/lib/worldlab/earthNames'

export async function GET(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const { data: earth } = await supabase.from('locations').select('id').eq('slug', 'earth').maybeSingle()
  if (!earth) return NextResponse.json({ buildings: [] })
  const [{ data: rows }, { data: definitions }] = await Promise.all([
    supabase.from('tile_entities').select('id,entity_id,latitude_deg,longitude_deg,footprint_width_m,footprint_depth_m,rotation_deg,profile_id,owner_class,source_ref,display_name,conversion_plan,noxia_roof,profiles(username),actors(display_name)')
      // Straßenstücke aus dem alten Bausystem gehören nicht in die Karte – Straßen kommen aus OpenStreetMap.
      .eq('location_id', earth.id).eq('entity_type', 'building').eq('status', 'active').neq('entity_id', 'road').not('latitude_deg', 'is', null)
      // Echte Lokale, die erst beim Betreten ein NOXIA-Lokal bekommen (Gastronomie, 03.11.2026): das reale Haus bleibt, wie es ist.
      .or('source_tags->>real_venue.is.null,source_tags->>real_venue.neq.true').limit(1000),
    supabase.from('building_definitions').select('key,name'),
  ])
  // Abgerissene reale Gebäude: die Karte zeichnet dort eine freie Fläche (nur der Eigentümer darf bauen).
  const { data: parcelOwners } = await supabase.from('earth_parcel_owners').select('parcel_id,profile_id').limit(5000)
  // W-18: Veranstaltungen in Lokalen (laufend oder in den nächsten 24 Stunden), auch in realen Lokalen
  const nowIso = new Date().toISOString(), dayIso = new Date(Date.now() + 86_400_000).toISOString()
  const { data: eventRows } = await supabase.from('venue_events').select('id,tile_entity_id,kind,title,note,starts_at,ends_at').eq('cancelled', false).gt('ends_at', nowIso).lt('starts_at', dayIso).order('starts_at').limit(100)
  const eventTileIds = [...new Set((eventRows ?? []).map(row => String(row.tile_entity_id)))]
  const { data: eventTiles } = eventTileIds.length ? await supabase.from('tile_entities').select('id,entity_id,display_name,latitude_deg,longitude_deg,location_id').in('id', eventTileIds) : { data: [] as any[] }
  const eventTile = new Map((eventTiles ?? []).filter((row: any) => row.location_id === earth.id && row.latitude_deg !== null).map((row: any) => [String(row.id), row]))
  const { data: cleared } = await supabase.from('earth_cleared_buildings').select('source_ref,profile_id,latitude_deg,longitude_deg,footprint_width_m,footprint_depth_m,rotation_deg,display_name,cleared_at').limit(1000)
  // Namen wie auf der Erde üblich (W-8: „Habitat“ → „Wohnhaus“)
  const names = new Map<string, string>((definitions ?? []).map((row: any) => [String(row.key), earthBuildingName(String(row.key), String(row.name))]))
  return NextResponse.json({
    buildings: (rows ?? []).map((row: any) => ({
      id: row.id, typeId: row.entity_id, name: buildingLabel(String(row.entity_id), names.get(String(row.entity_id)), row.display_name), source: row.source_ref ?? undefined,
      // Laufender Umbau zum Lokal (R-13): Ziel und Fertigstellung; das Haus bleibt bis dahin, was es war.
      conversion: row.conversion_plan?.type ? { type: String(row.conversion_plan.type), name: names.get(String(row.conversion_plan.type)) ?? String(row.conversion_plan.type), readyAt: row.conversion_plan.ready_at ? String(row.conversion_plan.ready_at) : null } : undefined,
      lat: Number(row.latitude_deg), lon: Number(row.longitude_deg),
      w: Number(row.footprint_width_m ?? 18), d: Number(row.footprint_depth_m ?? 14), rotation: Number(row.rotation_deg ?? 0),
      // Eigentümer wie in /api/game/build/spatial
      own: row.profile_id === profileId,
      // Gebäude des Ortes (nicht von Spielern gekauft): auf der Karte mit NOXIA-Dach und Symbol (W-7).
      public: row.owner_class === 'STATE' && !row.profile_id,
      // Eigenes Gebäude im realen Haus, das trotzdem das NOXIA-Dach trägt (Startcafé, Thomas 27.10.2026).
      noxiaRoof: row.noxia_roof === true || undefined,
      ownerLabel: row.profile_id === profileId ? 'Dein Gebäude'
        : row.owner_class === 'STATE' ? 'Staatlich'
          : row.owner_class === 'CORPORATION' ? 'Corporation'
            : row.actors?.display_name ?? row.profiles?.username ?? 'Anderer Pilot',
    })),
    events: (eventRows ?? []).flatMap((row: any) => {
      const tile = eventTile.get(String(row.tile_entity_id))
      if (!tile) return []
      return [{ id: row.id, tileEntityId: row.tile_entity_id, kind: row.kind, title: row.title, note: row.note ?? null, startsAt: row.starts_at, endsAt: row.ends_at,
        venueName: buildingLabel(String(tile.entity_id), names.get(String(tile.entity_id)), tile.display_name), lat: Number(tile.latitude_deg), lon: Number(tile.longitude_deg) }]
    }),
    parcels: (parcelOwners ?? []).map(row => ({ id: String(row.parcel_id), own: row.profile_id === profileId })),
    plots: (cleared ?? []).map(row => ({
      source: String(row.source_ref), own: row.profile_id === profileId, name: row.display_name ?? 'Freie Fläche',
      lat: Number(row.latitude_deg), lon: Number(row.longitude_deg), w: Number(row.footprint_width_m), d: Number(row.footprint_depth_m), rotation: Number(row.rotation_deg ?? 0),
      clearedAt: row.cleared_at ? String(row.cleared_at) : undefined,
    })),
  }, { headers: { 'Cache-Control': 'private, max-age=60' } })
}
