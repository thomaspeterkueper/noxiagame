export interface BuildingVisualProfile {
  styleAnchorAsset?: string
  mapAsset?: string
  visualRole: 'style-anchor' | 'map-ready'
  location: string
  mapScale?: number
  notes?: string
}

const EARTH_STYLE_ROOT = '/assets/buildings'

function profile(asset: string, location: string, mapScale: number, notes: string): BuildingVisualProfile {
  return {
    styleAnchorAsset: `${EARTH_STYLE_ROOT}/${asset}`,
    mapAsset: `${EARTH_STYLE_ROOT}/${asset}`,
    visualRole: 'map-ready',
    location,
    mapScale,
    notes,
  }
}

// Building visuals are location-aware so shared gameplay types can deliberately
// reuse an asset or use a body-specific one without changing the entity id.
export const BUILDING_VISUALS: Record<string, Record<string, BuildingVisualProfile>> = {
  habitat: {
    earth: profile('habitat/earth/style-anchor.svg', 'earth', 1.65, 'NOXIA Earth Core V1 style anchor: compact residential/operations building.'),
    moon: profile('habitat/moon/style-anchor.svg', 'moon', 1.7, 'Eigenes Habitat-Asset: halb im Regolith vergrabener Zylinder mit Abdeckwall und warmem Fensterlicht.'),
    phobos: profile('habitat/phobos/style-anchor.svg', 'phobos', 1.7, 'Eigene Phobos-Bildsprache: dunkles kohlenstoffreiches Regolith, Habitat per Ankerseilen an Bodenbolzen gesichert (Mikrogravitation).'),
  },
  residential_block: {
    earth: profile('habitat/earth/style-anchor.svg', 'earth', 1.85, 'Earth residential block currently reuses the habitat visual language until its own anchor exists.'),
  },
  laboratory: {
    earth: profile('laboratory/earth/style-anchor.svg', 'earth', 1.7, 'NOXIA Earth Core V1 research/analysis building.'),
    moon: profile('laboratory/earth/style-anchor.svg', 'moon', 1.7, 'Mond-Labor leiht sich bis auf Weiteres das Earth-Labor-Asset.'),
  },
  warehouse: {
    earth: profile('warehouse/earth/style-anchor.svg', 'earth', 1.85, 'NOXIA Earth Core V1 warehouse/logistics hall.'),
    moon: profile('warehouse/moon/style-anchor.svg', 'moon', 1.85, 'Eigenes Lager-Asset: niedriger regolith-uebererdeter Tonnengewoelbe-Bunker mit Aussenpaletten und Schleuse.'),
    phobos: profile('warehouse/phobos/style-anchor.svg', 'phobos', 1.85, 'Phobos-Lager: dunkles Regolith, Tonnengewoelbe zusaetzlich per Ankerseilen an der Firstlinie gesichert.'),
  },
  admin: {
    earth: profile('admin/earth/style-anchor.svg', 'earth', 1.7, 'Simple blue-gray Earth administration asset for placement and gameplay testing.'),
    moon: profile('admin/earth/style-anchor.svg', 'moon', 1.7, 'Mond-Verwaltung leiht sich bis auf Weiteres das Earth-Admin-Asset.'),
  },
  workshop: {
    earth: profile('workshop/earth/style-anchor.svg', 'earth', 1.8, 'NOXIA Earth Core V1 workshop/light-production hall.'),
    moon: profile('workshop/earth/style-anchor.svg', 'moon', 1.8, 'Mond-Werkstatt verwendet dieselbe Werkstatt-Sprache wie die Erde.'),
  },
  surface_workshop: {
    moon: profile('surface_workshop/moon/style-anchor.svg', 'moon', 1.7, 'Eigenes Werkstatt-Asset fuer die Mondoberflaeche (Regolith-Palette, oranger Funktionsakzent fuer Wartung/Fertigung).'),
    phobos: profile('surface_workshop/phobos/style-anchor.svg', 'phobos', 1.7, 'Phobos-Werkstatt: dunkles Regolith, oranger Funktionsakzent, per Ankerseilen gesichert.'),
  },
  factory: {
    earth: profile('workshop/earth/style-anchor.svg', 'earth', 1.95, 'Factory uses the Earth workshop visual as an interim production-building anchor.'),
  },
  solar: {
    earth: profile('solar/earth/style-anchor.svg', 'earth', 1.95, 'Test-first Earth solar field: deliberately blue/anthracite for immediate map readability.'),
    moon: profile('solar/moon/style-anchor.svg', 'moon', 1.85, 'Eigenes Energieturm-Asset: hoher Mast mit geneigtem Panel fuer die tief stehende Suedpol-Sonne.'),
    phobos: profile('solar/phobos/style-anchor.svg', 'phobos', 1.75, 'Phobos-Energieturm: schlanker Mast mit geneigtem Panel, per Ankerseilen an drei Bodenbolzen gesichert (Mikrogravitation).'),
  },
  battery_storage: {
    moon: profile('battery_storage/moon/style-anchor.svg', 'moon', 1.5, 'Eigenes Batteriespeicher-Asset (Zellenreihe, Bernstein-Funktionsakzent fuer Energie).'),
    phobos: profile('battery_storage/phobos/style-anchor.svg', 'phobos', 1.5, 'Phobos-Batteriespeicher: dunkles Regolith, Bernstein-Funktionsakzent, per Ankerseilen gesichert.'),
  },
  life_support_hub: {
    moon: profile('life_support_hub/moon/style-anchor.svg', 'moon', 1.6, 'Eigenes ECLSS-Asset (Kuppel-Aufbau, tuerkiser Funktionsakzent fuer Lebenserhaltung).'),
    phobos: profile('life_support_hub/phobos/style-anchor.svg', 'phobos', 1.6, 'Phobos-ECLSS: dunkles Regolith, tuerkiser Funktionsakzent, per Ankerseilen gesichert.'),
  },
  rover_yard: {
    moon: profile('rover_yard/moon/style-anchor.svg', 'moon', 1.55, 'Eigenes Roverhof-Asset (Landepad-Schema plus Rover-Silhouette, gruener Funktionsakzent fuer Mobilitaet/Logistik).'),
    phobos: profile('rover_yard/phobos/style-anchor.svg', 'phobos', 1.55, 'Phobos-Fahrzeughof: Fahrzeug zusaetzlich per Ankerseilen gesichert, gruener Funktionsakzent fuer Mobilitaet/Logistik.'),
  },
  surface_comms: {
    moon: profile('scanner/earth/style-anchor.svg', 'moon', 1.45, 'Kommunikationsmast verwendet das vorhandene Antennen-/Scanner-Asset.'),
    phobos: profile('surface_comms/phobos/style-anchor.svg', 'phobos', 1.5, 'Eigener Phobos-Kommunikationsmast: violetter Funktionsakzent fuer Kommunikation/Sensorik, per Ankerseilen gesichert.'),
  },
  landing_pad_phobos: {
    phobos: profile('landing_pad_phobos/phobos/style-anchor.svg', 'phobos', 2.1, 'Eigenes Andock-/Verankerungsfeld statt Landebahn: Ankerseile laufen sternfoermig zu einem zentralen Andockkragen (Mikrogravitation, keine klassische Landung).'),
  },
  ssf_headquarters_sundern: {
    earth: profile('ssf_headquarters_sundern/earth/style-anchor.svg', 'earth', 2.05, 'Unique 1971 SSF Foundation House at Bogenstraße 15: hipped-roof bungalow, detached garage along the long side, side entrance facing the garage.'),
  },
  spaceport_core: {
    earth: profile('spaceport_core/earth/style-anchor.svg', 'earth', 2.1, 'Eigenes Kontrollturm-Asset (hoher Baukoerper, Antenne).'),
  },
  spaceport_service: {
    earth: profile('spaceport_service/earth/style-anchor.svg', 'earth', 1.9, 'Eigenes Hangar-Asset (Rundbogendach, offenes Tor).'),
  },
  spaceport_storage: {
    earth: profile('spaceport_storage/earth/style-anchor.svg', 'earth', 1.85, 'Eigenes Tank-Cluster-Asset (Treibstoff-/Fracht-Zylinder).'),
  },
  spaceport_pad_standard: {
    earth: profile('spaceport_pad/earth/style-anchor.svg', 'earth', 2.4, 'Eigenes Landepad-Asset (Kreisflaeche, Zielkreuz, Eck-Lichter).'),
  },
  spaceport_pad_mini: {
    earth: profile('spaceport_pad/earth/style-anchor.svg', 'earth', 1.6, 'Eigenes Landepad-Asset, kleiner skaliert.'),
  },
  scanner: {
    earth: profile('scanner/earth/style-anchor.svg', 'earth', 1.5, 'Eigenes Antennen-/Schuessel-Asset auf Mast.'),
    moon: profile('scanner/earth/style-anchor.svg', 'moon', 1.5, 'Mond-Scanner leiht sich bis auf Weiteres das Earth-Scanner-Asset.'),
  },
  mine: {
    moon: profile('mine/moon/style-anchor.svg', 'moon', 1.9, 'Eigenes Foerderturm-/Grube-Asset fuer den Regolith-/Erzabbau.'),
  },
  ice_drill: {
    moon: profile('ice_drill/moon/style-anchor.svg', 'moon', 1.7, 'Eigenes Eisbohrer-Asset fuer die Wassergewinnung an Schattenkratern.'),
  },
  shipyard: {
    moon: profile('spaceport_service/earth/style-anchor.svg', 'moon', 1.9, 'Mond-Shipyard leiht sich das Hangar-Asset des Erd-Raumhafen-Service.'),
  },
  landing_pad: {
    moon: profile('spaceport_pad/earth/style-anchor.svg', 'moon', 2.2, 'Mond-Landepad leiht sich dasselbe Landepad-Asset wie die Erde.'),
  },
  landing_pad_moon: {
    moon: profile('spaceport_pad/earth/style-anchor.svg', 'moon', 2.15, 'Shackleton Lande- und Cargo-Zone nutzt das vorhandene Landepad-Asset.'),
  },
  school: {
    moon: profile('laboratory/earth/style-anchor.svg', 'moon', 1.6, 'Mond-Schule leiht vorerst das Labor-Asset, bis ein eigenes existiert.'),
  },
}

export function getBuildingVisual(buildingId: string, location: string) {
  return BUILDING_VISUALS[buildingId]?.[location] ?? null
}
