// lib/game/seeds/phobosBaseAlphaSeed.ts
// Kanonischer NOXIA-Blueprint fuer die erste spielbare Phobos-Basis.
//
// Koordinaten liegen im lokalen ENU-Frame des Phobos-Weltframes (siehe
// supabase/migrations/20260925090000_phobos_stickney_rim_world_seed.sql):
// +x = Ost, +y = Nord, Ursprung = Stickney-Nordrand (aus dem realen USGS-
// Gazetteer-Kraterzentrum plus dokumentiertem Radius-Offset abgeleitet).
//
// Phobos hat ~1/1000 g Oberflaechenschwerkraft. Die Basis ist deshalb kein
// irdisches Strassenraster: ein kleiner Druckkern, ein aufgefaecherter
// Utility-Bereich, ein separater Logistikcluster und ein weit abgesetztes Dock.
// Die Stationsmodule folgen trotzdem einem 20-m-Strukturraster und stehen
// ueberwiegend orthogonal. So bleibt die technische Lesbarkeit hoch, ohne aus
// Stickney eine irdische Siedlung zu machen.

import { assertSurfaceLayoutClearance, type SurfaceLayoutArchetype } from '@/lib/game/spatial/surfaceLayout'

export const PHOBOS_BASE_ALPHA_ID = 'phobos_base_alpha'
export const PHOBOS_BASE_ALPHA_FRAME = 'phobos_stickney_rim_enu_v1'
export const PHOBOS_BASE_ALPHA_LAYOUT: SurfaceLayoutArchetype = 'phobos-tether-cluster'
export const PHOBOS_BASE_ALPHA_LAYOUT_VARIANT = 'stickney_structural_grid_v4'
export const PHOBOS_BASE_ALPHA_MIN_CLEARANCE_M = 14
export const PHOBOS_BASE_ALPHA_GRID_M = 20

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
  footprintWidthM: number
  footprintDepthM: number
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

// Footprints mirror the canonical STATE modules currently persisted for Stickney.
// Positions snap to a 20 m structural grid; rotations are orthogonal except where
// a body-specific docking orientation is useful.
export const PHOBOS_BASE_ALPHA_NODES: readonly PhobosStarterNode[] = [
  { id: 'phobos_habitat_1', role: 'habitat', label: 'Habitat Stickney-1', zone: 'core', xM: 0, yM: 0, rotationDeg: 0, footprintWidthM: 26, footprintDepthM: 20, critical: true, catalogEntityId: 'habitat', purpose: 'Verankerter Wohn- und Aufenthaltskern; Ausgangspunkt des kurzen Druckkorridors zur Lebenserhaltung.' },
  { id: 'phobos_life_support_1', role: 'life-support', label: 'Lebenserhaltung Stickney-1', zone: 'core', xM: 40, yM: 0, rotationDeg: 0, footprintWidthM: 22, footprintDepthM: 22, critical: true, catalogEntityId: 'life_support_hub', purpose: 'ECLSS-Knoten in kurzer druckbeaufschlagter Distanz zum Habitat, aber als eigenes Modul mit freiem Sicherheitsraum.' },

  { id: 'phobos_solar_1', role: 'power-generation', label: 'Solarfeld Stickney-1', zone: 'utilities', xM: -120, yM: 100, rotationDeg: 0, footprintWidthM: 46, footprintDepthM: 32, critical: true, catalogEntityId: 'solar', purpose: 'Exponierter Energiepunkt des nordwestlichen Utility-Faechers.' },
  { id: 'phobos_battery_1', role: 'power-storage', label: 'Batteriespeicher Stickney-1', zone: 'utilities', xM: -60, yM: 60, rotationDeg: 0, footprintWidthM: 22, footprintDepthM: 22, critical: true, catalogEntityId: 'battery_storage', purpose: 'Pufferknoten zwischen Solarfeld und Kern; ueber leichte Versorgungsumbilicals angebunden.' },
  { id: 'phobos_comms_1', role: 'communications', label: 'Kommunikationsmast Stickney-1', zone: 'utilities', xM: -100, yM: -40, rotationDeg: 0, footprintWidthM: 16, footprintDepthM: 16, critical: true, catalogEntityId: 'surface_comms', purpose: 'Freistehender Datenknoten; bildet mit Solar und Batterie bewusst keinen linearen Strang, sondern einen Utility-Faecher.' },

  { id: 'phobos_warehouse_1', role: 'warehouse', label: 'Warenhaus Stickney-1', zone: 'logistics', xM: 80, yM: 60, rotationDeg: 0, footprintWidthM: 32, footprintDepthM: 26, critical: true, catalogEntityId: 'warehouse', purpose: 'Primaerer Materialknoten eines eigenstaendigen oestlichen Logistikclusters.' },
  { id: 'phobos_workshop_1', role: 'workshop', label: 'Werkstatt Stickney-1', zone: 'logistics', xM: 140, yM: 60, rotationDeg: 0, footprintWidthM: 28, footprintDepthM: 24, critical: false, catalogEntityId: 'surface_workshop', purpose: 'Wartungsmodul rasterparallel seitlich neben dem Warenhaus.' },
  { id: 'phobos_rover_yard_1', role: 'rover-yard', label: 'Fahrzeughof Stickney-1', zone: 'logistics', xM: 140, yM: 0, rotationDeg: 90, footprintWidthM: 34, footprintDepthM: 26, critical: false, catalogEntityId: 'rover_yard', purpose: 'Verankerter Robotik- und Fahrzeughof unterhalb des Logistikclusters.' },

  { id: 'phobos_landing_cargo_1', role: 'landing-cargo', label: 'Anlege- und Cargo-Zone Stickney-1', zone: 'landing', xM: 220, yM: -100, rotationDeg: 0, footprintWidthM: 70, footprintDepthM: 55, critical: true, catalogEntityId: 'landing_pad_phobos', purpose: 'Weit abgesetztes Andock- und Verankerungsfeld; kein Bestandteil des Stationskerns und nur ueber Cargo-/Tether-Verbindung angebunden.' },
] as const

assertSurfaceLayoutClearance(
  PHOBOS_BASE_ALPHA_NODES,
  PHOBOS_BASE_ALPHA_MIN_CLEARANCE_M,
  'Phobos Stickney structural-grid v4',
)

export const PHOBOS_BASE_ALPHA_LOGISTICS: readonly PhobosLogisticsEdge[] = [
  { from: 'phobos_habitat_1', to: 'phobos_life_support_1', flow: 'maintenance-supply', corridor: 'pressurized-corridor' },
  { from: 'phobos_habitat_1', to: 'phobos_warehouse_1', flow: 'local-distribution', corridor: 'tether-corridor' },

  { from: 'phobos_solar_1', to: 'phobos_battery_1', flow: 'local-distribution', corridor: 'utility-umbilical' },
  { from: 'phobos_battery_1', to: 'phobos_habitat_1', flow: 'local-distribution', corridor: 'utility-umbilical' },
  { from: 'phobos_comms_1', to: 'phobos_habitat_1', flow: 'local-distribution', corridor: 'anchor-line' },

  { from: 'phobos_warehouse_1', to: 'phobos_workshop_1', flow: 'maintenance-supply', corridor: 'cargo-transfer-link' },
  { from: 'phobos_workshop_1', to: 'phobos_rover_yard_1', flow: 'local-distribution', corridor: 'tether-corridor' },
  { from: 'phobos_landing_cargo_1', to: 'phobos_warehouse_1', flow: 'incoming-cargo', corridor: 'cargo-transfer-link' },
  { from: 'phobos_warehouse_1', to: 'phobos_landing_cargo_1', flow: 'surface-to-orbit', corridor: 'cargo-transfer-link' },
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
