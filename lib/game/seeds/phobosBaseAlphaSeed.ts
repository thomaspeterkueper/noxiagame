// lib/game/seeds/phobosBaseAlphaSeed.ts
// Kanonischer NOXIA-Blueprint fuer die erste spielbare Phobos-Basis.
//
// Koordinaten liegen im lokalen ENU-Frame des Phobos-Weltframes (siehe
// supabase/migrations/20260925090000_phobos_stickney_rim_world_seed.sql):
// +x = Ost, +y = Nord, Ursprung = Stickney-Nordrand (aus dem realen USGS-
// Gazetteer-Kraterzentrum plus dokumentiertem Radius-Offset abgeleitet).
//
// Phobos hat ~1/1000 g Oberflaechenschwerkraft. Gebaeude werden daher nicht
// als "stehende" Bauten interpretiert, sondern als am Regolith verankerte,
// mit Zug-/Ankerseilen gesicherte Module -- das treibt sowohl die eigene
// Bildsprache (siehe visuals.ts) als auch die knappere, dichtere Anordnung
// hier: kurze Seilverbindungen statt weitlaeufiger Fahrwege.

export const PHOBOS_BASE_ALPHA_ID = 'phobos_base_alpha'
export const PHOBOS_BASE_ALPHA_FRAME = 'phobos_stickney_rim_enu_v1'

export type PhobosStarterZone = 'core' | 'utilities' | 'logistics' | 'landing'

export type PhobosStarterRole =
  | 'habitat'
  | 'life-support'
  | 'power-generation'
  | 'power-storage'
  | 'warehouse'
  | 'workshop'
  | 'rover-yard'
  | 'communications'
  | 'landing-cargo'

export interface PhobosStarterNode {
  id: string
  role: PhobosStarterRole
  label: string
  zone: PhobosStarterZone
  xM: number
  yM: number
  rotationDeg: number
  critical: boolean
  catalogEntityId: string
  purpose: string
}

export type PhobosLogisticsFlow =
  | 'incoming-cargo'
  | 'construction-supply'
  | 'maintenance-supply'
  | 'local-distribution'
  | 'surface-to-orbit'

export interface PhobosLogisticsEdge {
  from: string
  to: string
  flow: PhobosLogisticsFlow
  /** Micro-gravity anchor tether instead of a driven road/track. */
  corridor: 'anchor-tether' | 'hardened-tether-road'
}

export const PHOBOS_BASE_ALPHA_NODES: readonly PhobosStarterNode[] = [
  { id: 'phobos_habitat_1', role: 'habitat', label: 'Habitat Stickney-1', zone: 'core', xM: -30, yM: 18, rotationDeg: 10, critical: true, catalogEntityId: 'habitat', purpose: 'Erster verankerter Wohn- und Aufenthaltskern am Stickney-Nordrand.' },
  { id: 'phobos_life_support_1', role: 'life-support', label: 'Lebenserhaltung Stickney-1', zone: 'core', xM: -6, yM: 16, rotationDeg: 10, critical: true, catalogEntityId: 'life_support_hub', purpose: 'Lokaler ECLSS-Knoten fuer die Stickney-Basis; Engineering-Grenzen bleiben separat.' },
  { id: 'phobos_solar_1', role: 'power-generation', label: 'Solarfeld Stickney-1', zone: 'utilities', xM: -58, yM: 46, rotationDeg: 0, critical: true, catalogEntityId: 'solar', purpose: 'Erste lokale Stromerzeugung; in Mikrogravitation zusaetzlich verankert statt nur aufgestellt.' },
  { id: 'phobos_battery_1', role: 'power-storage', label: 'Batteriespeicher Stickney-1', zone: 'utilities', xM: -34, yM: 38, rotationDeg: 4, critical: true, catalogEntityId: 'battery_storage', purpose: 'Puffert die lokale Energieversorgung zwischen Erzeugung und Basisverbrauchern.' },
  { id: 'phobos_warehouse_1', role: 'warehouse', label: 'Warenhaus Stickney-1', zone: 'logistics', xM: 22, yM: 2, rotationDeg: 14, critical: true, catalogEntityId: 'warehouse', purpose: 'Primaerer Waren- und Materialknoten zwischen Fracht, Werkstatt und Basis.' },
  { id: 'phobos_workshop_1', role: 'workshop', label: 'Werkstatt Stickney-1', zone: 'logistics', xM: 24, yM: -20, rotationDeg: 14, critical: false, catalogEntityId: 'surface_workshop', purpose: 'Wartung und Reparatur direkt neben dem Warenhaus.' },
  { id: 'phobos_rover_yard_1', role: 'rover-yard', label: 'Fahrzeughof Stickney-1', zone: 'logistics', xM: 48, yM: -26, rotationDeg: 14, critical: false, catalogEntityId: 'rover_yard', purpose: 'Verankerter Abstell- und Ladebereich fuer Oberflaechenfahrzeuge -- in Mikrogravitation zusaetzlich per Seil gesichert.' },
  { id: 'phobos_comms_1', role: 'communications', label: 'Kommunikationsmast Stickney-1', zone: 'utilities', xM: -10, yM: 50, rotationDeg: 0, critical: true, catalogEntityId: 'surface_comms', purpose: 'Lokaler Kommunikations- und Datenknoten; Sichtlinie zu Mars und Erde massgeblich.' },
  { id: 'phobos_landing_cargo_1', role: 'landing-cargo', label: 'Anlege- und Cargo-Zone Stickney-1', zone: 'landing', xM: 90, yM: -60, rotationDeg: 22, critical: true, catalogEntityId: 'landing_pad_phobos', purpose: 'Getrennte Ankunfts-/Frachtzone; wegen der Mikrogravitation ein Andock- und Verankerungsfeld statt einer klassischen Landebahn.' },
] as const

export const PHOBOS_BASE_ALPHA_LOGISTICS: readonly PhobosLogisticsEdge[] = [
  { from: 'phobos_landing_cargo_1', to: 'phobos_warehouse_1', flow: 'incoming-cargo', corridor: 'hardened-tether-road' },
  { from: 'phobos_warehouse_1', to: 'phobos_workshop_1', flow: 'maintenance-supply', corridor: 'hardened-tether-road' },
  { from: 'phobos_warehouse_1', to: 'phobos_habitat_1', flow: 'local-distribution', corridor: 'anchor-tether' },
  { from: 'phobos_habitat_1', to: 'phobos_life_support_1', flow: 'maintenance-supply', corridor: 'anchor-tether' },
  { from: 'phobos_workshop_1', to: 'phobos_rover_yard_1', flow: 'local-distribution', corridor: 'hardened-tether-road' },
  { from: 'phobos_warehouse_1', to: 'phobos_landing_cargo_1', flow: 'surface-to-orbit', corridor: 'hardened-tether-road' },
  { from: 'phobos_battery_1', to: 'phobos_habitat_1', flow: 'local-distribution', corridor: 'anchor-tether' },
  { from: 'phobos_solar_1', to: 'phobos_battery_1', flow: 'local-distribution', corridor: 'anchor-tether' },
  { from: 'phobos_comms_1', to: 'phobos_habitat_1', flow: 'local-distribution', corridor: 'anchor-tether' },
] as const

export const PHOBOS_BASE_ALPHA_WAREHOUSE_ID = 'phobos_warehouse_1'

export function getPhobosStarterNode(id: string) {
  return PHOBOS_BASE_ALPHA_NODES.find(node => node.id === id) ?? null
}

export function getPhobosWarehouseFlows() {
  return PHOBOS_BASE_ALPHA_LOGISTICS.filter(edge =>
    edge.from === PHOBOS_BASE_ALPHA_WAREHOUSE_ID || edge.to === PHOBOS_BASE_ALPHA_WAREHOUSE_ID,
  )
}
