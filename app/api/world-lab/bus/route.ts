// app/api/world-lab/bus/route.ts
// Aktualisiert: 06.11.2026 — Buslinien um einen Punkt für die Weltkarte (Fahrplanbus, Thomas 06.11.2026)
// Version:      1.0.0
// Nur lesend; der erste Abruf je Gegend holt die Linien aus OpenStreetMap (lib/worldlab/busLines.server.ts).

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { busLinesAround } from '@/lib/worldlab/busLines.server'

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get('lat')), lon = Number(req.nextUrl.searchParams.get('lon'))
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return NextResponse.json({ error: 'lat/lon fehlt' }, { status: 400 })
  const { lines, error } = await busLinesAround(createServiceClient(), lat, lon)
  return NextResponse.json({ lines, ...(error ? { error } : {}) }, { headers: { 'Cache-Control': error ? 'no-store' : 'public, s-maxage=600, stale-while-revalidate=86400' } })
}
