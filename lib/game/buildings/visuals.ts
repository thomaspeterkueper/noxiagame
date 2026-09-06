export interface BuildingVisualProfile {
  styleAnchorAsset?: string
  mapAsset?: string
  visualRole: 'style-anchor' | 'map-ready'
  location: string
  notes?: string
}

const EARTH_STYLE_ROOT = '/assets/buildings'

export const BUILDING_VISUALS: Record<string, BuildingVisualProfile> = {
  habitat: {
    styleAnchorAsset: `${EARTH_STYLE_ROOT}/habitat/earth/style-anchor.svg`,
    mapAsset: `${EARTH_STYLE_ROOT}/habitat/earth/style-anchor.svg`,
    visualRole: 'map-ready',
    location: 'earth',
    notes: 'NOXIA Earth Core V1 style anchor: compact residential/operations building.',
  },
  laboratory: {
    styleAnchorAsset: `${EARTH_STYLE_ROOT}/laboratory/earth/style-anchor.svg`,
    mapAsset: `${EARTH_STYLE_ROOT}/laboratory/earth/style-anchor.svg`,
    visualRole: 'map-ready',
    location: 'earth',
    notes: 'NOXIA Earth Core V1 research/analysis building.',
  },
  warehouse: {
    styleAnchorAsset: `${EARTH_STYLE_ROOT}/warehouse/earth/style-anchor.svg`,
    mapAsset: `${EARTH_STYLE_ROOT}/warehouse/earth/style-anchor.svg`,
    visualRole: 'map-ready',
    location: 'earth',
    notes: 'NOXIA Earth Core V1 warehouse/logistics hall.',
  },
  workshop: {
    styleAnchorAsset: `${EARTH_STYLE_ROOT}/workshop/earth/style-anchor.svg`,
    mapAsset: `${EARTH_STYLE_ROOT}/workshop/earth/style-anchor.svg`,
    visualRole: 'map-ready',
    location: 'earth',
    notes: 'NOXIA Earth Core V1 workshop/light-production hall.',
  },
}

export function getBuildingVisual(buildingId: string, location: string) {
  const visual = BUILDING_VISUALS[buildingId]
  return visual?.location === location ? visual : null
}
