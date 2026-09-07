export interface BuildingFootprintPolicy {
  widthM: number
  depthM: number
  clearanceM: number
}

const DEFAULT_FOOTPRINT: BuildingFootprintPolicy = { widthM: 24, depthM: 24, clearanceM: 3 }

/**
 * Physical NOXIA spaceport operating footprints in LOCAL_ENU_METERS.
 *
 * These rectangles represent the occupied/serviced ground envelope used for
 * placement and collision checks. `clearanceM` is only the local ground-ops
 * separation to neighbouring structures; it is deliberately NOT a launch
 * exclusion, blast, noise or debris safety radius.
 *
 * The standard pad is dimensioned around the current large surface-craft
 * envelope (ASCE 0.3P: roughly 65-72 m long, 22-28 m span), leaving usable
 * apron space for access and servicing rather than treating the ship outline
 * itself as the pad.
 */
export const SPACEPORT_FOOTPRINTS: Readonly<Record<string, BuildingFootprintPolicy>> = {
  spaceport_core:         { widthM: 52,  depthM: 38, clearanceM: 6 },
  spaceport_pad_mini:     { widthM: 70,  depthM: 55, clearanceM: 10 },
  spaceport_pad_standard: { widthM: 120, depthM: 90, clearanceM: 15 },
  spaceport_service:      { widthM: 64,  depthM: 42, clearanceM: 6 },
  spaceport_storage:      { widthM: 72,  depthM: 48, clearanceM: 6 },

  // Mars/Tharsis surface logistics pad: separate type from the modular
  // `spaceport_*` system, but it still needs a real aircraft/spacecraft apron.
  landing_pad:            { widthM: 100, depthM: 80, clearanceM: 15 },
}

export function getBuildingFootprint(buildableId: string): BuildingFootprintPolicy {
  const id = buildableId.toLowerCase()

  // Exact canonical spaceport IDs must win before generic rules such as
  // `storage`, otherwise e.g. spaceport_storage collapses to 36 x 28 m.
  const spaceport = SPACEPORT_FOOTPRINTS[id]
  if (spaceport) return spaceport

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
