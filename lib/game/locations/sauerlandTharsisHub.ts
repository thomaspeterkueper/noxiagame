// lib/game/locations/sauerlandTharsisHub.ts
// Kanonisches Standortmodell für den NOXIA-Einstieg auf der Erde.

export type EarthSiteZoneKind =
  | 'spaceport'
  | 'public-services'
  | 'logistics'
  | 'settlement'
  | 'forest'
  | 'agriculture'
  | 'water-corridor'
  | 'expansion'

export interface EarthSiteZone {
  id: string
  name: string
  kind: EarthSiteZoneKind
  rows: [number, number]
  cols: [number, number]
  gameplayRole: string
}

export interface EarthSiteLandmark {
  id: string
  name: string
  kind: 'ridge' | 'forest' | 'water' | 'settlement' | 'road' | 'facility'
  row: number
  col: number
  canonical: boolean
  visualPriority: 'high' | 'medium' | 'low'
  note: string
}

export const SAUERLAND_THARSIS_HUB = {
  id: 'tharsis_hub_sauerland',
  locationSlug: 'earth',
  displayName: 'Tharsis Hub Sauerland',
  shortName: 'Tharsis Hub',
  planet: 'Earth',
  country: 'Deutschland',
  state: 'Nordrhein-Westfalen',
  region: 'Sauerland',
  referenceMunicipality: 'Sundern (Sauerland)',
  anchorPrecision: 'regional' as const,
  exactCoordinates: null,
  mapModel: 'compressed-regional' as const,
  grid: { rows: 24, cols: 32 },
  terrainIdentity: [
    'bewaldete Mittelgebirgszüge',
    'enger Talraum mit Wasserlauf',
    'offene Wiesen- und Landwirtschaftsflächen',
    'kleinteiliger Siedlungsanschluss',
    'technisch stark ausgebauter Hub als bewusster Kontrast zur Landschaft',
  ],
  visualIdentity: {
    season: 'late-spring-to-early-autumn',
    palette: ['deep-forest-green', 'meadow-green', 'weathered-asphalt', 'light-concrete', 'steel-blue'],
    architecture: 'near-future-civil-industrial',
    brandingRule: 'noχ1ᐃ only on selected public/state hub buildings',
    atmosphere: 'bright-temperate-daylight',
  },
} as const

export const SAUERLAND_SITE_ZONES: EarthSiteZone[] = [
  {
    id: 'hub-core-zone',
    name: 'Tharsis Hub Kernzone',
    kind: 'spaceport',
    rows: [17, 21],
    cols: [25, 28],
    gameplayRole: 'gemeinsamer Spielerstart, Schiffsumschlag, öffentliche Orbital- und Raumfahrtlogistik',
  },
  {
    id: 'hub-public-services',
    name: 'Öffentliche Dienste',
    kind: 'public-services',
    rows: [21, 22],
    cols: [24, 28],
    gameplayRole: 'Verwaltung, Akademie, Orientierung und frühe Freischaltungen',
  },
  {
    id: 'hub-logistics',
    name: 'Logistikrand',
    kind: 'logistics',
    rows: [19, 23],
    cols: [27, 31],
    gameplayRole: 'Lager, Fracht, Fahrzeuge, spätere Cargo-Erweiterungen',
  },
  {
    id: 'sauerland-settlement',
    name: 'Siedlungsanschluss',
    kind: 'settlement',
    rows: [7, 10],
    cols: [26, 29],
    gameplayRole: 'sichtbarer Anschluss an eine bestehende bewohnte Region; kein isolierter Sci-Fi-Campus',
  },
  {
    id: 'sauerland-forest-west',
    name: 'Westlicher Waldgürtel',
    kind: 'forest',
    rows: [0, 15],
    cols: [0, 11],
    gameplayRole: 'landschaftliche Identität, Baugrenzen, spätere Forst-/Naturkonflikte',
  },
  {
    id: 'sauerland-valley-corridor',
    name: 'Tal- und Wasserlauf',
    kind: 'water-corridor',
    rows: [0, 23],
    cols: [10, 23],
    gameplayRole: 'Orientierungslinie der Karte und natürliche Trennung von Teilräumen',
  },
  {
    id: 'sauerland-agriculture',
    name: 'Offene Nutzflächen',
    kind: 'agriculture',
    rows: [4, 21],
    cols: [2, 20],
    gameplayRole: 'Landwert, Flächenkonkurrenz, zivile Versorgung und sichtbare Erdökonomie',
  },
]

export const SAUERLAND_LANDMARKS: EarthSiteLandmark[] = [
  {
    id: 'landmark-tharsis-hub',
    name: 'Tharsis Hub',
    kind: 'facility',
    row: 19,
    col: 26,
    canonical: true,
    visualPriority: 'high',
    note: 'dominanter technischer Fokuspunkt, aber eingebettet in bestehende Sauerland-Landschaft',
  },
  {
    id: 'landmark-valley-river',
    name: 'Tal-Wasserlauf',
    kind: 'water',
    row: 12,
    col: 16,
    canonical: true,
    visualPriority: 'high',
    note: 'durchgehende natürliche Achse; soll visuell als Bach/kleiner Fluss lesbar sein',
  },
  {
    id: 'landmark-forest-ridge',
    name: 'Bewaldeter Höhenzug',
    kind: 'ridge',
    row: 4,
    col: 4,
    canonical: true,
    visualPriority: 'high',
    note: 'typische Sauerland-Silhouette im Kartenhintergrund beziehungsweise oberen Kartenbereich',
  },
  {
    id: 'landmark-settlement-edge',
    name: 'Siedlungsrand',
    kind: 'settlement',
    row: 8,
    col: 28,
    canonical: true,
    visualPriority: 'medium',
    note: 'kleinteilige zivile Bebauung; der Hub steht nicht in einer leeren Wildnis',
  },
]

export const SAUERLAND_REQUIRED_VISUAL_ASSETS = [
  'tile_grass',
  'tile_grass_2',
  'tile_grass_rocky',
  'tile_forest_edge',
  'tile_forest_dense',
  'tile_farmland',
  'tile_city',
  'tile_concrete',
  'river',
  'road_0..road_15',
  'sauerland_hill_edge',
  'sauerland_hill_forest',
  'sauerland_stream_bank',
  'sauerland_meadow_edge',
  'sauerland_village_house_a',
  'sauerland_village_house_b',
  'sauerland_small_industrial',
  'sauerland_roadside_tree',
  'sauerland_guardrail',
  'sauerland_bus_stop',
  'sauerland_power_pole',
  'sauerland_signage_blank',
] as const
