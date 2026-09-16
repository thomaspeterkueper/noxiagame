// app/api/game/scanner/route.ts
// Aktualisiert: 16.09.2026 — geteilte Welt + Rohstoff-Scanner mit
// Hardwarekanaelen und wissensabhaengiger Interpretation.
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { LOCATION_MAPS, terrainCodeToType } from '@/lib/grid/locationMaps'
import { discoveriesFromMeasurement, groundTruthFromTerrain, measureScanner } from '@/lib/game/scanning'
import {
  rollResourceScan,
  haversineKm,
  scannerCapability,
  INSTRUMENTS,
  type ResourceCandidate,
  type ResourceTier,
  type ScannerCapability,
} from '@/lib/game/resourceScanning'

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

function roundedCoord(value: unknown, decimals: number) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  const f = 10 ** decimals
  return Math.round(n * f) / f
}

// Der Fund selbst ist kanonisch/geteilt; wie viel davon ein Spieler versteht,
// ist hingegen eine Funktion seines Wissens. Die DB speichert deshalb die volle
// Wahrheit, waehrend die API pro Betrachter eine passende Sicht erzeugt.
function resourceDiscoveryDto(row: any, capability: ScannerCapability) {
  const base = discoveryDto(row)
  const level = capability.interpretationLevel
  if (level >= 3) return base

  const lat = roundedCoord(row.lat, level >= 1 ? 4 : 3)
  const lon = roundedCoord(row.lon, level >= 1 ? 4 : 3)

  if (level === 0) {
    return {
      ...base,
      lat,
      lon,
      resourceType: null,
      abundanceTier: null,
      evidenceKind: null,
      interpretation: {
        groundTruthKey: row.ground_truth_key,
        label: 'Unklare Ressourcensignatur',
        confidence: 'low',
        evidence: 'Anomalie erkannt. Mehr geologisches Fachwissen ist fuer eine Stoffbestimmung erforderlich.',
      },
    }
  }

  if (level === 1) {
    return {
      ...base,
      lat,
      lon,
      abundanceTier: null,
      evidenceKind: null,
      interpretation: {
        groundTruthKey: row.ground_truth_key,
        label: `${row.resource_type ?? 'Rohstoff'} — wahrscheinliche Signatur`,
        confidence: 'low',
        evidence: 'Rohstofftyp wahrscheinlich erkannt; Menge und geologische Evidenz sind noch nicht sicher interpretierbar.',
      },
    }
  }

  return {
    ...base,
    lat,
    lon,
    evidenceKind: null,
    interpretation: {
      groundTruthKey: row.ground_truth_key,
      label: `${row.resource_type ?? 'Rohstoff'} — ${row.abundance_tier ?? 'unbestimmte'} Konzentration`,
      confidence: 'medium',
      evidence: 'Rohstofftyp und Konzentrationsklasse interpretiert. Herkunft/Evidenz erfordert wissenschaftliche Analyse.',
    },
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
    .select('id, latitude_deg, longitude_deg, status, tile_level')
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

async function capabilityFor(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  scanner: { tile_level?: number | null },
  requestedInstrument?: string | null,
) {
  const { data: profile } = await supabase.from('profiles').select('knowledge_points').eq('id', userId).maybeSingle()
  let instrumentId: string | null = null
  if (requestedInstrument) {
    // Nicht besessene Instrumente werden stillschweigend ignoriert (Basis-
    // Hardware greift dann weiter) statt den Scan mit einem Fehler abzubrechen.
    const { data: owned } = await supabase
      .from('player_instruments').select('instrument_id')
      .eq('profile_id', userId).eq('instrument_id', requestedInstrument).maybeSingle()
    if (owned) instrumentId = requestedInstrument
  }
  return scannerCapability(Number(scanner.tile_level ?? 0), Number(profile?.knowledge_points ?? 0), instrumentId)
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
  scanner: { id: string; latitude_deg: number; longitude_deg: number; tile_level?: number | null },
  capability: ScannerCapability,
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
    .filter(c => Number.isFinite(c.lat) && Number.isFinite(c.lon) && haversineKm(origin, c) <= capability.radiusKm)

  const { data: knownRows, error: knownError } = await supabase
    .from('scanner_discoveries')
    .select('region_resource_id')
    .eq('location_id', locationId)
    .not('region_resource_id', 'is', null)
  if (knownError) return { error: 'scanner_persistence_unavailable' as const }

  const known = new Set((knownRows ?? []).map((r: any) => r.region_resource_id as string))
  const knownInRadius = new Set(candidates.filter(c => known.has(c.id)).map(c => c.id))
  const results = rollResourceScan(candidates, known, capability)
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
  const newRaw = resourceRows.filter((row: any) => newlyFoundIds.has(row.region_resource_id))
  const knownRaw = resourceRows.filter((row: any) => knownInRadius.has(row.region_resource_id))
  const newDiscoveries = newRaw.map((row: any) => resourceDiscoveryDto(row, capability))
  const knownDiscoveries = knownRaw.map((row: any) => resourceDiscoveryDto(row, capability))

  // Radarpositionen bleiben messbare Geometrie. Fachinformation wird separat
  // ueber die Discovery-DTOs abgestuft und dadurch nicht vorzeitig geleakt.
  const signals = [
    ...knownRaw.map((row: any) => ({
      lat: Number(row.lat), lon: Number(row.lon), strength: tierStrength(row.abundance_tier), known: true,
    })),
    ...newRaw.map((row: any) => ({
      lat: Number(row.lat), lon: Number(row.lon), strength: tierStrength(row.abundance_tier), known: false,
    })),
  ]

  return {
    ok: true as const,
    regionSlug: region.slug,
    scanner: { id: scanner.id, lat: origin.lat, lon: origin.lon, hardwareLevel: capability.hardwareLevel },
    capability,
    measurement: {
      origin,
      radiusKm: capability.radiusKm,
      scannedCandidates: candidates.length,
      measurableCandidates: results.filter(r => r.measurable).length,
      blockedByTechnique: results.filter(r => !r.measurable).length,
      signals,
    },
    interpretations: newDiscoveries.map((d: any) => d.interpretation),
    newDiscoveries,
    knownDiscoveries,
    misses: results.filter(r => r.measurable && !r.found).length,
    discoveries: resourceRows.map((row: any) => resourceDiscoveryDto(row, capability)),
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
  if (terrain) {
    return NextResponse.json({
      location: locationSlug,
      mode: 'terrain',
      scanner: tileScanner ? { id: tileScanner.id, row: tileScanner.tile_row, col: tileScanner.tile_col } : null,
      discoveries: (data ?? []).map(discoveryDto),
    })
  }

  if (!worldScanner) return NextResponse.json({ location: locationSlug, mode: 'resource', scanner: null, discoveries: [] })
  const requestedInstrument = new URL(req.url).searchParams.get('instrument')
  const capability = await capabilityFor(supabase, user.id, worldScanner, requestedInstrument)
  const { data: ownedInstrumentRows } = await supabase.from('player_instruments').select('instrument_id').eq('profile_id', user.id)
  return NextResponse.json({
    location: locationSlug,
    mode: 'resource',
    scanner: { id: worldScanner.id, lat: Number(worldScanner.latitude_deg), lon: Number(worldScanner.longitude_deg), hardwareLevel: capability.hardwareLevel },
    capability,
    availableInstruments: INSTRUMENTS,
    ownedInstruments: (ownedInstrumentRows ?? []).map((r: any) => r.instrument_id),
    discoveries: (data ?? []).filter((row: any) => row.region_resource_id).map((row: any) => resourceDiscoveryDto(row, capability)),
  })
}

export async function POST(req: NextRequest) {
  const user = await authenticatedUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const locationSlug = typeof body.location === 'string' ? body.location : ''
  const requestedScanner = typeof body.scannerEntityId === 'string' ? body.scannerEntityId : ''
  const requestedInstrument = typeof body.instrument === 'string' ? body.instrument : null
  if (!locationSlug) return NextResponse.json({ error: 'location_required' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: location } = await supabase.from('locations').select('id,slug').eq('slug', locationSlug).maybeSingle()
  if (!location) return NextResponse.json({ error: 'location_not_found' }, { status: 404 })

  const terrain = canonicalTerrain(locationSlug)
  if (!terrain) {
    const worldScanner = await findWorldScanner(supabase, user.id, location.id)
    if (!worldScanner) return NextResponse.json({ error: 'owned_scanner_not_found' }, { status: 403 })
    const capability = await capabilityFor(supabase, user.id, worldScanner, requestedInstrument)
    const result = await resourceScan(supabase, user.id, location.id, worldScanner as any, capability)
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
