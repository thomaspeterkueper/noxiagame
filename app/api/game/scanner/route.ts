// app/api/game/scanner/route.ts
// Aktualisiert: 16.09.2026 — geteilte Welt + paralleler Rohstoff-Signalpfad.
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { LOCATION_MAPS, terrainCodeToType } from '@/lib/grid/locationMaps'
import { discoveriesFromMeasurement, groundTruthFromTerrain, measureScanner } from '@/lib/game/scanning'
import { rollResourceScan, haversineKm, type ResourceCandidate, type ResourceTier } from '@/lib/game/resourceScanning'

const RESOURCE_SCAN_RADIUS_KM = 0.3

async function authenticatedUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.split(' ')[1]
  if (!token) return null
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user ?? null
}

function canonicalTerrain(locationSlug: string) {
  const rows = LOCATION_MAPS[locationSlug]
  if (!rows?.length) return null
  return rows.map(row => [...row].map(terrainCodeToType))
}

function discoveryDto(row: any) {
  return {
    id: row.id,
    groundTruthKey: row.ground_truth_key,
    kind: row.signal_kind,
    sourceType: row.source_type,
    row: row.tile_row,
    col: row.tile_col,
    lat: row.lat,
    lon: row.lon,
    resourceType: row.resource_type,
    abundanceTier: row.abundance_tier,
    evidenceKind: row.evidence_kind,
    interpretation: {
      groundTruthKey: row.ground_truth_key,
      label: row.interpretation_label,
      confidence: row.confidence,
      evidence: row.evidence,
    },
    firstDiscoveredAt: row.first_discovered_at,
    lastMeasuredAt: row.last_measured_at,
  }
}

function tierStrength(tier: ResourceTier | null | undefined) {
  if (tier === 'exceptional') return 1
  if (tier === 'rich') return 0.8
  if (tier === 'viable') return 0.55
  return 0.3
}

async function findWorldScanner(supabase: ReturnType<typeof createServiceClient>, userId: string, locationId: string) {
  const { data } = await supabase
    .from('player_builds')
    .select('id, latitude_deg, longitude_deg, status')
    .eq('profile_id', userId)
    .eq('location_id', locationId)
    .eq('buildable_id', 'scanner')
    .eq('placement_mode', 'world')
    .not('latitude_deg', 'is', null)
    .not('longitude_deg', 'is', null)
    .limit(1)
    .maybeSingle()
  return data
}

async function findRegionFor(supabase: ReturnType<typeof createServiceClient>, lat: number, lon: number) {
  const { data: regions } = await supabase.from('celestial_regions').select('id, slug, bounds')
  for (const r of regions ?? []) {
    const b = r.bounds as { south: number; west: number; north: number; east: number }
    if (b && lat >= b.south && lat <= b.north && lon >= b.west && lon <= b.east) return r
  }
  return null
}

async function resourceScan(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  locationId: string,
  scanner: { id: string; latitude_deg: number; longitude_deg: number },
) {
  const origin = { lat: Number(scanner.latitude_deg), lon: Number(scanner.longitude_deg) }
  const region = await findRegionFor(supabase, origin.lat, origin.lon)
  if (!region) return { error: 'no_region_at_scanner_position' as const }

  const { data: resources, error: resourcesError } = await supabase
    .from('region_resources')
    .select('id, resource_type, lat, lon, abundance, properties')
    .eq('region_id', region.id)
  if (resourcesError) return { error: 'resource_ground_truth_unavailable' as const }

  const candidates: ResourceCandidate[] = (resources ?? [])
    .map((r: any) => ({
      id: r.id as string,
      resourceType: r.resource_type as string,
      lat: Number(r.lat),
      lon: Number(r.lon),
      abundance: Number(r.abundance),
      tier: (r.properties?.tier ?? 'trace') as ResourceTier,
      mrdsBoosted: Boolean(r.properties?.mrds_boosted),
    }))
    .filter(c => Number.isFinite(c.lat) && Number.isFinite(c.lon) && haversineKm(origin, c) <= RESOURCE_SCAN_RADIUS_KM)

  const { data: knownRows, error: knownError } = await supabase
    .from('scanner_discoveries')
    .select('region_resource_id')
    .eq('location_id', locationId)
    .not('region_resource_id', 'is', null)
  if (knownError) return { error: 'scanner_persistence_unavailable' as const }

  const known = new Set((knownRows ?? []).map((r: any) => r.region_resource_id as string))
  const knownInRadius = new Set(candidates.filter(c => known.has(c.id)).map(c => c.id))
  const results = rollResourceScan(candidates, known)
  const newlyFound = results.filter(r => r.found)
  const newlyFoundIds = new Set(newlyFound.map(r => r.candidate.id))
  const measuredAt = new Date().toISOString()

  if (newlyFound.length) {
    const rowsToInsert = newlyFound.map(({ candidate }) => ({
      discovered_by_profile_id: userId,
      location_id: locationId,
      ground_truth_key: `resource:${candidate.id}`,
      region_resource_id: candidate.id,
      lat: candidate.lat,
      lon: candidate.lon,
      resource_type: candidate.resourceType,
      abundance_tier: candidate.tier,
      evidence_kind: candidate.mrdsBoosted ? 'mrds_confirmed' : 'geological_model',
      signal_kind: 'resource_deposit',
      source_type: candidate.resourceType,
      interpretation_label: candidate.mrdsBoosted
        ? 'Bestätigtes Vorkommen (reale Referenzdaten)'
        : 'Geologisch modelliertes Vorkommen',
      confidence: candidate.mrdsBoosted ? 'medium' : 'low',
      evidence: candidate.mrdsBoosted
        ? 'Nahe einem dokumentierten realen Fund — hohe Verlässlichkeit'
        : 'Aus regionaler Lithologie abgeleitet — nicht vermessen, kann abweichen',
      last_measured_at: measuredAt,
    }))
    const { error } = await supabase
      .from('scanner_discoveries')
      .upsert(rowsToInsert, { onConflict: 'location_id,ground_truth_key', ignoreDuplicates: false })
    if (error) return { error: 'scanner_persistence_failed' as const }
  }

  const { data: persistedRows, error: persistedError } = await supabase
    .from('scanner_discoveries')
    .select('*')
    .eq('location_id', locationId)
    .not('region_resource_id', 'is', null)
    .order('first_discovered_at', { ascending: true })
  if (persistedError) return { error: 'scanner_persistence_unavailable' as const }

  const resourceRows = persistedRows ?? []
  const newDiscoveries = resourceRows.filter((row: any) => newlyFoundIds.has(row.region_resource_id)).map(discoveryDto)
  const knownDiscoveries = resourceRows.filter((row: any) => knownInRadius.has(row.region_resource_id)).map(discoveryDto)

  const signals = [
    ...knownDiscoveries.map((d: any) => ({
      lat: Number(d.lat), lon: Number(d.lon), strength: tierStrength(d.abundanceTier), known: true,
      resourceType: d.resourceType, evidenceKind: d.evidenceKind,
    })),
    ...newDiscoveries.map((d: any) => ({
      lat: Number(d.lat), lon: Number(d.lon), strength: tierStrength(d.abundanceTier), known: false,
      resourceType: d.resourceType, evidenceKind: d.evidenceKind,
    })),
  ]

  return {
    ok: true as const,
    regionSlug: region.slug,
    scanner: { id: scanner.id, lat: origin.lat, lon: origin.lon },
    measurement: {
      origin,
      radiusKm: RESOURCE_SCAN_RADIUS_KM,
      scannedCandidates: candidates.length,
      signals,
    },
    interpretations: newDiscoveries.map((d: any) => d.interpretation),
    newDiscoveries,
    knownDiscoveries,
    misses: results.length - newlyFound.length,
    discoveries: resourceRows.map(discoveryDto),
  }
}

export async function GET(req: NextRequest) {
  const user = await authenticatedUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const locationSlug = new URL(req.url).searchParams.get('location')
  if (!locationSlug) return NextResponse.json({ error: 'location_required' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: location } = await supabase.from('locations').select('id,slug').eq('slug', locationSlug).maybeSingle()
  if (!location) return NextResponse.json({ error: 'location_not_found' }, { status: 404 })

  const terrain = canonicalTerrain(locationSlug)
  const [{ data: tileScanner }, { data, error }] = await Promise.all([
    supabase.from('tile_entities').select('id,tile_row,tile_col')
      .eq('location_id', location.id).eq('profile_id', user.id)
      .eq('entity_type', 'building').eq('entity_id', 'scanner').limit(1).maybeSingle(),
    supabase.from('scanner_discoveries').select('*').eq('location_id', location.id).order('first_discovered_at', { ascending: true }),
  ])
  if (error) return NextResponse.json({ error: 'scanner_persistence_unavailable' }, { status: 503 })

  const worldScanner = await findWorldScanner(supabase, user.id, location.id)
  const scanner = terrain
    ? (tileScanner ? { id: tileScanner.id, row: tileScanner.tile_row, col: tileScanner.tile_col } : null)
    : (worldScanner ? { id: worldScanner.id, lat: Number(worldScanner.latitude_deg), lon: Number(worldScanner.longitude_deg) } : null)

  return NextResponse.json({
    location: locationSlug,
    mode: terrain ? 'terrain' : 'resource',
    scanner,
    discoveries: (data ?? []).map(discoveryDto),
  })
}

export async function POST(req: NextRequest) {
  const user = await authenticatedUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const locationSlug = typeof body.location === 'string' ? body.location : ''
  const requestedScanner = typeof body.scannerEntityId === 'string' ? body.scannerEntityId : ''
  if (!locationSlug) return NextResponse.json({ error: 'location_required' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: location } = await supabase.from('locations').select('id,slug').eq('slug', locationSlug).maybeSingle()
  if (!location) return NextResponse.json({ error: 'location_not_found' }, { status: 404 })

  const terrain = canonicalTerrain(locationSlug)
  if (!terrain) {
    const worldScanner = await findWorldScanner(supabase, user.id, location.id)
    if (!worldScanner) return NextResponse.json({ error: 'owned_scanner_not_found' }, { status: 403 })
    const result = await resourceScan(supabase, user.id, location.id, worldScanner as any)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 503 })
    return NextResponse.json({ location: locationSlug, mode: 'resource', ...result })
  }

  let scannerQuery = supabase.from('tile_entities').select('id,profile_id,entity_id,entity_type,location_id,tile_row,tile_col')
    .eq('location_id', location.id).eq('profile_id', user.id).eq('entity_type', 'building').eq('entity_id', 'scanner')
  if (requestedScanner) scannerQuery = scannerQuery.eq('id', requestedScanner)
  const { data: scanner } = await scannerQuery.limit(1).maybeSingle()
  if (!scanner) return NextResponse.json({ error: 'owned_scanner_not_found' }, { status: 403 })

  const rows = terrain.length
  const cols = Math.max(0, ...terrain.map(row => row.length))
  const measurement = measureScanner({
    origin: { row: scanner.tile_row, col: scanner.tile_col },
    rows,
    cols,
    groundTruth: groundTruthFromTerrain(terrain),
  })
  const discovered = discoveriesFromMeasurement(measurement)

  const { data: knownRows, error: knownError } = await supabase
    .from('scanner_discoveries').select('ground_truth_key').eq('location_id', location.id)
  if (knownError) return NextResponse.json({ error: 'scanner_persistence_unavailable' }, { status: 503 })
  const known = new Set((knownRows ?? []).map((row: any) => row.ground_truth_key))
  const measuredAt = new Date().toISOString()

  if (discovered.length) {
    const rowsToPersist = discovered.map(item => ({
      discovered_by_profile_id: user.id,
      location_id: location.id,
      ground_truth_key: item.groundTruthKey,
      tile_row: item.row,
      tile_col: item.col,
      signal_kind: item.kind,
      source_type: item.sourceType,
      interpretation_label: item.interpretation.label,
      confidence: item.interpretation.confidence,
      evidence: item.interpretation.evidence,
      last_measured_at: measuredAt,
    }))
    const { error: persistError } = await supabase
      .from('scanner_discoveries')
      .upsert(rowsToPersist, { onConflict: 'location_id,ground_truth_key', ignoreDuplicates: false })
    if (persistError) return NextResponse.json({ error: 'scanner_persistence_failed' }, { status: 503 })
  }

  const { data: persistedRows } = await supabase
    .from('scanner_discoveries').select('*').eq('location_id', location.id).order('first_discovered_at', { ascending: true })

  return NextResponse.json({
    location: locationSlug,
    mode: 'terrain',
    scanner: { id: scanner.id, row: scanner.tile_row, col: scanner.tile_col },
    measurement: {
      origin: measurement.origin,
      radius: measurement.radius,
      coveredCells: measurement.coveredCells,
      signals: measurement.signals.map(s => ({ row: s.row, col: s.col, strength: s.strength })),
    },
    interpretations: discovered.map(item => item.interpretation),
    newDiscoveries: discovered.filter(item => !known.has(item.groundTruthKey)),
    knownDiscoveries: discovered.filter(item => known.has(item.groundTruthKey)),
    discoveries: (persistedRows ?? []).map(discoveryDto),
  })
}
