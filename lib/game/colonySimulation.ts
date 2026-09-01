import { BUILDINGS } from './buildings'
import {
  POPULATION_RESOURCE_TYPES,
  isPopulationSupplied,
  populationResourceConsumption,
  projectResourceStock,
} from './resourceEconomy'

export type ColonyBuildingOperationalState = 'operational' | 'starved' | 'idle'

export interface ColonySimulationResourceInput {
  resource: string
  stock?: number | null
  production?: number | null
  consumption?: number | null
}

export interface ColonySimulationEntityInput {
  id: string
  entity_id: string
  entity_type: string
}

export interface ColonyResourceFlow {
  resource: string
  stock: number
  declaredProduction: number
  declaredConsumption: number
  populationConsumption: number
  simulatedProduction: number
  simulatedConsumption: number
  netDelta: number
  nextStock: number
  source: 'authoritative' | 'fallback'
}

export interface ColonyBuildingSimulationState {
  entityId: string
  buildingId: string
  state: ColonyBuildingOperationalState
  reason: string | null
  consumes: { resource: string; amount: number } | null
  produces: { resource: string; amount: number } | null
}

export interface ColonySimulationResult {
  resources: ColonyResourceFlow[]
  buildings: ColonyBuildingSimulationState[]
  status: 'stable' | 'strained' | 'critical'
  shortages: string[]
  populationSupplied: boolean
}

function amount(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

/**
 * Pure deterministic one-tick projection for the colony HUD.
 *
 * `location_resources.production/consumption` are written by the authoritative
 * server tick and therefore win whenever they are present. The static TS
 * building catalogue is only a fallback for snapshots that have no persisted
 * flow yet; it must never become a second economic source of truth.
 *
 * Population supply deliberately uses the stock at the beginning of the tick,
 * matching `runPopulationTick`: production during the tick does not
 * retroactively make population growth supplied.
 */
export function simulateColonyTick(
  resources: ColonySimulationResourceInput[],
  entities: ColonySimulationEntityInput[],
  population = 0,
): ColonySimulationResult {
  const declared = new Map<string, ColonySimulationResourceInput>()
  const stocks: Record<string, number> = {}
  const fallbackProduction = new Map<string, number>()
  const fallbackBuildingConsumption = new Map<string, number>()

  for (const row of resources) {
    declared.set(row.resource, row)
    stocks[row.resource] = amount(row.stock)
  }

  const populationConsumption = populationResourceConsumption(population)
  const populationSupplied = isPopulationSupplied(stocks, population)

  const buildingStates: ColonyBuildingSimulationState[] = []
  const buildings = entities
    .filter(entity => entity.entity_type === 'building')
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))

  for (const entity of buildings) {
    const definition = BUILDINGS[entity.entity_id]
    if (!definition) {
      buildingStates.push({
        entityId: entity.id,
        buildingId: entity.entity_id,
        state: 'idle',
        reason: 'Keine lokale Fallback-Definition',
        consumes: null,
        produces: null,
      })
      continue
    }

    const consumes = definition.consumes ?? null
    const produces = definition.produces ?? null

    if (consumes) {
      fallbackBuildingConsumption.set(
        consumes.resource,
        (fallbackBuildingConsumption.get(consumes.resource) ?? 0) + amount(consumes.amount),
      )
    }
    if (produces) {
      fallbackProduction.set(
        produces.resource,
        (fallbackProduction.get(produces.resource) ?? 0) + amount(produces.amount),
      )
    }

    buildingStates.push({
      entityId: entity.id,
      buildingId: definition.id,
      state: consumes || produces ? 'operational' : 'idle',
      reason: consumes || produces ? null : 'Keine Ressourcenregel deklariert',
      consumes: consumes ? { ...consumes } : null,
      produces: produces ? { ...produces } : null,
    })
  }

  const resourceCodes = new Set<string>([
    ...declared.keys(),
    ...fallbackProduction.keys(),
    ...fallbackBuildingConsumption.keys(),
    ...POPULATION_RESOURCE_TYPES,
  ])

  const projectedDeficits = new Set<string>()
  const flows = [...resourceCodes].sort().map(resource => {
    const row = declared.get(resource)
    const initialStock = amount(row?.stock)
    const declaredProduction = amount(row?.production)
    const declaredConsumption = amount(row?.consumption)
    const hasAuthoritativeFlow = row?.production != null || row?.consumption != null
    const lifeSupport = amount(populationConsumption[resource as keyof typeof populationConsumption])

    const production = hasAuthoritativeFlow
      ? declaredProduction
      : fallbackProduction.get(resource) ?? 0
    const consumption = hasAuthoritativeFlow
      ? declaredConsumption
      : lifeSupport + (fallbackBuildingConsumption.get(resource) ?? 0)

    const unclampedNextStock = initialStock + production - consumption
    if (unclampedNextStock < 0) projectedDeficits.add(resource)

    return {
      resource,
      stock: initialStock,
      declaredProduction,
      declaredConsumption,
      populationConsumption: lifeSupport,
      simulatedProduction: production,
      simulatedConsumption: consumption,
      netDelta: production - consumption,
      nextStock: projectResourceStock(initialStock, production, consumption),
      source: hasAuthoritativeFlow ? 'authoritative' as const : 'fallback' as const,
    }
  })

  const lifeSupportShortages = POPULATION_RESOURCE_TYPES.filter(resource =>
    (stocks[resource] ?? 0) < populationConsumption[resource],
  )
  const shortages = [...new Set([...lifeSupportShortages, ...projectedDeficits])].sort()

  const status: ColonySimulationResult['status'] = !populationSupplied
    ? 'critical'
    : projectedDeficits.size > 0
      ? 'strained'
      : 'stable'

  return { resources: flows, buildings: buildingStates, status, shortages, populationSupplied }
}
