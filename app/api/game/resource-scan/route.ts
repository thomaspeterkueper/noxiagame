// app/api/game/resource-scan/route.ts
// Erstellt: 16.09.2026
//
// Prospektion realer, geologisch abgeleiteter Ressourcen (region_resources).
// Getrennt vom alten Terrain-Scanner (lib/game/scanning.ts, scanner_discoveries),
// der auf der inzwischen entfernten abstrakten Kachelkarte basierte und
// faelschlich pro Spieler statt gemeinsam sichtbar war. Diese Route:
// - arbeitet in echten Lat/Lon-Koordinaten (kein Kachelraster)
// - macht Funde WELTWEIT SICHTBAR (region_resources.discovered_at), nicht
//   pro Spieler -- passend zur "keine personalisierten Loot-Systeme"-Leitlinie
// - kann ergebnislos bleiben (kein Fund != nichts da): ein Scan ohne Treffer
//   markiert nichts dauerhaft als leer, ein spaeterer Versuch kann Erfolg haben
//
// Fund-Wahrscheinlichkeit:
// - MRDS-bestaetigte Zellen (mrds_boosted): hohe Basiswahrscheinlichkeit (0.9)
// - rein modellierte Zellen: nach tier gestaffelt (trace .2 / viable .5 / rich .8 / exceptional .95)

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const TIER_DISCOVERY_CHANCE: Record<string, number> = {
  trace: 0.2,
  viable: 0.5,
  rich: 0.8,
  exceptional: 0.95,
}
const MRDS_BOOSTED_DISCOVERY_CHANCE = 0.9
const DEFAULT_SCAN_RADIUS_KM = 0.5

async function authenticatedUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.split(' ')[1]
  if (!token) return null
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user ?? null
}

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371
  const dLat = (bLat - aLat) * Math.PI / 180
  const dLon = (bLon - aLon) * Math.PI / 180
  const la1 = aLat * Math.PI / 180, la2 = bLat * Math.PI / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function discoveryDto(row: any) {
  const props = row.properties ?? {}
  return {
    id: row.id,
    resourceType: row.resource_type,
    lat: row.lat,
    lon: row.lon,
    abundance: row.discovered_at ? row.abundance : null, // exakter Wert erst nach Entdeckung sichtbar
    tier: props.tier ?? null,
    confirmed: Boolean(props.mrds_boosted), // "bestaetigter Fund" vs. "geologisch modelliert"
    discoveredAt: row.discovered_at,
  }
}

// GET: bereits entdeckte Vorkommen in einem Umkreis anzeigen (kein Scan-Versuch,
// nur Anzeige des bereits gemeinsam bekannten Standes)
export async function GET(req: NextRequest) {
  const user = await authenticatedUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const p = req.nextUrl.searchParams
  const lat = Number(p.get('lat'))
  const lon = Number(p.get('lon'))
  const radiusKm = Number(p.get('radiusKm') ?? DEFAULT_SCAN_RADIUS_KM)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: 'lat und lon erforderlich' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const latDelta = radiusKm / 111.32
  const lonDelta = radiusKm / (111.32 * Math.max(0.2, Math.cos(lat * Math.PI / 180)))
  const { data, error } = await supabase
    .from('region_resources')
    .select('id, resource_type, lat, lon, abundance, properties, discovered_at')
    .not('discovered_at', 'is', null)
    .gte('lat', lat - latDelta).lte('lat', lat + latDelta)
    .gte('lon', lon - lonDelta).lte('lon', lon + lonDelta)
  if (error) return NextResponse.json({ error: 'lookup_failed' }, { status: 503 })

  const nearby = (data ?? []).filter(r => haversineKm(lat, lon, r.lat, r.lon) <= radiusKm)
  return NextResponse.json({ lat, lon, radiusKm, discoveries: nearby.map(discoveryDto) })
}

// POST: einen Scan-Versuch ausloesen. Kandidaten im Radius, die noch nicht
// entdeckt sind, werden pro Zelle einzeln gewuerfelt (deterministisch waere
// hier falsch -- der Wahrscheinlichkeitswurf selbst soll ein echter Zufall
// pro Versuch sein, nicht die zugrunde liegende Geologie).
export async function POST(req: NextRequest) {
  const user = await authenticatedUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const lat = Number(body.lat)
  const lon = Number(body.lon)
  const radiusKm = Number(body.radiusKm ?? DEFAULT_SCAN_RADIUS_KM)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: 'lat und lon erforderlich' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const latDelta = radiusKm / 111.32
  const lonDelta = radiusKm / (111.32 * Math.max(0.2, Math.cos(lat * Math.PI / 180)))

  const { data: candidates, error } = await supabase
    .from('region_resources')
    .select('id, resource_type, lat, lon, abundance, properties, discovered_at')
    .gte('lat', lat - latDelta).lte('lat', lat + latDelta)
    .gte('lon', lon - lonDelta).lte('lon', lon + lonDelta)
  if (error) return NextResponse.json({ error: 'scan_unavailable' }, { status: 503 })

  const inRange = (candidates ?? []).filter(r => haversineKm(lat, lon, r.lat, r.lon) <= radiusKm)
  const alreadyKnown = inRange.filter(r => r.discovered_at)
  const undiscovered = inRange.filter(r => !r.discovered_at)

  const newlyDiscovered: typeof undiscovered = []
  for (const cell of undiscovered) {
    const props = cell.properties ?? {}
    const chance = props.mrds_boosted ? MRDS_BOOSTED_DISCOVERY_CHANCE : (TIER_DISCOVERY_CHANCE[props.tier] ?? 0.2)
    if (Math.random() < chance) newlyDiscovered.push(cell)
  }

  if (newlyDiscovered.length) {
    const { error: updateError } = await supabase
      .from('region_resources')
      .update({ discovered_at: new Date().toISOString(), discovered_via: 'scan' })
      .in('id', newlyDiscovered.map(c => c.id))
    if (updateError) return NextResponse.json({ error: 'discovery_persist_failed' }, { status: 503 })
  }

  return NextResponse.json({
    lat, lon, radiusKm,
    scannedCells: inRange.length,
    alreadyKnown: alreadyKnown.map(discoveryDto),
    newlyDiscovered: newlyDiscovered.map(r => discoveryDto({ ...r, discovered_at: new Date().toISOString() })),
    missedCells: undiscovered.length - newlyDiscovered.length, // "leer ausgegangen", kann spaeter erneut versucht werden
  })
}
