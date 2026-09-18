import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { buildReactorRuntimeSummary, type ReactorRuntimeStateRow } from '@/lib/game/reactorRuntime'
import { THARSIS_HUB_BUILDINGS } from '@/lib/game/seeds/tharsisHubSeed'

interface LocationRow {
  id: string
  slug: string
  name: string | null
}

interface ReactorRow {
  id: string
  tile_row: number | null
  tile_col: number | null
}

interface ReactorStateDbRow {
  subject_id: string
  properties: unknown
  source_event: string | null
  canonical_state_id: string | null
  valid_from: string | null
}

const canonicalReactors = THARSIS_HUB_BUILDINGS.filter(
  building => building.entityId === 'reactor_module' && typeof building.nominalPowerMw === 'number',
)

function coordinateKey(row: number | null, col: number | null): string | null {
  if (!Number.isInteger(row) || !Number.isInteger(col)) return null
  return `${Number(row)}:${Number(col)}`
}

/**
 * Read-only E2a projection of reactor operating state.
 *
 * This endpoint never mutates runtime state and never interprets a missing
 * state as offline or online. The authoritative write boundary is the
 * server-only `noxia_set_reactor_runtime` Core command.
 */
export async function GET() {
  const supabase = createServiceClient()

  const { data: locationData, error: locationError } = await supabase
    .from('locations')
    .select('id, slug, name')
    .eq('slug', 'mars')
    .limit(1)
    .maybeSingle()

  if (locationError) {
    return NextResponse.json(
      { error: 'reactor_runtime_location_query_failed', detail: locationError.message },
      { status: 503 },
    )
  }

  const mars = locationData as LocationRow | null
  if (!mars) {
    return NextResponse.json({ error: 'reactor_runtime_mars_location_missing' }, { status: 404 })
  }

  const { data: reactorData, error: reactorError } = await supabase
    .from('tile_entities')
    .select('id, tile_row, tile_col')
    .eq('location_id', mars.id)
    .eq('entity_type', 'building')
    .eq('entity_id', 'reactor_module')

  if (reactorError) {
    return NextResponse.json(
      { error: 'reactor_runtime_asset_query_failed', detail: reactorError.message },
      { status: 503 },
    )
  }

  const liveReactors = (reactorData ?? []) as ReactorRow[]
  const canonicalByCoordinate = new Map<string, (typeof canonicalReactors)[number]>(
    canonicalReactors.map(reactor => [`${reactor.row}:${reactor.col}`, reactor]),
  )

  const assets = liveReactors.map(reactor => {
    const key = coordinateKey(reactor.tile_row, reactor.tile_col)
    const canonical = key ? canonicalByCoordinate.get(key) : undefined
    return {
      tileEntityId: reactor.id,
      nominalPowerMw: typeof canonical?.nominalPowerMw === 'number' ? canonical.nominalPowerMw : null,
    }
  })

  let stateRows: ReactorRuntimeStateRow[] = []
  const reactorIds = liveReactors.map(reactor => reactor.id)
  if (reactorIds.length > 0) {
    const { data: stateData, error: stateError } = await supabase
      .from('entity_states')
      .select('subject_id, properties, source_event, canonical_state_id, valid_from')
      .eq('subject_type', 'reactor_runtime')
      .is('valid_to', null)
      .in('subject_id', reactorIds)

    if (stateError) {
      return NextResponse.json(
        { error: 'reactor_runtime_state_query_failed', detail: stateError.message },
        { status: 503 },
      )
    }

    stateRows = ((stateData ?? []) as ReactorStateDbRow[]).map(row => ({
      subjectId: row.subject_id,
      properties: row.properties,
      sourceEvent: row.source_event,
      canonicalStateId: row.canonical_state_id,
      validFrom: row.valid_from,
    }))
  }

  const summary = buildReactorRuntimeSummary({ assets, currentStates: stateRows })
  const installedNominalPowerMw = assets.reduce(
    (sum, asset) => sum + (typeof asset.nominalPowerMw === 'number' ? asset.nominalPowerMw : 0),
    0,
  )

  return NextResponse.json({
    location: mars,
    engineering: {
      observedReactorModules: liveReactors.length,
      canonicalReactorModules: canonicalReactors.length,
      installedNominalPowerMw,
      canonicalNominalPowerMw: canonicalReactors.reduce(
        (sum, reactor) => sum + Number(reactor.nominalPowerMw ?? 0),
        0,
      ),
      sourceRef: 'core:tile_entities:mars+seed:tharsisHubSeed:nominal-reactor-power',
    },
    runtime: summary,
    unresolved: {
      firmEnergy: 'Available reactor MW is not firm-energy adequacy. Demand, storage depth and reserve policy remain authoritative gaps.',
      gridCapacity: 'Reactor operating state does not establish breaker continuity or transmission MW limits.',
    },
    authority: {
      writeCommand: 'public.noxia_set_reactor_runtime',
      eventType: 'reactor.runtime.changed',
      stateSubjectType: 'reactor_runtime',
      sourceRef: 'core:simulation_events+entity_states:reactor_runtime',
    },
    boundaries: {
      readOnly: true,
      persistsState: false,
      advancesTicks: false,
      mutatesEconomy: false,
      storesNominalPowerMw: false,
      storesAvailablePowerMw: false,
    },
  })
}
