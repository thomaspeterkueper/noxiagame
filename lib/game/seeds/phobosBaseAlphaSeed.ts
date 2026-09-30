// lib/game/seeds/phobosBaseAlphaSeed.ts
// Kanonischer NOXIA-Blueprint fuer die erste spielbare Phobos-Basis.
//
// Koordinaten liegen im lokalen ENU-Frame des Phobos-Weltframes (siehe
// supabase/migrations/20260925090000_phobos_stickney_rim_world_seed.sql):
// +x = Ost, +y = Nord, Ursprung = Stickney-Nordrand (aus dem realen USGS-
// Gazetteer-Kraterzentrum plus dokumentiertem Radius-Offset abgeleitet).
//
// Phobos hat ~1/1000 g Oberflaechenschwerkraft. Die Basis ist deshalb kein
// irdisches Strassenraster: Module liegen asymmetrisch in Funktionsarmen und
// werden ueber druckbeaufschlagte Korridore, Tether, Versorgungsumbilicals und
// einen getrennten Cargo-Transferpfad verbunden. Das Layout soll sich bereits
// an der Silhouette eindeutig von Mond-, Mars- und Erdbasen unterscheiden.

export const PHOBOS_BASE_ALPHA_ID = 'phobos_base_alpha'
export const PHOBOS_BASE_ALPHA_FRAME = 'phobos_stickney_rim_enu_v1'
export const PHOBOS_BASE_ALPHA_LAYOUT = 'stickney_asymmetric_tether_fan_v2'

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

export type PhobosConnectionKind =
  | 'pressurized-corridor'
  | 'tether-corridor'
  | 'cargo-transfer-link'
  | 'utility-umbilical'
  | 'anchor-line'

export interface PhobosLogisticsEdge {
  from: string
  to: string
  flow: PhobosLogisticsFlow
  corridor: PhobosConnectionKind
}

export const PHOBOS_BASE_ALPHA_NODES: readonly PhobosStarterNode[] = [
  { id: 'phobos_habitat_1', role: 'habitat', label: 'Habitat Stickney-1', zone: 'core', xM: -55, yM: 10, rotationDeg: 352, critical: true, catalogEntityId: 'habitat', purpose: 'Verankerter Wohn- und Aufenthaltskern am Stickney-Nordrand; bewusst nicht im geometrischen Zentrum der Gesamtbasis.' },
  { id: 'phobos_life_support_1', role: 'life-support', label: 'Lebenserhaltung Stickney-1', zone: 'core', xM: -22, yM: 28, rotationDeg: 18, critical: true, catalogEntityId: 'life_support_hub', purpose: 'ECLSS-Knoten in kurzer druckbeaufschlagter Distanz zum Habitat, aber als eigenes Modul getrennt.' },
  { id: 'phobos_solar_1', role: 'power-generation', label: 'Solarfeld Stickney-1', zone: 'utilities', xM: -132, yM: 88, rotationDeg: 338, critical: true, catalogEntityId: 'solar', purpose: 'Exponierter, verankerter Energiepunkt am nordwestlichen Utility-Arm.' },
  { id: 'phobos_battery_1', role: 'power-storage', label: 'Batteriespeicher Stickney-1', zone: 'utilities', xM: -78, yM: 58, rotationDeg: 348, critical: true, catalogEntityId: 'battery_storage', purpose: 'Pufferknoten zwischen Solarfeld und Kern; ueber Versorgungsumbilicals angebunden.' },
  { id: 'phobos_warehouse_1', role: 'warehouse', label: 'Warenhaus Stickney-1', zone: 'logistics', xM: 30, yM: -15, rotationDeg: 20, critical: true, catalogEntityId: 'warehouse', purpose: 'Primaerer Waren- und Materialknoten am Beginn des oestlichen Logistikarms.' },
  { id: 'phobos_workshop_1', role: 'workshop', label: 'Werkstatt Stickney-1', zone: 'logistics', xM: 72, yM: -47, rotationDeg: 33, critical: false, catalogEntityId: 'surface_workshop', purpose: 'Wartungsmodul entlang des Cargo-Arms; nicht mehr direkt auf dem Warenhaus gestapelt.' },
  { id: 'phobos_rover_yard_1', role: 'rover-yard', label: 'Fahrzeughof Stickney-1', zone: 'logistics', xM: 118, yM: -20, rotationDeg: 62, critical: false, catalogEntityId: 'rover_yard', purpose: 'Verankerter Abstell- und Ladepunkt fuer Oberflaechenfahrzeuge am aeusseren Logistikarm.' },
  { id: 'phobos_comms_1', role: 'communications', label: 'Kommunikationsmast Stickney-1', zone: 'utilities', xM: -6, yM: 108, rotationDeg: 8, critical: true, catalogEntityId: 'surface_comms', purpose: 'Freistehender Kommunikations- und Datenknoten mit Abstand zu den Kernmodulen.' },
  { id: 'phobos_landing_cargo_1', role: 'landing-cargo', label: 'Anlege- und Cargo-Zone Stickney-1', zone: 'landing', xM: 185, yM: -115, rotationDeg: 28, critical: true, catalogEntityId: 'landing_pad_phobos', purpose: 'Weit abgesetztes Andock- und Verankerungsfeld; Cargo gelangt ueber einen eigenen Transferlink zur Basis.' },
] as const

export const PHOBOS_BASE_ALPHA_LOGISTICS: readonly PhobosLogisticsEdge[] = [
  { from: 'phobos_landing_cargo_1', to: 'phobos_warehouse_1', flow: 'incoming-cargo', corridor: 'cargo-transfer-link' },
  { from: 'phobos_warehouse_1', to: 'phobos_workshop_1', flow: 'maintenance-supply', corridor: 'cargo-transfer-link' },
  { from: 'phobos_warehouse_1', to: 'phobos_habitat_1', flow: 'local-distribution', corridor: 'pressurized-corridor' },
  { from: 'phobos_habitat_1', to: 'phobos_life_support_1', flow: 'maintenance-supply', corridor: 'pressurized-corridor' },
  { from: 'phobos_workshop_1', to: 'phobos_rover_yard_1', flow: 'local-distribution', corridor: 'tether-corridor' },
  { from: 'phobos_warehouse_1', to: 'phobos_landing_cargo_1', flow: 'surface-to-orbit', corridor: 'cargo-transfer-link' },
  { from: 'phobos_battery_1', to: 'phobos_habitat_1', flow: 'local-distribution', corridor: 'utility-umbilical' },
  { from: 'phobos_solar_1', to: 'phobos_battery_1', flow: 'local-distribution', corridor: 'utility-umbilical' },
  { from: 'phobos_comms_1', to: 'phobos_habitat_1', flow: 'local-distribution', corridor: 'utility-umbilical' },
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
