export type BuildResource = 'components'

export type ResourceCost = {
  resource: BuildResource
  amount: number
}

const RESOURCE_COSTS: Record<string, ResourceCost[]> = {
  residential_block: [{ resource: 'components', amount: 10 }],
  laboratory: [{ resource: 'components', amount: 15 }],
  factory: [{ resource: 'components', amount: 5 }],
}

export function getResourceCosts(buildingId: string): ResourceCost[] {
  return RESOURCE_COSTS[buildingId] ?? []
}
