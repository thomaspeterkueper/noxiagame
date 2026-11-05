// app/api/game/hospitality/real-venue/route.ts
// Erstellt: 03.11.2026 — Echte Lokale der Karte als volle Lokale (Thomas: „Lokale zusammenführen“)
// POST { source, amenity, name, lat, lon, w?, d?, rotation? } → { id, kind, name, created }
// Sucht das NOXIA-Lokal zum realen Café, zur Bar, Kneipe oder zum Restaurant
// (gleiche OSM-Kennung oder höchstens 25 m entfernt) oder legt es an
// (noxia_real_venue, 20261103180000_real_venues.sql).

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { earthPlaceSlug } from '@/lib/world/spatial/earthPlaceIdentity'

const finite = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : null }

export async function POST(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const lat = finite(body?.lat), lon = finite(body?.lon)
  const source = String(body?.source ?? '')
  if (lat == null || lon == null || !/^osm:(node|way|relation):\d+$/.test(source)) return NextResponse.json({ error: 'Ort fehlt.' }, { status: 400 })
  const { data, error } = await createServiceClient().rpc('noxia_real_venue', {
    p_source_ref: source, p_amenity: String(body?.amenity ?? '').slice(0, 30), p_name: String(body?.name ?? '').slice(0, 80),
    p_lat: lat, p_lon: lon, p_region_id: earthPlaceSlug({ lat, lon }),
    p_width_m: finite(body?.w), p_depth_m: finite(body?.d), p_rotation_deg: finite(body?.rotation) ?? 0,
  })
  if (error) {
    const kind = String(error.message ?? '').includes('NOXIA_REAL_VENUE_KIND')
    return NextResponse.json({ error: kind ? 'Das ist kein Lokal.' : 'Das Lokal konnte nicht geöffnet werden.' }, { status: kind ? 400 : 500 })
  }
  return NextResponse.json(data)
}
