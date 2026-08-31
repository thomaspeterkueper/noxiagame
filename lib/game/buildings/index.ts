// lib/game/buildings/index.ts
// Erstellt:     22.06.2026
// Aktualisiert: 30.08.2026 — Tharsis-Hub-Startobjekte (OTA-NOX-REQ-20260830)
// Version:      1.4.0

import type { BuildingDef, ResourceType } from './types'

export const BUILDINGS: Record<string, BuildingDef> = {

  mine: {
    id: 'mine', name: 'Mine', category: 'production',
    description: '+5 Metall/Tick',
    cost: 1500, buildTimeTicks: 2,
    produces: { resource: 'metal', amount: 5 },
  },

  solar: {
    id: 'solar', name: 'Solarfeld', category: 'production',
    description: '+4 Energie/Tick',
    cost: 1200, buildTimeTicks: 1,
    produces: { resource: 'energy', amount: 4 },
  },

  factory: {
    id: 'factory', name: 'Fabrik', category: 'production',
    description: 'Industrieproduktion · erste Produktionsketten',
    cost: 4500, buildTimeTicks: 4,
    allowedLocations: ['earth', 'mars'],
  },

  laboratory: {
    id: 'laboratory', name: 'Labor', category: 'service',
    description: 'Forschung · Analyse · technische Entwicklung',
    cost: 3800, buildTimeTicks: 3,
    allowedLocations: ['earth', 'moon', 'mars', 'prometheus'],
  },

  ice_drill: {
    id: 'ice_drill', name: 'Eisbohrung', category: 'production',
    description: '+4 Wasser/Tick — Shackleton-Eis',
    cost: 2500, buildTimeTicks: 3,
    produces: { resource: 'water', amount: 4 },
    allowedLocations: ['moon', 'mars'],
  },

  water_recycler: {
    id: 'water_recycler', name: 'Wasserrecycler', category: 'production',
    description: '+2 Wasser/Tick — Atmosphären-Kondensation',
    cost: 2000, buildTimeTicks: 2,
    produces: { resource: 'water', amount: 2 },
    allowedLocations: ['mars'],
    externalTechnicalObject: {
      sourceSystem: 'OTA',
      sourceDocumentId: 'DOC:OTA:OTA-TEC-0034-2026-DE',
      canonicalId: 'OTA-TEC-0034-WEX-M',
      objectId: 'wasserextraktor-mars-typ-m',
      mappingRole: 'buildable',
      evidenceImpactPolicy: 'signal-only',
    },
  },

  habitat: {
    id: 'habitat', name: 'Habitat', category: 'housing',
    description: '+25 max. Bevölkerung',
    cost: 2000, buildTimeTicks: 3,
    populationBonus: 25,
  },

  residential_block: {
    id: 'residential_block', name: 'Wohnblock', category: 'housing',
    description: '+75 max. Bevölkerung',
    cost: 3500, buildTimeTicks: 4,
    populationBonus: 75,
    allowedLocations: ['earth', 'mars'],
  },

  road: {
    id: 'road', name: 'Straße', category: 'infrastructure',
    description: 'Erschließt benachbarte Kacheln · Voraussetzung für Habitate',
    cost: 300, buildTimeTicks: 1,
  },

  school: {
    id: 'school', name: 'Akademie', category: 'service',
    description: 'Wissensaufgaben · Handbuch · Fortschritt',
    cost: 2500, buildTimeTicks: 2,
    overlay: 'SchoolOverlay',
  },

  bank: {
    id: 'bank', name: 'Bank', category: 'service',
    description: 'Einlagen (+0.5%/Tick) · Kredite · Kreditlimit wächst mit Sicherheiten',
    cost: 3000, buildTimeTicks: 2,
    overlay: 'BankOverlay',
  },

  scanner: {
    id: 'scanner', name: 'Scanner', category: 'infrastructure',
    description: 'Macht Anomalien der Kolonie sichtbar',
    cost: 1800, buildTimeTicks: 2,
  },

  warehouse: {
    id: 'warehouse', name: 'Warenhaus', category: 'infrastructure',
    description: 'Erhöht Lagerkapazität der Kolonie',
    cost: 3500, buildTimeTicks: 3,
    planned: true, planHint: 'Lagerkapazität — Alpha 0.3',
  },

  admin: {
    id: 'admin', name: 'Verwaltung', category: 'service',
    description: 'Kolonieverwaltung, Steuersätze, Statistiken',
    cost: 4000, buildTimeTicks: 3,
    overlay: 'AdminOverlay',
    planned: true, planHint: 'Kolonieverwaltung — Alpha 0.3',
  },

  smelter: {
    id: 'smelter', name: 'Schmelze', category: 'production',
    description: 'Metall → Bauteile (Produktionskette)',
    cost: 5000, buildTimeTicks: 4,
    planned: true, planHint: 'Produktionsketten — Alpha 0.3',
  },

  bar: {
    id: 'bar', name: 'Bar', category: 'service',
    description: 'Erhöht Zufriedenheit und Bevölkerungswachstum',
    cost: 1800, buildTimeTicks: 2,
    planned: true, planHint: 'Zufriedenheit — Alpha 0.4',
  },

  oxygen_recycler: {
    id: 'oxygen_recycler', name: 'O₂-Recycler', category: 'infrastructure',
    description: 'Lebenserhaltung — reduziert Ressourcenverbrauch',
    cost: 3000, buildTimeTicks: 3,
    planned: true, planHint: 'Lebenserhaltung — Alpha 0.4',
  },

  // ─────────────────────────────────────────────────────────────
  // Tharsis-Hub-Startkolonie (OTA-NOX-REQ-20260830-THARSIS-HUB-START-SEED)
  // NOXIA-eigene Balancingwerte; technische Redundanz-/Abhängigkeitsgrenzen
  // kommen aus OTA (OTA-TEC-0094-2026-DE bis OTA-TEC-0107-2026-DE).
  // Kanonische Seed-Stückzahlen/-Positionen: lib/game/seeds/tharsisHubSeed.ts
  // ─────────────────────────────────────────────────────────────

  habitat_cluster: {
    id: 'habitat_cluster', name: 'Habitatcluster', category: 'housing',
    description: '+84 max. Bevölkerung · zwei interne Druck-/Brandsegmente · Safe-Haven-/Storm-Shelter-Funktion · lokale ECLSS/Druck/Notabsperrung integriert',
    cost: 12000, buildTimeTicks: 12,
    populationBonus: 84,
    allowedLocations: ['mars'],
  },

  eclss_hub: {
    id: 'eclss_hub', name: 'Regionaler ECLSS-/Utility-Hub', category: 'infrastructure',
    description: 'Versorgt zwei Habitatcluster · degradierter Betrieb trägt kolonieweiten Mindest-O₂-/CO₂-Bedarf',
    cost: 9000, buildTimeTicks: 8,
    allowedLocations: ['mars'],
  },

  reactor_module: {
    id: 'reactor_module', name: 'Reaktormodul', category: 'production',
    description: '+8 Energie/Tick · Nennleistung ca. 1,25 MW · 2 Module je Energie-Komplex',
    cost: 12000, buildTimeTicks: 10,
    produces: { resource: 'energy', amount: 8 },
    allowedLocations: ['mars'],
  },

  black_start: {
    id: 'black_start', name: 'Black-Start-/Speicherknoten', category: 'infrastructure',
    description: 'Integrierter Schwarzstart- und Speicherknoten je Energie-Komplex',
    cost: 5000, buildTimeTicks: 4,
    allowedLocations: ['mars'],
  },

  water_isru: {
    id: 'water_isru', name: 'Wasser-ISRU-/Aufbereitungskomplex', category: 'production',
    description: '+3 Wasser/Tick · eigener Roh-/Prozesswasserpuffer (8 t)',
    cost: 9000, buildTimeTicks: 8,
    produces: { resource: 'water', amount: 3 },
    allowedLocations: ['mars'],
  },

  radiator_field: {
    id: 'radiator_field', name: 'Radiatorfeld', category: 'infrastructure',
    description: 'Thermische Abstrahlung · Staubdegradation/Reinigung/Feldisolation abbildbar',
    cost: 2500, buildTimeTicks: 3,
    allowedLocations: ['mars'],
  },

  medical_core: {
    id: 'medical_core', name: 'Medical-Core-Komplex', category: 'service',
    description: 'Zwei getrennte klinische Zellen · zwei unabhängige Medienzuführungen',
    cost: 8000, buildTimeTicks: 6,
    allowedLocations: ['mars'],
  },

  medical_annex: {
    id: 'medical_annex', name: 'Emergency Medical Annex', category: 'service',
    description: 'Stabilisierung bei Isolation/Ausfall des Hauptkerns · anderer Habitatcluster',
    cost: 3500, buildTimeTicks: 4,
    allowedLocations: ['mars'],
  },

  reserve_depot: {
    id: 'reserve_depot', name: 'Strategisches Reserve-Depot', category: 'infrastructure',
    description: 'Lagerfähige 30-Tage-Reserve · intern getrennte Zonen (Lebensmittel/Medizin/Technik)',
    cost: 4000, buildTimeTicks: 4,
    allowedLocations: ['mars'],
  },

  plant_module: {
    id: 'plant_module', name: 'Frischproduktions-/Pflanzenmodul', category: 'production',
    description: 'Frische Produktion · im Startzustand nicht überlebenskritisch · keine Kalorienautarkie',
    cost: 3000, buildTimeTicks: 3,
    allowedLocations: ['mars'],
  },

  logistics_hub: {
    id: 'logistics_hub', name: 'Logistik-/Frachtumschlag-Hub', category: 'infrastructure',
    description: 'Grenze Außenbereich ↔ Drucksystem · eigene Staub-/Dekontaminationslinie',
    cost: 5500, buildTimeTicks: 5,
    allowedLocations: ['mars'],
  },

  workshop_clean: {
    id: 'workshop_clean', name: 'Werkstatt — Elektronik/Präzision/ECLSS', category: 'production',
    description: '+1 Bauteile/Tick · saubere Umgebung',
    cost: 3500, buildTimeTicks: 3,
    produces: { resource: 'components', amount: 1 },
    allowedLocations: ['mars'],
  },

  workshop_heavy: {
    id: 'workshop_heavy', name: 'Werkstatt — Mechanik/Fertigung/Bau', category: 'production',
    description: '+1 Bauteile/Tick · schwere Mechanik',
    cost: 4500, buildTimeTicks: 4,
    produces: { resource: 'components', amount: 1 },
    allowedLocations: ['mars'],
  },

  material_complex: {
    id: 'material_complex', name: 'Material-/Reststoff-Komplex', category: 'infrastructure',
    description: 'Nassstrom-Behandlungszug + Trocken-/Materialzelle · medizinischer Stoffpfad gekapselt',
    cost: 4500, buildTimeTicks: 4,
    allowedLocations: ['mars'],
  },

  command_node: {
    id: 'command_node', name: 'Command-&-Control-Knoten', category: 'infrastructure',
    description: 'Lokale Steuerung · kein alleiniger Master',
    cost: 6000, buildTimeTicks: 5,
    allowedLocations: ['mars'],
  },

  surface_relay: {
    id: 'surface_relay', name: 'Oberflächen-Relay-/Navigationspunkt', category: 'infrastructure',
    description: 'Lokale Funk-/Navigationsabdeckung',
    cost: 1500, buildTimeTicks: 2,
    allowedLocations: ['mars'],
  },

  longrange_comms: {
    id: 'longrange_comms', name: 'Langstrecken-Kommunikationsstation', category: 'infrastructure',
    description: 'Erde-/Orbit-Uplink · redundant ausgelegt',
    cost: 7000, buildTimeTicks: 6,
    allowedLocations: ['mars'],
  },

  landing_pad: {
    id: 'landing_pad', name: 'Landeplatz', category: 'infrastructure',
    description: 'Lande- und Frachtbereich mit direktem Schwerlastweg zum Logistik-Hub',
    cost: 4000, buildTimeTicks: 3,
    allowedLocations: ['mars'],
  },
}

export const BUILDABLE = Object.fromEntries(
  Object.entries(BUILDINGS).filter(([, b]) => !b.planned)
)

export const PLANNED = Object.fromEntries(
  Object.entries(BUILDINGS).filter(([, b]) => b.planned)
)

export const BUILDABLE_ITEMS_COMPAT = Object.fromEntries(
  Object.entries(BUILDABLE).map(([id, b]) => [id, {
    type:              'building' as const,
    name:              b.name,
    cost:              b.cost,
    buildTimeTicks:    b.buildTimeTicks,
    produces:          b.produces,
    populationBonus:   b.populationBonus,
    allowedLocations:  b.allowedLocations,
    description:       b.description,
  }])
)

export const BUILDING_NAMES_COMPAT: Record<string, string> = Object.fromEntries(
  Object.entries(BUILDINGS).map(([id, b]) => [id, b.name])
)

export const PRODUCES_COMPAT: Record<string, { resource: ResourceType; amount: number }> = Object.fromEntries(
  Object.entries(BUILDINGS)
    .filter(([, b]) => b.produces)
    .map(([id, b]) => [id, b.produces!])
)

export const PLANNED_BUILDINGS_COMPAT = Object.values(PLANNED).map(b => ({
  id:   b.id,
  name: b.name,
  hint: b.planHint ?? '',
}))
