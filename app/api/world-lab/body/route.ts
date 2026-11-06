// app/api/world-lab/body/route.ts
// Weltkarte jenseits der Erde (06.11.2026): die Gebäude eines Ortes auf einem anderen
// Himmelskörper mit ihrer echten Lage auf diesem Körper. Nur lesend.
//
// Quelle der Lage: `world_frames` (Ursprung des Ortes in Breite/Länge des Körpers) und
// die metrischen Koordinaten der Gebäude (`tile_entities.x_m/y_m`, Ost/Nord, placement_mode
// 'world'). Gebäude nur mit altem Rasterplatz (`legacy_tile`) haben keine Lage und werden
// nicht gezeichnet – Rasterplätze werden nicht in Meter umgerechnet (ADR-single-world-surface).

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { localEnuToPlanetary, PLANETARY_REFERENCES } from '@/lib/game/spatial/planetary'
import { WORLD_MAP_LOCATIONS } from '@/lib/worldlab/bodies'
import { PUBLIC_SYMBOLS } from '@/lib/worldlab/blocks'

export async function GET(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const slug = req.nextUrl.searchParams.get('location') ?? ''
  const body = WORLD_MAP_LOCATIONS[slug]
  if (!body || body === 'earth') return NextResponse.json({ error: 'Ort nicht in der neuen Weltkarte' }, { status: 400 })
  const supabase = createServiceClient()
  const { data: location } = await supabase.from('locations').select('id,name').eq('slug', slug).maybeSingle()
  if (!location) return NextResponse.json({ error: 'Ort fehlt' }, { status: 404 })
  const { data: frame } = await supabase.from('world_frames').select('origin_lat_deg,origin_lon_deg').eq('location_id', location.id).maybeSingle()
  if (frame?.origin_lat_deg == null || frame?.origin_lon_deg == null) return NextResponse.json({ error: 'Ort ohne Ursprung (world_frames)' }, { status: 409 })
  const origin = { latDeg: Number(frame.origin_lat_deg), lonDeg: Number(frame.origin_lon_deg), elevationM: 0 }
  const reference = PLANETARY_REFERENCES[body]

  const [{ data: rows }, { data: definitions }] = await Promise.all([
    supabase.from('tile_entities').select('id,entity_id,x_m,y_m,footprint_width_m,footprint_depth_m,rotation_deg,profile_id,owner_class,display_name,placement_mode,profiles(username),actors(display_name)')
      .eq('location_id', location.id).eq('entity_type', 'building').eq('status', 'active').neq('entity_id', 'road').limit(1000),
    supabase.from('building_definitions').select('key,name'),
  ])
  type Row = { id: string; entity_id: string; x_m: number | null; y_m: number | null; footprint_width_m: number | null; footprint_depth_m: number | null; rotation_deg: number | null; profile_id: string | null; owner_class: string | null; display_name: string | null; placement_mode: string | null; profiles?: { username?: string } | null; actors?: { display_name?: string } | null }
  const names = new Map<string, string>((definitions ?? []).map(row => [String(row.key), String(row.name)]))
  const all = (rows ?? []) as unknown as Row[]
  const placed = all.filter(row => row.placement_mode === 'world' && row.x_m != null && row.y_m != null)

  return NextResponse.json({
    body,
    name: location.name,
    origin: { lat: origin.latDeg, lon: origin.lonDeg },
    /** Gebäude ohne metrische Lage (nur alter Rasterplatz) – zur Anzeige „nicht auf der Karte“ */
    unplaced: all.length - placed.length,
    buildings: placed.map(row => {
      const geo = localEnuToPlanetary({ eastM: Number(row.x_m), northM: Number(row.y_m), upM: 0 }, origin, reference)
      return {
        id: row.id, typeId: row.entity_id,
        name: row.display_name ?? names.get(String(row.entity_id)) ?? String(row.entity_id).replace(/_/g, ' '),
        lat: geo.latDeg, lon: geo.lonDeg,
        w: Number(row.footprint_width_m ?? 18), d: Number(row.footprint_depth_m ?? 14), rotation: Number(row.rotation_deg ?? 0),
        own: row.profile_id === profileId,
        // Plakette nur für öffentliche Einrichtungen mit eigenem Symbol (Verwaltung, Bank, Schule …) –
        // in einer Kolonie ist fast alles staatlich; eine Plakette über jedem Modul verdeckt die Karte.
        public: row.owner_class === 'STATE' && !row.profile_id && Boolean(PUBLIC_SYMBOLS[String(row.entity_id)]),
        ownerLabel: row.profile_id === profileId ? 'Dein Gebäude'
          : row.owner_class === 'STATE' ? 'Staatlich'
            : row.owner_class === 'CORPORATION' ? 'Corporation'
              : row.owner_class === 'NPC' ? 'Bewohner'
                : row.actors?.display_name ?? row.profiles?.username ?? 'Anderer Pilot',
      }
    }),
  }, { headers: { 'Cache-Control': 'private, max-age=60' } })
}
