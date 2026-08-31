import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { LOCATION_MAPS, terrainCodeToType } from '@/lib/grid/locationMaps'
import {
  discoveriesFromMeasurement,
  groundTruthFromTerrain,
  measureScanner,
} from '@/lib/game/scanning'

async function authenticatedUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.split(' ')[1]
  if (!token) return null
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user ?? null
}

function canonicalTerrain(locationSlug: string): string[][] | null {
  const rows = LOCATION_MAPS[locationSlug]
  if (!rows?.length) return null
  return rows.map(row => [...row].map(terrainCodeToType))
}

function discoveryDto(row: any) {
  return {
    id: row.id,
    groundTruthKey: row.ground_truth_key,
    row: row.tile_row,
    col: row.tile_col,
    kind: row.signal_kind,
    sourceType: row.source_type,
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

export async function GET(req: NextRequest) {
  const user = await authenticatedUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const locationSlug = new URL(req.url).searchParams.get('location')
  if (!locationSlug) return NextResponse.json({ error: 'location_required' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: location } = await supabase.from('locations').select('id,slug').eq('slug', locationSlug).maybeSingle()
  if (!location) return NextResponse.json({ error: 'location_not_found' }, { status: 404 })

  const { data, error } = await supabase
    .from('scanner_discoveries')
    .select('*')
    .eq('profile_id', user.id)
    .eq('location_id', location.id)
    .order('first_discovered_at', { ascending: true })

  if (error) return NextResponse.json({ error: 'scanner_persistence_unavailable' }, { status: 503 })
  return NextResponse.json({ location: locationSlug, discoveries: (data ?? []).map(discoveryDto) })
}

export async function POST(req: NextRequest) {
  const user = await authenticatedUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const locationSlug = typeof body.location === 'string' ? body.location : ''
  const scannerEntityId = typeof body.scannerEntityId === 'string' ? body.scannerEntityId : ''
  if (!locationSlug || !scannerEntityId) return NextResponse.json({ error: 'location_and_scanner_required' }, { status: 400 })

  const terrain = canonicalTerrain(locationSlug)
  if (!terrain) return NextResponse.json({ error: 'canonical_world_map_unavailable' }, { status: 409 })

  const supabase = createServiceClient()
  const { data: location } = await supabase.from('locations').select('id,slug').eq('slug', locationSlug).maybeSingle()
  if (!location) return NextResponse.json({ error: 'location_not_found' }, { status: 404 })

  const { data: scanner } = await supabase
    .from('tile_entities')
    .select('id,profile_id,entity_id,entity_type,location_id,tile_row,tile_col')
    .eq('id', scannerEntityId)
    .eq('location_id', location.id)
    .eq('profile_id', user.id)
    .eq('entity_type', 'building')
    .eq('entity_id', 'scanner')
    .maybeSingle()

  if (!scanner) return NextResponse.json({ error: 'owned_scanner_not_found' }, { status: 403 })

  const rows = terrain.length
  const cols = Math.max(0, ...terrain.map(row => row.length))
  const groundTruth = groundTruthFromTerrain(terrain)
  const measurement = measureScanner({
    origin: { row: scanner.tile_row, col: scanner.tile_col },
    rows,
    cols,
    groundTruth,
  })
  const discovered = discoveriesFromMeasurement(measurement)

  const { data: knownRows, error: knownError } = await supabase
    .from('scanner_discoveries')
    .select('ground_truth_key')
    .eq('profile_id', user.id)
    .eq('location_id', location.id)
  if (knownError) return NextResponse.json({ error: 'scanner_persistence_unavailable' }, { status: 503 })
  const known = new Set((knownRows ?? []).map((row: any) => row.ground_truth_key))
  const measuredAt = new Date().toISOString()

  if (discovered.length) {
    const rowsToPersist = discovered.map(item => ({
      profile_id: user.id,
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
      .upsert(rowsToPersist, { onConflict: 'profile_id,location_id,ground_truth_key', ignoreDuplicates: false })
    if (persistError) return NextResponse.json({ error: 'scanner_persistence_failed' }, { status: 503 })
  }

  const { data: persistedRows } = await supabase
    .from('scanner_discoveries')
    .select('*')
    .eq('profile_id', user.id)
    .eq('location_id', location.id)
    .order('first_discovered_at', { ascending: true })

  return NextResponse.json({
    location: locationSlug,
    scanner: { id: scanner.id, row: scanner.tile_row, col: scanner.tile_col },
    measurement: {
      origin: measurement.origin,
      radius: measurement.radius,
      coveredCells: measurement.coveredCells,
      signals: measurement.signals.map(signal => ({ row: signal.row, col: signal.col, strength: signal.strength })),
    },
    interpretations: discovered.map(item => item.interpretation),
    newDiscoveries: discovered.filter(item => !known.has(item.groundTruthKey)),
    knownDiscoveries: discovered.filter(item => known.has(item.groundTruthKey)),
    discoveries: (persistedRows ?? []).map(discoveryDto),
  })
}
