export interface BuildingFootprintPolicy {
  widthM: number
  depthM: number
  clearanceM: number
}

const DEFAULT_FOOTPRINT: BuildingFootprintPolicy = { widthM: 24, depthM: 24, clearanceM: 3 }

export function getBuildingFootprint(buildableId: string): BuildingFootprintPolicy {
  const id = buildableId.toLowerCase()
  if (id.includes('road')) return { widthM: 8, depthM: 24, clearanceM: 0 }
  if (id.includes('solar')) return { widthM: 60, depthM: 40, clearanceM: 4 }
  if (id.includes('factory') || id.includes('smelt') || id.includes('schmelz')) return { widthM: 42, depthM: 30, clearanceM: 5 }
  if (id.includes('labor') || id.includes('research')) return { widthM: 32, depthM: 24, clearanceM: 4 }
  if (id.includes('habitat') || id.includes('residential') || id.includes('wohn')) return { widthM: 28, depthM: 22, clearanceM: 3 }
  if (id.includes('water') || id.includes('wasser')) return { widthM: 36, depthM: 26, clearanceM: 4 }
  if (id.includes('mine') || id.includes('drill')) return { widthM: 34, depthM: 34, clearanceM: 6 }
  if (id.includes('warehouse') || id.includes('storage') || id.includes('depot')) return { widthM: 36, depthM: 28, clearanceM: 4 }
  return DEFAULT_FOOTPRINT
}
