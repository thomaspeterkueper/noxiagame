// lib/game/facilities/catalog.ts
// Erstellt: 01.09.2026
// Erste kanonische Moduldefinitionen. Zahlen mit balancingStatus='tuning'
// dürfen im Balancing geändert werden, ohne die räumliche Grundregel zu ändern.

import type { FacilityModuleDefinition } from './types'

const oneTile = [{ row: 0, col: 0 }] as const

export const FACILITY_MODULES: Record<string, FacilityModuleDefinition> = {
  spaceport_core: {
    id: 'spaceport_core',
    name: 'Raumhafen-Kern',
    facilityType: 'spaceport',
    role: 'core',
    description: 'Kontrolle, Abfertigung, Basisservice und Anschluss der Pad-Module.',
    footprint: [...oneTile],
    allowedLocations: ['earth', 'moon', 'mars', 'phobos'],
    capabilities: ['spaceport-control', 'dispatch', 'basic-service', 'module-connection'],
    buildable: true,
    balancingStatus: 'canonical',
  },

  spaceport_pad_mini: {
    id: 'spaceport_pad_mini',
    name: 'Mini-Pad',
    facilityType: 'spaceport',
    role: 'pad',
    description: 'Kompaktes Pad für kleine Außenposten mit integriertem Minilager und Basisservice.',
    footprint: [...oneTile],
    allowedLocations: ['earth', 'moon', 'mars', 'phobos'],
    requiresFacility: true,
    requiresAdjacentRole: ['core', 'service', 'pad'],
    capacity: {
      shipParking: 2,
      activeShipOperations: 1,
      shipClasses: ['small', 'standard'],
      storageUnits: 1,
    },
    capabilities: ['landing', 'launch', 'short-term-parking', 'mini-storage', 'basic-service'],
    buildable: true,
    balancingStatus: 'canonical',
  },

  spaceport_pad_standard: {
    id: 'spaceport_pad_standard',
    name: 'Standard-Pad',
    facilityType: 'spaceport',
    role: 'pad',
    description: 'Mehrplatz-Pad für regulären Raumhafenbetrieb; Betrieb und Parken sind getrennte Kapazitäten.',
    footprint: [...oneTile],
    allowedLocations: ['earth', 'moon', 'mars'],
    requiresFacility: true,
    requiresAdjacentRole: ['core', 'service', 'pad'],
    capacity: {
      shipParking: 4,
      activeShipOperations: 1,
      shipClasses: ['small', 'standard'],
    },
    capabilities: ['landing', 'launch', 'parking', 'turnaround'],
    buildable: true,
    balancingStatus: 'tuning',
  },

  spaceport_pad_cargo: {
    id: 'spaceport_pad_cargo',
    name: 'Cargo-Pad',
    facilityType: 'spaceport',
    role: 'cargo',
    description: 'Pad mit Schwerpunkt Frachtumschlag und direkter Logistikanbindung.',
    footprint: [...oneTile],
    allowedLocations: ['earth', 'moon', 'mars'],
    requiresFacility: true,
    requiresAdjacentRole: ['core', 'storage', 'service', 'pad', 'cargo'],
    capacity: {
      shipParking: 3,
      activeShipOperations: 1,
      shipClasses: ['small', 'standard'],
      storageUnits: 2,
    },
    capabilities: ['landing', 'launch', 'cargo-transfer', 'short-term-storage'],
    buildable: true,
    balancingStatus: 'tuning',
  },

  spaceport_pad_passenger: {
    id: 'spaceport_pad_passenger',
    name: 'Passagier-Pad',
    facilityType: 'spaceport',
    role: 'passenger',
    description: 'Pad für Passagierabfertigung mit Terminalanschluss.',
    footprint: [...oneTile],
    allowedLocations: ['earth', 'moon', 'mars'],
    requiresFacility: true,
    requiresAdjacentRole: ['core', 'passenger', 'service', 'pad'],
    capacity: {
      shipParking: 3,
      activeShipOperations: 1,
      shipClasses: ['small', 'standard'],
      passengerUnits: 2,
    },
    capabilities: ['landing', 'launch', 'passenger-transfer'],
    buildable: true,
    balancingStatus: 'tuning',
  },

  spaceport_pad_heavy: {
    id: 'spaceport_pad_heavy',
    name: 'Heavy-Pad',
    facilityType: 'spaceport',
    role: 'pad',
    description: 'Verstärktes Einzelpad für schwere Schiffe und hohe Bodenlasten.',
    footprint: [...oneTile],
    allowedLocations: ['earth', 'moon', 'mars'],
    requiresFacility: true,
    requiresAdjacentRole: ['core', 'service', 'cargo', 'pad'],
    capacity: {
      shipParking: 1,
      activeShipOperations: 1,
      shipClasses: ['heavy'],
    },
    capabilities: ['heavy-landing', 'heavy-launch', 'heavy-service'],
    buildable: true,
    balancingStatus: 'tuning',
  },

  spaceport_service: {
    id: 'spaceport_service',
    name: 'Raumhafen-Service',
    facilityType: 'spaceport',
    role: 'service',
    description: 'Wartung, Versorgung und technische Bodenabfertigung.',
    footprint: [...oneTile],
    requiresFacility: true,
    requiresAdjacentRole: ['core', 'pad', 'cargo', 'passenger'],
    capacity: {},
    capabilities: ['maintenance', 'refuelling-interface', 'ground-service'],
    buildable: true,
    balancingStatus: 'canonical',
  },

  spaceport_storage: {
    id: 'spaceport_storage',
    name: 'Raumhafen-Lager',
    facilityType: 'spaceport',
    role: 'storage',
    description: 'Frachtlager mit direkter Übergabe an Pad- und Logistikmodule.',
    footprint: [...oneTile],
    requiresFacility: true,
    requiresAdjacentRole: ['core', 'cargo', 'service', 'storage'],
    capacity: { storageUnits: 4 },
    capabilities: ['cargo-storage', 'cargo-buffer'],
    buildable: true,
    balancingStatus: 'tuning',
  },

  warehouse_core: {
    id: 'warehouse_core',
    name: 'Lager-Kern',
    facilityType: 'warehouse',
    role: 'core',
    description: 'Grundbetrieb eines Lagers mit Warenannahme und kleiner Lagerfläche.',
    footprint: [...oneTile],
    capacity: { storageUnits: 2 },
    capabilities: ['goods-receiving', 'storage'],
    buildable: true,
    balancingStatus: 'tuning',
  },

  warehouse_storage: {
    id: 'warehouse_storage',
    name: 'Lagerhalle',
    facilityType: 'warehouse',
    role: 'storage',
    description: 'Physische Erweiterung der Lagerkapazität auf einem Nachbartile.',
    footprint: [...oneTile],
    requiresFacility: true,
    requiresAdjacentRole: ['core', 'storage', 'cargo'],
    capacity: { storageUnits: 4 },
    capabilities: ['storage'],
    buildable: true,
    balancingStatus: 'tuning',
  },

  academy_core: {
    id: 'academy_core',
    name: 'Akademie-Kern',
    facilityType: 'education',
    role: 'core',
    description: 'Grundgebäude für Unterricht, Wissenszugang und Verwaltung.',
    footprint: [...oneTile],
    capabilities: ['education', 'knowledge-access'],
    buildable: true,
    balancingStatus: 'canonical',
  },

  academy_lab: {
    id: 'academy_lab',
    name: 'Akademie-Labor',
    facilityType: 'education',
    role: 'research',
    description: 'Praktisches Labor als räumliche Spezialisierung der Akademie.',
    footprint: [...oneTile],
    requiresFacility: true,
    requiresAdjacentRole: ['core', 'education', 'research'],
    capacity: { researchUnits: 1 },
    capabilities: ['laboratory', 'practical-education', 'research'],
    buildable: true,
    balancingStatus: 'tuning',
  },

  administration_core: {
    id: 'administration_core',
    name: 'Verwaltungs-Kern',
    facilityType: 'administration',
    role: 'core',
    description: 'Öffentliche Verwaltung und Services; auf der Erde staatliche Startinfrastruktur.',
    footprint: [...oneTile],
    capabilities: ['administration', 'public-service'],
    buildable: true,
    balancingStatus: 'canonical',
  },
}

export function getFacilityModuleDefinition(id: string): FacilityModuleDefinition | null {
  return FACILITY_MODULES[id] ?? null
}
