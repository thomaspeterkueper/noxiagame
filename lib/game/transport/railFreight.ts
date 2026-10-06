import type { Resource } from '../resources'

export type RailFreightDemand = {
  originStationId: string
  destinationStationId: string
  resource: Resource
  units: number
  valuePerUnit: number
}

export type RailFreightCapacity = {
  maxUnits: number
  operatingCost: number
}

export type RailFreightAllocation = {
  resource: Resource
  units: number
  revenue: number
}

export type RailFreightResult = {
  allocations: RailFreightAllocation[]
  loadedUnits: number
  utilization: number
  grossRevenue: number
  operatingCost: number
  netResult: number
}

/**
 * Aggregate freight at service/run level instead of simulating individual cargo
 * objects. This keeps the economy meaningful while bounding compute and storage
 * by resource types rather than by tonnes, crates or passengers.
 */
export function allocateRailFreight(
  demands: RailFreightDemand[],
  capacity: RailFreightCapacity,
): RailFreightResult {
  let remaining = Math.max(0, capacity.maxUnits)
  const allocations: RailFreightAllocation[] = []

  for (const demand of demands) {
    if (remaining <= 0) break
    const available = Math.max(0, Number(demand.units) || 0)
    const units = Math.min(remaining, available)
    if (units <= 0) continue
    allocations.push({
      resource: demand.resource,
      units,
      revenue: units * Math.max(0, Number(demand.valuePerUnit) || 0),
    })
    remaining -= units
  }

  const loadedUnits = allocations.reduce((sum, item) => sum + item.units, 0)
  const grossRevenue = allocations.reduce((sum, item) => sum + item.revenue, 0)
  const maxUnits = Math.max(0, capacity.maxUnits)
  const operatingCost = Math.max(0, capacity.operatingCost)

  return {
    allocations,
    loadedUnits,
    utilization: maxUnits > 0 ? loadedUnits / maxUnits : 0,
    grossRevenue,
    operatingCost,
    netResult: grossRevenue - operatingCost,
  }
}

/**
 * One compact demand row per OD/resource bucket is sufficient for persistence.
 * Multiple producers/consumers can be folded into the same bucket before write.
 */
export function aggregateRailFreightDemand(demands: RailFreightDemand[]) {
  const buckets = new Map<string, RailFreightDemand>()
  for (const demand of demands) {
    const key = [demand.originStationId, demand.destinationStationId, demand.resource].join(':')
    const current = buckets.get(key)
    if (!current) {
      buckets.set(key, { ...demand, units: Math.max(0, demand.units) })
      continue
    }
    const oldUnits = current.units
    const addedUnits = Math.max(0, demand.units)
    const totalUnits = oldUnits + addedUnits
    current.valuePerUnit = totalUnits > 0
      ? ((current.valuePerUnit * oldUnits) + (Math.max(0, demand.valuePerUnit) * addedUnits)) / totalUnits
      : 0
    current.units = totalUnits
  }
  return [...buckets.values()]
}
