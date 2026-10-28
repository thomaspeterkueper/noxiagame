export type BuildingEntryKind =
  | 'academy'
  | 'warehouse'
  | 'spaceport'
  | 'administration'
  | 'job_agency'
  | 'bank'
  | 'shipyard'
  | 'research'
  | 'production'
  | 'residents'
  | 'foundation'
  | 'hospitality'

export type BuildingEntryDefinition = {
  kind: BuildingEntryKind
  label: string
  hint: string
}

export type BuildingEntryRequest = {
  entityId: string
  buildingTypeId: string
  buildingName: string
  kind: BuildingEntryKind
}

const ENTRY_BY_BUILDING: Readonly<Record<string, BuildingEntryDefinition>> = {
  school: {
    kind: 'academy',
    label: 'Akademie betreten',
    hint: 'Schulungen, Aufgaben und SSF-Lernmodule öffnen',
  },
  warehouse: {
    kind: 'warehouse',
    label: 'Warenhaus betreten',
    hint: 'Handel, Marktpreise und Aufträge öffnen',
  },
  cafe: {
    kind: 'hospitality',
    label: 'Café betreten',
    hint: 'Innenraum, Begegnungen und Aufenthalt öffnen',
  },
  café: {
    kind: 'hospitality',
    label: 'Café betreten',
    hint: 'Innenraum, Begegnungen und Aufenthalt öffnen',
  },
  bar: {
    kind: 'hospitality',
    label: 'Bar betreten',
    hint: 'Innenraum, Begegnungen und Aufenthalt öffnen',
  },
  nightclub: {
    kind: 'hospitality',
    label: 'Nachtclub betreten',
    hint: 'Tanzfläche, Tresen und Begegnungen – nachts geöffnet',
  },
  restaurant: {
    kind: 'hospitality',
    label: 'Restaurant betreten',
    hint: 'Innenraum, Begegnungen und Aufenthalt öffnen',
  },
  hotel: {
    kind: 'hospitality',
    label: 'Hotel betreten',
    hint: 'Lobby, Empfang und Zimmer öffnen',
  },
  // Gekauftes reales Haus (R-13): im Umbau eine Baustelle, sonst ein leeres Haus.
  acquired_building: {
    kind: 'hospitality',
    label: 'Haus betreten',
    hint: 'Gekauftes Haus – Baustelle oder leer, bis der Umbau fertig ist',
  },
  warehouse_storage: {
    kind: 'warehouse',
    label: 'Lager betreten',
    hint: 'Fracht, Handel und Aufträge öffnen',
  },
  admin: {
    kind: 'administration',
    label: 'Verwaltung betreten',
    hint: 'Versorgung, Bevölkerung, Aufträge und Koloniefinanzen öffnen',
  },
  job_agency: {
    kind: 'job_agency',
    label: 'Agentur für Arbeit betreten',
    hint: 'Freie Stellen im Ort und Vermittlung',
  },
  bank: {
    kind: 'bank',
    label: 'Bank betreten',
    hint: 'Konto, Einlagen, Kredite und Sicherheiten öffnen',
  },
  shipyard: {
    kind: 'shipyard',
    label: 'Werft betreten',
    hint: 'Schiff und verfügbare Werftfunktionen öffnen',
  },
  laboratory: {
    kind: 'research',
    label: 'Labor betreten',
    hint: 'Wissens- und Forschungszugänge öffnen',
  },
  scanner: {
    kind: 'research',
    label: 'Scannerstation betreten',
    hint: 'Analyse, Scanner und Wissenszugänge öffnen',
  },
  factory: {
    kind: 'production',
    label: 'Fabrik betreten',
    hint: 'Produktions- und Versorgungsdaten öffnen',
  },
  habitat: {
    kind: 'residents',
    label: 'Habitat betreten',
    hint: 'Bewohner- und Versorgungsdaten öffnen',
  },
  residential_block: {
    kind: 'residents',
    label: 'Wohnblock betreten',
    hint: 'Bewohner- und Versorgungsdaten öffnen',
  },
  ssf_headquarters_sundern: {
    kind: 'foundation',
    label: 'SSF-Hauptsitz betreten',
    hint: 'Solar Science Foundation, Lernen und Projekte öffnen',
  },
  spaceport_core: {
    kind: 'spaceport',
    label: 'Raumhafen betreten',
    hint: 'Abflug, Navigation, Wartung und Fracht öffnen',
  },
  spaceport_pad_mini: {
    kind: 'spaceport',
    label: 'Mini-Pad betreten',
    hint: 'Abflug, Navigation und Bodenabfertigung öffnen',
  },
  spaceport_pad_standard: {
    kind: 'spaceport',
    label: 'Standard-Pad betreten',
    hint: 'Abflug, Navigation und Bodenabfertigung öffnen',
  },
  spaceport_service: {
    kind: 'spaceport',
    label: 'Servicebereich betreten',
    hint: 'Wartung, Werft und Bodenservice öffnen',
  },
  spaceport_storage: {
    kind: 'spaceport',
    label: 'Raumhafen-Lager betreten',
    hint: 'Fracht, Handel und Logistik öffnen',
  },
  landing_pad: {
    kind: 'spaceport',
    label: 'Landeplatz betreten',
    hint: 'Abflug, Navigation und Bodenabfertigung öffnen',
  },
}

export function getBuildingEntryDefinition(buildingTypeId: string): BuildingEntryDefinition | null {
  return ENTRY_BY_BUILDING[buildingTypeId] ?? null
}
