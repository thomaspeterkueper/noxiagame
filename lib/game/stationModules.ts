// lib/game/stationModules.ts
// NOXIA-owned gameplay definitions for station modules.
// Technical/canonical truth remains external; gameplay costs, production and
// build times remain NOXIA-owned.

export type StationModuleDef = {
  id: string
  label: string
  icon: string
  color: string
  description: string
  produces?: { resource: string; amount: number }
  cost: number
  buildTicks: number
  planned?: boolean
}

export const STATION_MODULE_DEFS: Readonly<Record<string, StationModuleDef>> = {
  command_center:  { id: 'command_center', label: 'Kommandozentrum', icon: '🎯', color: '#c9a961', description: 'Koordiniert alle Stationssysteme. Pflichtmodul.', cost: 0, buildTicks: 0 },
  solar_array:     { id: 'solar_array', label: 'Solar-Array', icon: '☀️', color: '#f5d742', description: '+8 Energie/Tick. Nutzlos im Schatten.', produces: { resource: 'energy', amount: 8 }, cost: 1800, buildTicks: 2 },
  docking_bay:     { id: 'docking_bay', label: 'Andockbucht', icon: '🚀', color: '#7c8590', description: 'Erlaubt Schiffstransfers und Ladeoperationen.', cost: 2200, buildTicks: 3 },
  habitat_module:  { id: 'habitat_module', label: 'Wohnmodul', icon: '🏠', color: '#4a7ba3', description: '+50 maximale Besatzung.', cost: 2000, buildTicks: 3 },
  research_lab:    { id: 'research_lab', label: 'Forschungslabor', icon: '🔬', color: '#b48ce8', description: 'Wissenspunkte für die Besatzung.', cost: 3000, buildTicks: 4 },
  water_recycler:  { id: 'water_recycler', label: 'Wasserrecycler', icon: '💧', color: '#2f86c9', description: '+3 Wasser/Tick durch Kreislaufwirtschaft.', produces: { resource: 'water', amount: 3 }, cost: 2500, buildTicks: 3 },
  storage_bay:     { id: 'storage_bay', label: 'Lagerbay', icon: '📦', color: '#8a7a4a', description: '+200t Lagerkapazität für alle Ressourcen.', cost: 1500, buildTicks: 2 },
  observatory:     { id: 'observatory', label: 'Observatorium', icon: '🔭', color: '#7fb8de', description: 'Erweitert die Orbital-Sicht. Narrative Funktion.', cost: 2800, buildTicks: 4 },
  reactor:         { id: 'reactor', label: 'Fusionsreaktor', icon: '⚛️', color: '#ff6b6b', description: '+20 Energie/Tick. Fortgeschrittene Technologie.', produces: { resource: 'energy', amount: 20 }, cost: 8000, buildTicks: 6 },
}

export const BUILDABLE_STATION_MODULES = Object.entries(STATION_MODULE_DEFS)
  .filter(([id]) => id !== 'command_center')
