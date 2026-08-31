// lib/game/buildings/marsTech.ts
// Erstellt: 31.08.2026 — spielbare Mars-Habitat-Teilsysteme

import type { BuildingDef } from './types'

export const MARS_TECH_BUILDINGS: Record<string, BuildingDef> = {
  pressure_cabin: {
    id: 'pressure_cabin',
    name: 'Druckkabine',
    category: 'infrastructure',
    description: 'Gasdichter kontrollierter Druckraum · Basismodul für Mars-Habitate',
    cost: 2800,
    buildTimeTicks: 3,
    allowedLocations: ['mars'],
  },
  airlock: {
    id: 'airlock',
    name: 'Luftschleuse',
    category: 'infrastructure',
    description: 'Kontrollierter Transfer zwischen Habitat und Marsatmosphäre',
    cost: 2200,
    buildTimeTicks: 2,
    allowedLocations: ['mars'],
  },
  life_support: {
    id: 'life_support',
    name: 'Lebenserhaltungsmodul',
    category: 'infrastructure',
    description: 'O₂-Versorgung · CO₂-Abscheidung · Luftumwälzung',
    cost: 4200,
    buildTimeTicks: 4,
    allowedLocations: ['mars'],
  },
  thermal_control: {
    id: 'thermal_control',
    name: 'Thermisches Kontrollsystem',
    category: 'infrastructure',
    description: 'Isolation · Heizen · Kühlen · Wärmetransport',
    cost: 3200,
    buildTimeTicks: 3,
    allowedLocations: ['mars'],
  },
  radiation_shelter: {
    id: 'radiation_shelter',
    name: 'Strahlenschutzbereich',
    category: 'infrastructure',
    description: 'Geschützter Aufenthaltsbereich gegen ionisierende Strahlung',
    cost: 3600,
    buildTimeTicks: 4,
    allowedLocations: ['mars'],
  },
  environment_monitor: {
    id: 'environment_monitor',
    name: 'Habitat-Umweltsensorik',
    category: 'infrastructure',
    description: 'Überwacht Druck, Atmosphäre, Temperatur und weitere kritische Habitatparameter',
    cost: 1800,
    buildTimeTicks: 2,
    allowedLocations: ['mars'],
  },
  habitat_redundancy: {
    id: 'habitat_redundancy',
    name: 'Redundante Habitatversorgung',
    category: 'infrastructure',
    description: 'Fehlertolerante Reservepfade für kritische Habitatfunktionen',
    cost: 5000,
    buildTimeTicks: 5,
    allowedLocations: ['mars'],
  },
}
