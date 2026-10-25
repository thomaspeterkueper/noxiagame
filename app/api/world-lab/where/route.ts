// app/api/world-lab/where/route.ts
// Ortsname für die Weltkarte („Du bist hier“, Gespräche): die nächste benannte
// Erdregion. Ortsdetail-Zellen („Lokaldetail …“) und Sammelregionen zählen nicht.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { placeNameFromLabel } from '@/lib/worldlab/placeName'

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get('lat')), lon = Number(req.nextUrl.searchParams.get('lon'))
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 85 || Math.abs(lon) > 180) return NextResponse.json({ error: 'lat/lon fehlt' }, { status: 400 })
  const supabase = createServiceClient()
  // Grobe Vorauswahl (±0,5°), dann der nächste nach Entfernung
  const { data } = await supabase.from('celestial_regions').select('label,center_lat,center_lon')
    .eq('body', 'earth').gte('center_lat', lat - 0.5).lte('center_lat', lat + 0.5).gte('center_lon', lon - 0.8).lte('center_lon', lon + 0.8).limit(200)
  let best: { name: string; km: number } | null = null
  for (const row of data ?? []) {
    const name = placeNameFromLabel(String(row.label ?? ''))
    if (!name) continue
    const km = Math.hypot((Number(row.center_lat) - lat) * 111.3, (Number(row.center_lon) - lon) * 111.3 * Math.cos(lat * Math.PI / 180))
    if (km <= 25 && (!best || km < best.km)) best = { name, km }
  }
  return NextResponse.json({ name: best?.name ?? null }, { headers: { 'Cache-Control': 'public, s-maxage=3600' } })
}
