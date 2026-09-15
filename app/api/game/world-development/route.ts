import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { buildTharsisEnergyGridObservation } from '@/lib/game/energyGridObservation'
import {
  buildOrbitalStationCapabilitySnapshot,
  deriveOrbitalLogisticsSignal,
  deriveWaterSecuritySignal,
  type DerivedWorldDevelopmentSignal,
} from '@/lib/game/worldDevelopmentSignals'

interface LocationResourceRow {
  location_id: string
  resource: string
  stock: number | null
  production: number | null
  consumption: number | null
}

interface LocationRow {
  id: string
  slug: string
  name: string | null
  simulate_tick: boolean | null
}

interface EnergyAssetRow {
  entity_id: string
  tile_row: number | null
  tile_col: number | null
}

interface PowerBackboneRow {
  ring: string
  node_row: number | null
  node_col: number | null
}

interface PowerEdgeRow {
  ring: string
  from_row: number | null
  from_col: number | null
  to_row: number | null
  to_col: number | null
}

interface PowerFeederRow {
  ring: string
  object_row: number | null
  object_col: number | null
  node_row: number | null
  node_col: number | null
}

function resourceNumber(value: number | null | undefined): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

function serializeDerivedSignal(derived: DerivedWorldDevelopmentSignal) {
  return {
    ...derived.signal,
    explanation: derived.explanation,
    evidence: derived.evidence,
  }
}

/**
 * Read-only projection endpoint for live World Development inputs and
 * infrastructure observations.
 *
 * Deliberately absent:
 * - no runDueTicks()/simulation heartbeat;
 * - no persistence;
 * - no unlocks or gameplay mutations;
 * - no conversion of generic energy stock into grid/firm-energy values;
 * - no conversion of nominal reactor MW into available or firm capacity;
 * - persisted power topology proves structural reachability only, not live
 *   breaker/line continuity or transmission capacity.
 */
export async function GET() {
  const supabase = createServiceClient()

  const { data: locationData, error: locationError } = await supabase
    .from('locations')
    .select('id, slug, name, simulate_tick')
    .order('slug')

  if (locationError) {
    console.error('world-development locations query failed:', locationError)
    return NextResponse.json(
      { error: 'world-development-source-unavailable', source: 'locations' },
      { status: 503 },
    )
  }

  const locations = (locationData ?? []) as LocationRow[]
  const simulatedLocationIds = locations
    .filter(location => location.simulate_tick === true)
    .map(location => location.id)

  let waterRows: LocationResourceRow[] = []
  if (simulatedLocationIds.length > 0) {
    const { data: resourceData, error: resourceError } = await supabase
      .from('location_resources')
      .select('location_id, resource, stock, production, consumption')
      .eq('resource', 'water')
      .in('location_id', simulatedLocationIds)

    if (resourceError) {
      console.error('world-development resource query failed:', resourceError)
      return NextResponse.json(
        { error: 'world-development-source-unavailable', source: 'location_resources' },
        { status: 503 },
      )
    }

    waterRows = (resourceData ?? []) as LocationResourceRow[]
  }

  const waterByLocation = new Map<string, LocationResourceRow>()
  for (const row of waterRows) {
    if (!waterByLocation.has(row.location_id)) waterByLocation.set(row.location_id, row)
  }

  const locationSignals = locations
    .filter(location => location.simulate_tick === true)
    .map(location => {
      const water = waterByLocation.get(location.id)
      const signals: ReturnType<typeof serializeDerivedSignal>[] = []

      if (water) {
        const derived = deriveWaterSecuritySignal(
          {
            stock: resourceNumber(water.stock),
            production: resourceNumber(water.production),
            consumption: resourceNumber(water.consumption),
          },
          `core:location_resources:${location.id}:water`,
        )
        if (derived) signals.push(serializeDerivedSignal(derived))
      }

      return {
        locationId: location.id,
        slug: location.slug,
        name: location.name,
        signals,
      }
    })
    .filter(location => location.signals.length > 0)

  const orbitalStations = locations
    .map(location => buildOrbitalStationCapabilitySnapshot({ slug: location.slug }))
    .filter((station): station is NonNullable<typeof station> => station !== null)

  const systemSignals: ReturnType<typeof serializeDerivedSignal>[] = []
  const orbital = deriveOrbitalLogisticsSignal(
    orbitalStations,
    'core:locations+station-service-profiles+station-docking-topologies',
  )
  if (orbital) systemSignals.push(serializeDerivedSignal(orbital))

  const energyGridObservations: ReturnType<typeof buildTharsisEnergyGridObservation>[] = []
  const infrastructureIssues: Array<{ scope: string; system: string; reason: string }> = []
  const mars = locations.find(location => location.slug === 'mars')

  if (mars) {
    const { data: energyAssetData, error: energyAssetError } = await supabase
      .from('tile_entities')
      .select('entity_id, tile_row, tile_col')
      .eq('location_id', mars.id)
      .eq('entity_type', 'building')
      .in('entity_id', ['reactor_module', 'black_start'])

    if (energyAssetError) {
      console.error('world-development energy infrastructure query failed:', energyAssetError)
      infrastructureIssues.push({
        scope: 'mars',
        system: 'energy-grid',
        reason: 'Persisted Tharsis energy assets could not be read; no infrastructure observation was emitted.',
      })
    } else {
      const liveAssets = ((energyAssetData ?? []) as EnergyAssetRow[]).map(row => ({
        entityId: row.entity_id,
        tileRow: row.tile_row,
        tileCol: row.tile_col,
      }))

      const [backboneResult, edgeResult, feederResult] = await Promise.all([
        supabase
          .from('location_utilities')
          .select('ring, node_row, node_col')
          .eq('location_id', mars.id)
          .is('attaches_entity_id', null)
          .contains('media', ['power']),
        supabase
          .from('location_utility_edges')
          .select('ring, from_row, from_col, to_row, to_col')
          .eq('location_id', mars.id)
          .contains('media', ['power']),
        supabase
          .from('location_utility_feeders')
          .select('ring, object_row, object_col, node_row, node_col')
          .eq('location_id', mars.id)
          .contains('media', ['power']),
      ])

      const topologyErrors = [backboneResult.error, edgeResult.error, feederResult.error].filter(Boolean)
      if (topologyErrors.length > 0) {
        console.error('world-development power topology query failed:', topologyErrors)
        infrastructureIssues.push({
          scope: 'mars',
          system: 'power-topology',
          reason: 'Persisted Tharsis power topology could not be read; energy assets remain observable but structural grid topology is unavailable.',
        })
      }

      energyGridObservations.push(buildTharsisEnergyGridObservation({
        locationId: mars.id,
        liveAssets,
        liveTopology: topologyErrors.length === 0 ? {
          backboneNodes: ((backboneResult.data ?? []) as PowerBackboneRow[]).map(row => ({
            ring: row.ring,
            nodeRow: row.node_row,
            nodeCol: row.node_col,
          })),
          edges: ((edgeResult.data ?? []) as PowerEdgeRow[]).map(row => ({
            ring: row.ring,
            fromRow: row.from_row,
            fromCol: row.from_col,
            toRow: row.to_row,
            toCol: row.to_col,
          })),
          feeders: ((feederResult.data ?? []) as PowerFeederRow[]).map(row => ({
            ring: row.ring,
            objectRow: row.object_row,
            objectCol: row.object_col,
            nodeRow: row.node_row,
            nodeCol: row.node_col,
          })),
          sourceRef: 'core:location_utilities+location_utility_edges+location_utility_feeders:mars:power',
        } : undefined,
      }))
    }
  }

  const tharsisEnergy = energyGridObservations[0]

  return NextResponse.json({
    locationSignals,
    systemSignals,
    energyGridObservations,
    infrastructureIssues,
    unresolved: [
      {
        driverId: 'grid_capacity',
        reason: tharsisEnergy?.derivedDrivers.gridCapacity.reason
          ?? 'No authoritative grid/transmission/storage capacity model is available yet. Generic energy inventory is not treated as grid capacity.',
      },
      {
        driverId: 'firm_energy',
        reason: tharsisEnergy?.derivedDrivers.firmEnergy.reason
          ?? 'Current location energy production does not distinguish firm/dispatchable generation from intermittent output. No firm-energy signal is emitted until that source exists.',
      },
      {
        driverId: 'climate_stress',
        reason: 'Earth hazard layers are not yet connected to the World Development projection.',
      },
      {
        driverId: 'maintenance_capacity',
        reason: 'Station service topology can prove service ports, but no authoritative system-wide maintenance/shipyard capacity binding is used by this projection yet.',
      },
    ],
    boundaries: {
      readOnly: true,
      persistsState: false,
      advancesTicks: false,
      grantsUnlocks: false,
      mutatesEconomy: false,
    },
  })
}
