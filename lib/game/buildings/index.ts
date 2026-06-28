// lib/game/buildings/index.ts
// Erstellt:     22.06.2026
// Aktualisiert: 28.06.2026 — PRODUCES_COMPAT nutzt ResourceType statt alter 3er-Union
// Version:      1.2.1

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
