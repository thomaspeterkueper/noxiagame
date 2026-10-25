// app/api/world-lab/address/route.ts
// Erdkarte (Request W-1): Ziel nach Adresse. GET ?q=Hauptstraße 102 (oder
// „Bogenstraße“ oder „51.3407, 8.0015“) → Lage aus den gespeicherten
// Kartendaten. Keine Anfrage an fremde Dienste. Nur lesend.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { parseAddressQuery, streetKey, streetPrefix } from '@/lib/worldlab/address'

type Point = { lat: number; lon: number }
const centroid = (points: Point[]): Point => ({ lat: points.reduce((s, p) => s + p.lat, 0) / points.length, lon: points.reduce((s, p) => s + p.lon, 0) / points.length })

export async function GET(req: NextRequest) {
  if (!await verifiedBearerUserId(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const params = new URL(req.url).searchParams
  const query = parseAddressQuery(params.get('q') ?? '')
  // Gleichnamige Straßen gibt es in vielen Orten: die nächste zur Spielfigur gewinnt.
  const [nearLat, nearLon] = String(params.get('near') ?? '').split(',').map(Number)
  const near = Number.isFinite(nearLat) && Number.isFinite(nearLon) ? { lat: nearLat, lon: nearLon } : null
  const distance = (p: Point) => near ? Math.hypot(p.lat - near.lat, (p.lon - near.lon) * Math.cos(near.lat * Math.PI / 180)) : 0
  if (!query) return NextResponse.json({ error: 'Bitte eine Adresse wie „Hauptstraße 102“ oder Koordinaten eingeben.' }, { status: 400 })
  if (query.kind === 'coordinates') return NextResponse.json({ lat: query.lat, lon: query.lon, label: `${query.lat.toFixed(5)}, ${query.lon.toFixed(5)}` })

  const supabase = createServiceClient()
  if (query.number) {
    // Hausnummer über jsonb-Enthaltensein (der Doppelpunkt im Schlüssel verträgt sich nicht mit ->>), Straße hier vergleichen.
    const { data } = await supabase.from('region_features').select('geometry,properties')
      .eq('feature_type', 'building').contains('properties', { 'addr:housenumber': query.number }).limit(1000)
    const wanted = streetKey(query.street)
    const hits = (data ?? []).filter(row => streetKey(String(row.properties?.['addr:street'] ?? '')) === wanted
      && Array.isArray(row.geometry?.coordinates) && row.geometry.coordinates.length)
      .map(row => ({ row, at: centroid(row.geometry.coordinates as Point[]) }))
      .sort((a, b) => distance(a.at) - distance(b.at))
    const hit = hits[0]?.row
    if (hit) {
      const at = hits[0].at
      return NextResponse.json({ ...at, label: `${hit.properties?.['addr:street'] ?? query.street} ${query.number}`, building: true })
    }
  }
  // Ohne Hausnummer (oder nicht gefunden): Mitte der Straße.
  // „Hauptstrasse“ soll „Hauptstraße“ finden: grob nach dem Anfang vorauswählen, genau mit streetKey vergleichen.
  const { data: candidates } = await supabase.from('region_features').select('geometry,properties')
    .eq('feature_type', 'road').ilike('properties->>name', streetPrefix(query.street) + '%').limit(400)
  const roads = (candidates ?? []).filter(row => streetKey(String(row.properties?.name ?? '')) === streetKey(query.street))
  const points = (roads ?? []).flatMap(row => Array.isArray(row.geometry?.coordinates) ? row.geometry.coordinates as Point[] : [])
    .sort((a, b) => distance(a) - distance(b))
  if (!points.length) return NextResponse.json({ error: `„${query.street}${query.number ? ' ' + query.number : ''}“ ist in den geladenen Kartendaten nicht bekannt.` }, { status: 404 })
  const middle = near ? points[0] : points[Math.floor(points.length / 2)]
  return NextResponse.json({ lat: middle.lat, lon: middle.lon, label: String(roads?.[0]?.properties?.name ?? query.street), building: false, numberMissing: Boolean(query.number) })
}
