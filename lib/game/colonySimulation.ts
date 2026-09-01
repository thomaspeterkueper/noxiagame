import { BUILDINGS } from './buildings'

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
  simulatedProduction: number
  simulatedConsumption: number
  netDelta: number
  nextStock: number
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
}

function amount(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

/**
 * Pure deterministic one-tick projection.
 *
 * It does not persist state and does not invent production rules. Only
 * `produces` / `consumes` declared in the canonical building catalogue are
 * executed. Entities are processed in stable id order so identical colony
 * snapshots always produce the same result.
 */
export function simulateColonyTick(
  resources: ColonySimulationResourceInput[],
  entities: ColonySimulationEntityInput[],
): ColonySimulationResult {
  const declared = new Map<string, ColonySimulationResourceInput>()
  const stock = new Map<string, number>()
  const simulatedProduction = new Map<string, number>()
  const simulatedConsumption = new Map<string, number>()

  for (const row of resources) {
    declared.set(row.resource, row)
    stock.set(row.resource, amount(row.stock))
  }

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
        reason: 'Keine Simulationsdefinition',
        consumes: null,
        produces: null,
      })
      continue
    }

    const consumes = definition.consumes ?? null
    const produces = definition.produces ?? null

    if (!consumes && !produces) {
      buildingStates.push({
        entityId: entity.id,
        buildingId: definition.id,
        state: 'idle',
        reason: 'Keine Ressourcenregel deklariert',
        consumes: null,
        produces: null,
      })
      continue
    }

    if (consumes) {
      const available = stock.get(consumes.resource) ?? 0
      if (available < consumes.amount) {
        buildingStates.push({
          entityId: entity.id,
          buildingId: definition.id,
          state: 'starved',
          reason: `${consumes.resource} fehlt`,
          consumes: { ...consumes },
          produces: produces ? { ...produces } : null,
        })
        continue
      }

      stock.set(consumes.resource, available - consumes.amount)
      simulatedConsumption.set(
        consumes.resource,
        (simulatedConsumption.get(consumes.resource) ?? 0) + consumes.amount,
      )
    }

    if (produces) {
      stock.set(produces.resource, (stock.get(produces.resource) ?? 0) + produces.amount)
      simulatedProduction.set(
        produces.resource,
        (simulatedProduction.get(produces.resource) ?? 0) + produces.amount,
      )
    }

    buildingStates.push({
      entityId: entity.id,
      buildingId: definition.id,
      state: 'operational',
      reason: null,
      consumes: consumes ? { ...consumes } : null,
      produces: produces ? { ...produces } : null,
    })
  }

  const resourceCodes = new Set<string>([
    ...declared.keys(),
    ...simulatedProduction.keys(),
    ...simulatedConsumption.keys(),
  ])

  const flows = [...resourceCodes].sort().map(resource => {
    const row = declared.get(resource)
    const initialStock = amount(row?.stock)
    const production = simulatedProduction.get(resource) ?? 0
    const consumption = simulatedConsumption.get(resource) ?? 0
    return {
      resource,
      stock: initialStock,
      declaredProduction: amount(row?.production),
      declaredConsumption: amount(row?.consumption),
      simulatedProduction: production,
      simulatedConsumption: consumption,
      netDelta: production - consumption,
      nextStock: Math.max(0, initialStock + production - consumption),
    }
  })

  const shortages = [...new Set(
    buildingStates
      .filter(building => building.state === 'starved' && building.consumes)
      .map(building => building.consumes!.resource),
  )].sort()

  const starved = buildingStates.filter(building => building.state === 'starved').length
  const productive = buildingStates.filter(building => building.state === 'operational').length
  const status = starved > 0
    ? (productive === 0 ? 'critical' : 'strained')
    : 'stable'

  return { resources: flows, buildings: buildingStates, status, shortages }
}
