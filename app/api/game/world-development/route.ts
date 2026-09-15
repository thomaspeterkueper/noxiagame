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
 * - no nested Supabase relation assumptions for source data.
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
    // One resource balance per location is the existing location_resources
    // contract. Keep the first row if malformed duplicate source data appears;
    // this read model does not reconcile or mutate source truth.
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
      energyGridObservations.push(buildTharsisEnergyGridObservation({
        locationId: mars.id,
        liveAssets,
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
