export interface BuildingVisualProfile {
  styleAnchorAsset?: string
  mapAsset?: string
  visualRole: 'style-anchor' | 'map-ready'
  location: string
  mapScale?: number
  notes?: string
}

const EARTH_STYLE_ROOT = '/assets/buildings'

// 16.09.2026: von Record<buildingId, Profile> auf Record<buildingId,
// Record<location, Profile>> umgestellt, damit ein Gebaeudetyp (z.B.
// 'admin', 'scanner') fuer mehrere Standorte (Earth UND Moon) je ein
// eigenes -- oder bewusst wiederverwendetes -- Visual haben kann. Vorher
// konnte jede buildingId nur GENAU einen Standort abdecken.
export const BUILDING_VISUALS: Record<string, Record<string, BuildingVisualProfile>> = {
  habitat: {
    earth: {
      styleAnchorAsset: `${EARTH_STYLE_ROOT}/habitat/earth/style-anchor.svg`,
      mapAsset: `${EARTH_STYLE_ROOT}/habitat/earth/style-anchor.svg`,
      visualRole: 'map-ready',
      location: 'earth',
      mapScale: 1.65,
      notes: 'NOXIA Earth Core V1 style anchor: compact residential/operations building.',
    },
    moon: {
      styleAnchorAsset: `${EARTH_STYLE_ROOT}/habitat/earth/style-anchor.svg`,
      mapAsset: `${EARTH_STYLE_ROOT}/habitat/earth/style-anchor.svg`,
      visualRole: 'map-ready',
      location: 'moon',
      mapScale: 1.65,
      notes: 'Mond-Habitat leiht sich bis auf Weiteres das Earth-Habitat-Asset.',
    },
  },
  residential_block: {
    earth: {
      styleAnchorAsset: `${EARTH_STYLE_ROOT}/habitat/earth/style-anchor.svg`,
      mapAsset: `${EARTH_STYLE_ROOT}/habitat/earth/style-anchor.svg`,
      visualRole: 'map-ready',
      location: 'earth',
      mapScale: 1.85,
      notes: 'Earth residential block currently reuses the habitat visual language until its own anchor exists.',
    },
  },
  laboratory: {
    earth: {
      styleAnchorAsset: `${EARTH_STYLE_ROOT}/laboratory/earth/style-anchor.svg`,
      mapAsset: `${EARTH_STYLE_ROOT}/laboratory/earth/style-anchor.svg`,
      visualRole: 'map-ready',
      location: 'earth',
      mapScale: 1.7,
      notes: 'NOXIA Earth Core V1 research/analysis building.',
    },
    moon: {
      styleAnchorAsset: `${EARTH_STYLE_ROOT}/laboratory/earth/style-anchor.svg`,
      mapAsset: `${EARTH_STYLE_ROOT}/laboratory/earth/style-anchor.svg`,
      visualRole: 'map-ready',
      location: 'moon',
      mapScale: 1.7,
      notes: 'Mond-Labor leiht sich bis auf Weiteres das Earth-Labor-Asset.',
    },
  },
  warehouse: {
    earth: {
      styleAnchorAsset: `${EARTH_STYLE_ROOT}/warehouse/earth/style-anchor.svg`,
      mapAsset: `${EARTH_STYLE_ROOT}/warehouse/earth/style-anchor.svg`,
      visualRole: 'map-ready',
      location: 'earth',
      mapScale: 1.85,
      notes: 'NOXIA Earth Core V1 warehouse/logistics hall.',
    },
    moon: {
      styleAnchorAsset: `${EARTH_STYLE_ROOT}/warehouse/earth/style-anchor.svg`,
      mapAsset: `${EARTH_STYLE_ROOT}/warehouse/earth/style-anchor.svg`,
      visualRole: 'map-ready',
      location: 'moon',
      mapScale: 1.85,
      notes: 'Mond-Warenhalle leiht sich bis auf Weiteres das Earth-Warehouse-Asset.',
    },
  },
  admin: {
    earth: {
      styleAnchorAsset: `${EARTH_STYLE_ROOT}/admin/earth/style-anchor.svg`,
      mapAsset: `${EARTH_STYLE_ROOT}/admin/earth/style-anchor.svg`,
      visualRole: 'map-ready',
      location: 'earth',
      mapScale: 1.7,
      notes: 'Simple blue-gray Earth administration asset for placement and gameplay testing.',
    },
    moon: {
      styleAnchorAsset: `${EARTH_STYLE_ROOT}/admin/earth/style-anchor.svg`,
      mapAsset: `${EARTH_STYLE_ROOT}/admin/earth/style-anchor.svg`,
      visualRole: 'map-ready',
      location: 'moon',
      mapScale: 1.7,
      notes: 'Mond-Verwaltung leiht sich bis auf Weiteres das Earth-Admin-Asset.',
    },
  },
  workshop: {
    earth: {
      styleAnchorAsset: `${EARTH_STYLE_ROOT}/workshop/earth/style-anchor.svg`,
      mapAsset: `${EARTH_STYLE_ROOT}/workshop/earth/style-anchor.svg`,
      visualRole: 'map-ready',
      location: 'earth',
      mapScale: 1.8,
      notes: 'NOXIA Earth Core V1 workshop/light-production hall.',
    },
    moon: {
      styleAnchorAsset: `${EARTH_STYLE_ROOT}/workshop/earth/style-anchor.svg`,
      mapAsset: `${EARTH_STYLE_ROOT}/workshop/earth/style-anchor.svg`,
      visualRole: 'map-ready',
      location: 'moon',
      mapScale: 1.8,
      notes: 'Mond-Werkstatt verwendet dieselbe Werkstatt-Sprache wie die Erde.',
    },
  },
  surface_workshop: {
    moon: {
      styleAnchorAsset: `${EARTH_STYLE_ROOT}/workshop/earth/style-anchor.svg`,
      mapAsset: `${EARTH_STYLE_ROOT}/workshop/earth/style-anchor.svg`,
      visualRole: 'map-ready',
      location: 'moon',
      mapScale: 1.8,
      notes: 'Shackleton-Werkstatt: bestehendes Werkstatt-Asset bis ein eigenes Lunar-Asset vorliegt.',
    },
  },
  factory: {
    earth: {
      styleAnchorAsset: `${EARTH_STYLE_ROOT}/workshop/earth/style-anchor.svg`,
      mapAsset: `${EARTH_STYLE_ROOT}/workshop/earth/style-anchor.svg`,
      visualRole: 'map-ready',
      location: 'earth',
      mapScale: 1.95,
      notes: 'Factory uses the Earth workshop visual as an interim production-building anchor.',
    },
  },
  solar: {
    earth: {
      styleAnchorAsset: `${EARTH_STYLE_ROOT}/solar/earth/style-anchor.svg`,
      mapAsset: `${EARTH_STYLE_ROOT}/solar/earth/style-anchor.svg`,
      visualRole: 'map-ready',
      location: 'earth',
      mapScale: 1.95,
      notes: 'Test-first Earth solar field: deliberately blue/anthracite for immediate map readability.',
    },
    moon: {
      styleAnchorAsset: `${EARTH_STYLE_ROOT}/solar/earth/style-anchor.svg`,
      mapAsset: `${EARTH_STYLE_ROOT}/solar/earth/style-anchor.svg`,
      visualRole: 'map-ready',
      location: 'moon',
      mapScale: 1.95,
      notes: 'Mond-Solarfeld leiht sich bis auf Weiteres das Earth-Solar-Asset.',
    },
  },
  battery_storage: {
    moon: {
      styleAnchorAsset: `${EARTH_STYLE_ROOT}/warehouse/earth/style-anchor.svg`,
      mapAsset: `${EARTH_STYLE_ROOT}/warehouse/earth/style-anchor.svg`,
      visualRole: 'map-ready',
      location: 'moon',
      mapScale: 1.35,
      notes: 'Interimsvisual fuer Shackleton-Batteriespeicher; kompakter als das Warenhaus skaliert.',
    },
  },
  life_support_hub: {
    moon: {
      styleAnchorAsset: `${EARTH_STYLE_ROOT}/habitat/earth/style-anchor.svg`,
      mapAsset: `${EARTH_STYLE_ROOT}/habitat/earth/style-anchor.svg`,
      visualRole: 'map-ready',
      location: 'moon',
      mapScale: 1.35,
      notes: 'Interimsvisual fuer den ECLSS-/Lebenserhaltungsknoten der Shackleton-Basis.',
    },
  },
  rover_yard: {
    moon: {
      styleAnchorAsset: `${EARTH_STYLE_ROOT}/spaceport_service/earth/style-anchor.svg`,
      mapAsset: `${EARTH_STYLE_ROOT}/spaceport_service/earth/style-anchor.svg`,
      visualRole: 'map-ready',
      location: 'moon',
      mapScale: 1.55,
      notes: 'Roverhof verwendet vorerst den Service-Hangar als funktional passendes Kartenvisual.',
    },
  },
  surface_comms: {
    moon: {
      styleAnchorAsset: `${EARTH_STYLE_ROOT}/scanner/earth/style-anchor.svg`,
      mapAsset: `${EARTH_STYLE_ROOT}/scanner/earth/style-anchor.svg`,
      visualRole: 'map-ready',
      location: 'moon',
      mapScale: 1.45,
      notes: 'Kommunikationsmast verwendet das vorhandene Antennen-/Scanner-Asset.',
    },
  },
  ssf_headquarters_sundern: {
    earth: {
      styleAnchorAsset: `${EARTH_STYLE_ROOT}/ssf_headquarters_sundern/earth/style-anchor.svg`,
      mapAsset: `${EARTH_STYLE_ROOT}/ssf_headquarters_sundern/earth/style-anchor.svg`,
      visualRole: 'map-ready',
      location: 'earth',
      mapScale: 2.05,
      notes: 'Unique 1971 SSF Foundation House at Bogenstraße 15: hipped-roof bungalow, detached garage along the long side, side entrance facing the garage.',
    },
  },
  spaceport_core: {
    earth: {
      styleAnchorAsset: `${EARTH_STYLE_ROOT}/spaceport_core/earth/style-anchor.svg`,
      mapAsset: `${EARTH_STYLE_ROOT}/spaceport_core/earth/style-anchor.svg`,
      visualRole: 'map-ready',
      location: 'earth',
      mapScale: 2.1,
      notes: 'Eigenes Kontrollturm-Asset (hoher Baukoerper, Antenne).',
    },
  },
  spaceport_service: {
    earth: {
      styleAnchorAsset: `${EARTH_STYLE_ROOT}/spaceport_service/earth/style-anchor.svg`,
      mapAsset: `${EARTH_STYLE_ROOT}/spaceport_service/earth/style-anchor.svg`,
      visualRole: 'map-ready',
      location: 'earth',
      mapScale: 1.9,
      notes: 'Eigenes Hangar-Asset (Rundbogendach, offenes Tor).',
    },
  },
  spaceport_storage: {
    earth: {
      styleAnchorAsset: `${EARTH_STYLE_ROOT}/spaceport_storage/earth/style-anchor.svg`,
      mapAsset: `${EARTH_STYLE_ROOT}/spaceport_storage/earth/style-anchor.svg`,
      visualRole: 'map-ready',
      location: 'earth',
      mapScale: 1.85,
      notes: 'Eigenes Tank-Cluster-Asset (Treibstoff-/Fracht-Zylinder).',
    },
  },
  spaceport_pad_standard: {
    earth: {
      styleAnchorAsset: `${EARTH_STYLE_ROOT}/spaceport_pad/earth/style-anchor.svg`,
      mapAsset: `${EARTH_STYLE_ROOT}/spaceport_pad/earth/style-anchor.svg`,
      visualRole: 'map-ready',
      location: 'earth',
      mapScale: 2.4,
      notes: 'Eigenes Landepad-Asset (Kreisflaeche, Zielkreuz, Eck-Lichter).',
    },
  },
  spaceport_pad_mini: {
    earth: {
      styleAnchorAsset: `${EARTH_STYLE_ROOT}/spaceport_pad/earth/style-anchor.svg`,
      mapAsset: `${EARTH_STYLE_ROOT}/spaceport_pad/earth/style-anchor.svg`,
      visualRole: 'map-ready',
      location: 'earth',
      mapScale: 1.6,
      notes: 'Eigenes Landepad-Asset, kleiner skaliert.',
    },
  },
  scanner: {
    earth: {
      styleAnchorAsset: `${EARTH_STYLE_ROOT}/scanner/earth/style-anchor.svg`,
      mapAsset: `${EARTH_STYLE_ROOT}/scanner/earth/style-anchor.svg`,
      visualRole: 'map-ready',
      location: 'earth',
      mapScale: 1.5,
      notes: 'Eigenes Antennen-/Schuessel-Asset auf Mast.',
    },
    moon: {
      styleAnchorAsset: `${EARTH_STYLE_ROOT}/scanner/earth/style-anchor.svg`,
      mapAsset: `${EARTH_STYLE_ROOT}/scanner/earth/style-anchor.svg`,
      visualRole: 'map-ready',
      location: 'moon',
      mapScale: 1.5,
      notes: 'Mond-Scanner leiht sich bis auf Weiteres das Earth-Scanner-Asset.',
    },
  },
  mine: {
    moon: {
      styleAnchorAsset: `${EARTH_STYLE_ROOT}/mine/moon/style-anchor.svg`,
      mapAsset: `${EARTH_STYLE_ROOT}/mine/moon/style-anchor.svg`,
      visualRole: 'map-ready',
      location: 'moon',
      mapScale: 1.9,
      notes: 'Eigenes Foerderturm-/Grube-Asset fuer den Regolith-/Erzabbau.',
    },
  },
  ice_drill: {
    moon: {
      styleAnchorAsset: `${EARTH_STYLE_ROOT}/ice_drill/moon/style-anchor.svg`,
      mapAsset: `${EARTH_STYLE_ROOT}/ice_drill/moon/style-anchor.svg`,
      visualRole: 'map-ready',
      location: 'moon',
      mapScale: 1.7,
      notes: 'Eigenes Eisbohrer-Asset fuer die Wassergewinnung an Schattenkratern.',
    },
  },
  shipyard: {
    moon: {
      styleAnchorAsset: `${EARTH_STYLE_ROOT}/spaceport_service/earth/style-anchor.svg`,
      mapAsset: `${EARTH_STYLE_ROOT}/spaceport_service/earth/style-anchor.svg`,
      visualRole: 'map-ready',
      location: 'moon',
      mapScale: 1.9,
      notes: 'Mond-Shipyard leiht sich das Hangar-Asset des Erd-Raumhafen-Service.',
    },
  },
  landing_pad: {
    moon: {
      styleAnchorAsset: `${EARTH_STYLE_ROOT}/spaceport_pad/earth/style-anchor.svg`,
      mapAsset: `${EARTH_STYLE_ROOT}/spaceport_pad/earth/style-anchor.svg`,
      visualRole: 'map-ready',
      location: 'moon',
      mapScale: 2.2,
      notes: 'Mond-Landepad leiht sich dasselbe Landepad-Asset wie die Erde.',
    },
  },
  landing_pad_moon: {
    moon: {
      styleAnchorAsset: `${EARTH_STYLE_ROOT}/spaceport_pad/earth/style-anchor.svg`,
      mapAsset: `${EARTH_STYLE_ROOT}/spaceport_pad/earth/style-anchor.svg`,
      visualRole: 'map-ready',
      location: 'moon',
      mapScale: 2.15,
      notes: 'Shackleton Lande- und Cargo-Zone nutzt das vorhandene Landepad-Asset.',
    },
  },
  school: {
    moon: {
      styleAnchorAsset: `${EARTH_STYLE_ROOT}/laboratory/earth/style-anchor.svg`,
      mapAsset: `${EARTH_STYLE_ROOT}/laboratory/earth/style-anchor.svg`,
      visualRole: 'map-ready',
      location: 'moon',
      mapScale: 1.6,
      notes: 'Mond-Schule leiht vorerst das Labor-Asset, bis ein eigenes existiert.',
    },
  },
}

export function getBuildingVisual(buildingId: string, location: string) {
  return BUILDING_VISUALS[buildingId]?.[location] ?? null
}
