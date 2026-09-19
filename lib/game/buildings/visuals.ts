export interface BuildingVisualProfile {
  styleAnchorAsset?: string
  mapAsset?: string
  visualRole: 'style-anchor' | 'map-ready'
  location: string
  mapScale?: number
  notes?: string
}

const EARTH_STYLE_ROOT = '/assets/buildings'

export const BUILDING_VISUALS: Record<string, BuildingVisualProfile> = {
  habitat: {
    styleAnchorAsset: `${EARTH_STYLE_ROOT}/habitat/earth/style-anchor.svg`,
    mapAsset: `${EARTH_STYLE_ROOT}/habitat/earth/style-anchor.svg`,
    visualRole: 'map-ready',
    location: 'earth',
    mapScale: 1.65,
    notes: 'NOXIA Earth Core V1 style anchor: compact residential/operations building.',
  },
  residential_block: {
    styleAnchorAsset: `${EARTH_STYLE_ROOT}/habitat/earth/style-anchor.svg`,
    mapAsset: `${EARTH_STYLE_ROOT}/habitat/earth/style-anchor.svg`,
    visualRole: 'map-ready',
    location: 'earth',
    mapScale: 1.85,
    notes: 'Earth residential block currently reuses the habitat visual language until its own anchor exists.',
  },
  laboratory: {
    styleAnchorAsset: `${EARTH_STYLE_ROOT}/laboratory/earth/style-anchor.svg`,
    mapAsset: `${EARTH_STYLE_ROOT}/laboratory/earth/style-anchor.svg`,
    visualRole: 'map-ready',
    location: 'earth',
    mapScale: 1.7,
    notes: 'NOXIA Earth Core V1 research/analysis building.',
  },
  warehouse: {
    styleAnchorAsset: `${EARTH_STYLE_ROOT}/warehouse/earth/style-anchor.svg`,
    mapAsset: `${EARTH_STYLE_ROOT}/warehouse/earth/style-anchor.svg`,
    visualRole: 'map-ready',
    location: 'earth',
    mapScale: 1.85,
    notes: 'NOXIA Earth Core V1 warehouse/logistics hall.',
  },
  admin: {
    styleAnchorAsset: `${EARTH_STYLE_ROOT}/admin/earth/style-anchor.svg`,
    mapAsset: `${EARTH_STYLE_ROOT}/admin/earth/style-anchor.svg`,
    visualRole: 'map-ready',
    location: 'earth',
    mapScale: 1.7,
    notes: 'Simple blue-gray Earth administration asset for placement and gameplay testing.',
  },
  workshop: {
    styleAnchorAsset: `${EARTH_STYLE_ROOT}/workshop/earth/style-anchor.svg`,
    mapAsset: `${EARTH_STYLE_ROOT}/workshop/earth/style-anchor.svg`,
    visualRole: 'map-ready',
    location: 'earth',
    mapScale: 1.8,
    notes: 'NOXIA Earth Core V1 workshop/light-production hall.',
  },
  factory: {
    styleAnchorAsset: `${EARTH_STYLE_ROOT}/workshop/earth/style-anchor.svg`,
    mapAsset: `${EARTH_STYLE_ROOT}/workshop/earth/style-anchor.svg`,
    visualRole: 'map-ready',
    location: 'earth',
    mapScale: 1.95,
    notes: 'Factory uses the Earth workshop visual as an interim production-building anchor.',
  },
  solar: {
    styleAnchorAsset: `${EARTH_STYLE_ROOT}/solar/earth/style-anchor.svg`,
    mapAsset: `${EARTH_STYLE_ROOT}/solar/earth/style-anchor.svg`,
    visualRole: 'map-ready',
    location: 'earth',
    mapScale: 1.95,
    notes: 'Test-first Earth solar field: deliberately blue/anthracite for immediate map readability.',
  },
  ssf_headquarters_sundern: {
    styleAnchorAsset: `${EARTH_STYLE_ROOT}/ssf_headquarters_sundern/earth/style-anchor.svg`,
    mapAsset: `${EARTH_STYLE_ROOT}/ssf_headquarters_sundern/earth/style-anchor.svg`,
    visualRole: 'map-ready',
    location: 'earth',
    mapScale: 2.05,
    notes: 'Unique 1971 SSF Foundation House at Bogenstraße 15: hipped-roof bungalow, detached garage along the long side, side entrance facing the garage.',
  },
  // 16.09.2026: Raumhafen-Gebaeudetypen hatten noch keinen eigenen Eintrag
  // und zeigten daher nur die leere Fallback-Kachel auf der Karte. Bis
  // eigene Raumhafen-Assets existieren, leihen sie sich -- genau wie
  // residential_block/factory oben -- ein bestehendes Asset als
  // Uebergangsloesung statt komplett unstilisiert zu bleiben.
  spaceport_core: {
    styleAnchorAsset: `${EARTH_STYLE_ROOT}/admin/earth/style-anchor.svg`,
    mapAsset: `${EARTH_STYLE_ROOT}/admin/earth/style-anchor.svg`,
    visualRole: 'map-ready',
    location: 'earth',
    mapScale: 2.1,
    notes: 'Interimsvisual (leiht sich admin-Asset), bis ein eigener Raumhafen-Kern-Anker existiert.',
  },
  spaceport_service: {
    styleAnchorAsset: `${EARTH_STYLE_ROOT}/workshop/earth/style-anchor.svg`,
    mapAsset: `${EARTH_STYLE_ROOT}/workshop/earth/style-anchor.svg`,
    visualRole: 'map-ready',
    location: 'earth',
    mapScale: 1.9,
    notes: 'Interimsvisual (leiht sich workshop-Asset), bis ein eigener Raumhafen-Service-Anker existiert.',
  },
  spaceport_storage: {
    styleAnchorAsset: `${EARTH_STYLE_ROOT}/warehouse/earth/style-anchor.svg`,
    mapAsset: `${EARTH_STYLE_ROOT}/warehouse/earth/style-anchor.svg`,
    visualRole: 'map-ready',
    location: 'earth',
    mapScale: 1.85,
    notes: 'Interimsvisual (leiht sich warehouse-Asset), bis ein eigener Raumhafen-Lager-Anker existiert.',
  },
  spaceport_pad_standard: {
    styleAnchorAsset: `${EARTH_STYLE_ROOT}/solar/earth/style-anchor.svg`,
    mapAsset: `${EARTH_STYLE_ROOT}/solar/earth/style-anchor.svg`,
    visualRole: 'map-ready',
    location: 'earth',
    mapScale: 2.4,
    notes: 'Interimsvisual (leiht sich solar-Asset als flache, grossflaechige Form), bis ein eigener Pad-Anker existiert.',
  },
  spaceport_pad_mini: {
    styleAnchorAsset: `${EARTH_STYLE_ROOT}/solar/earth/style-anchor.svg`,
    mapAsset: `${EARTH_STYLE_ROOT}/solar/earth/style-anchor.svg`,
    visualRole: 'map-ready',
    location: 'earth',
    mapScale: 1.6,
    notes: 'Interimsvisual (leiht sich solar-Asset als flache, grossflaechige Form), bis ein eigener Pad-Anker existiert.',
  },
  scanner: {
    styleAnchorAsset: `${EARTH_STYLE_ROOT}/laboratory/earth/style-anchor.svg`,
    mapAsset: `${EARTH_STYLE_ROOT}/laboratory/earth/style-anchor.svg`,
    visualRole: 'map-ready',
    location: 'earth',
    mapScale: 1.4,
    notes: 'Interimsvisual (leiht sich laboratory-Asset), bis ein eigener Scanner-Anker existiert.',
  },
}

export function getBuildingVisual(buildingId: string, location: string) {
  const visual = BUILDING_VISUALS[buildingId]
  return visual?.location === location ? visual : null
}
