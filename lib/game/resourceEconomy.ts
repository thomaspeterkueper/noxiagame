import { CONSUMPTION_PER_100 } from './config'

export const POPULATION_RESOURCE_TYPES = ['water', 'energy', 'metal'] as const

export type PopulationResource = typeof POPULATION_RESOURCE_TYPES[number]
export type PopulationConsumption = Record<PopulationResource | 'components', number>

function safeAmount(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

/**
 * Authoritative life-support demand for one economy tick.
 * Keep this formula identical to the server tick: fractional demand is rounded
 * up so even small settlements consume at least one unit of a required resource.
 */
export function populationResourceConsumption(population: number): PopulationConsumption {
  const safePopulation = safeAmount(population)
  return {
    water: Math.ceil((safePopulation / 100) * CONSUMPTION_PER_100.water),
    energy: Math.ceil((safePopulation / 100) * CONSUMPTION_PER_100.energy),
    metal: Math.ceil((safePopulation / 100) * CONSUMPTION_PER_100.metal),
    components: 0,
  }
}

/**
 * The server decides population supply from the stock at the beginning of the
 * tick. Production during that tick does not retroactively make the population
 * supplied for growth/decline purposes.
 */
export function isPopulationSupplied(stocks: Record<string, number>, population: number) {
  const demand = populationResourceConsumption(population)
  return POPULATION_RESOURCE_TYPES.every(resource => safeAmount(stocks[resource]) >= demand[resource])
}

export function projectResourceStock(stock: number, production: number, consumption: number) {
  return Math.max(0, safeAmount(stock) + safeAmount(production) - safeAmount(consumption))
}
