// app/api/world-lab/place-info/route.ts
// Angaben zu einem realen Ort aus den gespeicherten Ortsdaten (region_features),
// nach OSM-Kennung: Name, Religion, Konfession (NOXIA-NPC-RELIGION-0001, 28.10.2026).
// Die Kartenkacheln tragen je Gebäude nur die Nutzung („Gotteshaus“); welcher Raum
// sich öffnet (Kirche, Moschee, Synagoge, Tempel), hängt an der Religion.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'

export async function GET(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const source = String(req.nextUrl.searchParams.get('source') ?? '')
  if (!/^osm:(node|way|relation):[0-9]{1,15}$/.test(source)) return NextResponse.json({ error: 'source invalid' }, { status: 400 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('region_features')
    .select('properties')
    .eq('properties->>noxia_source_id', source)
    .order('created_at', { ascending: true })
    .limit(1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const properties = (data?.[0]?.properties ?? {}) as Record<string, unknown>
  const text = (key: string) => typeof properties[key] === 'string' ? String(properties[key]).slice(0, 120) : null
  return NextResponse.json({
    source,
    found: Boolean(data?.length),
    name: text('name'),
    religion: text('religion'),
    denomination: text('denomination'),
    building: text('building'),
  }, { headers: { 'Cache-Control': 'private, max-age=3600' } })
}
