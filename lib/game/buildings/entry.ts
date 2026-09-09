export type BuildingEntryKind = 'academy' | 'warehouse' | 'spaceport'

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
  warehouse_storage: {
    kind: 'warehouse',
    label: 'Lager betreten',
    hint: 'Fracht, Handel und Aufträge öffnen',
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
