// lib/game/seeds/shackletonBaseAlphaSeed.ts
// Kanonischer NOXIA-Blueprint fuer die erste spielbare Shackleton-Basis.
//
// Koordinaten liegen ausschliesslich im bestehenden lokalen ENU-Frame der
// Mondoberflaeche: +x = Ost, +y = Nord, Ursprung = verifizierter Shackleton-
// Frame. Diese Datei erfindet weder ein zweites Mond-Koordinatensystem noch
// Engineering-Leistungsdaten.
//
// Die Basiskonfiguration ist bewusst kompakt genug fuer den aktuell geladenen
// LOLA-Nahbereich. Das Warenhaus liegt zwischen Lande-/Cargo-Zone, Werkstatt
// und Druckkern und ist der primaere lokale Logistik-Uebergabepunkt.

export const SHACKLETON_BASE_ALPHA_ID = 'shackleton_base_alpha'
export const SHACKLETON_BASE_ALPHA_FRAME = 'moon_shackleton_enu_v1'

export type ShackletonStarterZone =
  | 'core'
  | 'utilities'
  | 'logistics'
  | 'mobility'
  | 'landing'

export type ShackletonStarterRole =
  | 'habitat'
  | 'life-support'
  | 'power-generation'
  | 'power-storage'
  | 'warehouse'
  | 'workshop'
  | 'rover-yard'
  | 'communications'
  | 'landing-cargo'

export interface ShackletonStarterNode {
  id: string
  role: ShackletonStarterRole
  label: string
  zone: ShackletonStarterZone
  xM: number
  yM: number
  rotationDeg: number
  critical: boolean
  /** Existing catalogue id where NOXIA already has a matching gameplay object. */
  catalogEntityId?: string
  purpose: string
}

export type ShackletonLogisticsFlow =
  | 'incoming-cargo'
  | 'construction-supply'
  | 'maintenance-supply'
  | 'local-distribution'
  | 'surface-to-orbit'

export interface ShackletonLogisticsEdge {
  from: string
  to: string
  flow: ShackletonLogisticsFlow
  /** Relative prepared corridor only; route physics remain in moonSurfaceLogistics. */
  corridor: 'prepared-track' | 'hardened-road'
}

export const SHACKLETON_BASE_ALPHA_NODES: readonly ShackletonStarterNode[] = [
  {
    id: 'alpha_habitat_1',
    role: 'habitat',
    label: 'Habitat Alpha',
    zone: 'core',
    xM: -95,
    yM: 55,
    rotationDeg: 12,
    critical: true,
    catalogEntityId: 'habitat',
    purpose: 'Erster druckbeaufschlagter Wohn- und Aufenthaltskern der Shackleton-Basis.',
  },
  {
    id: 'alpha_life_support_1',
    role: 'life-support',
    label: 'Lebenserhaltung Alpha',
    zone: 'core',
    xM: -35,
    yM: 55,
    rotationDeg: 12,
    critical: true,
    purpose: 'Lokaler ECLSS-Knoten fuer Atmosphaere, Wasser- und Abfallkreislauf; konkrete Engineering-Grenzen werden nicht hier definiert.',
  },
  {
    id: 'alpha_solar_1',
    role: 'power-generation',
    label: 'Solarfeld Alpha',
    zone: 'utilities',
    xM: -175,
    yM: 165,
    rotationDeg: 0,
    critical: true,
    catalogEntityId: 'solar',
    purpose: 'Erste lokale Stromerzeugung; Auslegung und Redundanz werden separat technisch validiert.',
  },
  {
    id: 'alpha_battery_1',
    role: 'power-storage',
    label: 'Batteriespeicher Alpha',
    zone: 'utilities',
    xM: -105,
    yM: 145,
    rotationDeg: 0,
    critical: true,
    purpose: 'Puffert die lokale Energieversorgung zwischen Erzeugung und kritischen Basisverbrauchern.',
  },
  {
    id: 'alpha_warehouse_1',
    role: 'warehouse',
    label: 'Warenhaus Alpha',
    zone: 'logistics',
    xM: 55,
    yM: -35,
    rotationDeg: 18,
    critical: true,
    catalogEntityId: 'warehouse',
    purpose: 'Primaerer Waren- und Materialknoten zwischen ankommender Fracht, Bauauftraegen, Werkstatt und lokaler Verteilung.',
  },
  {
    id: 'alpha_workshop_1',
    role: 'workshop',
    label: 'Werkstatt Alpha',
    zone: 'logistics',
    xM: -5,
    yM: -45,
    rotationDeg: 18,
    critical: false,
    purpose: 'Wartung, Reparatur und vorbereitende Fertigung direkt neben dem Warenhaus.',
  },
  {
    id: 'alpha_rover_yard_1',
    role: 'rover-yard',
    label: 'Roverhof Alpha',
    zone: 'mobility',
    xM: 80,
    yM: -115,
    rotationDeg: 18,
    critical: false,
    purpose: 'Abstell-, Lade-, Wartungs- und Umschlagbereich fuer lokale Surface-Fahrzeuge.',
  },
  {
    id: 'alpha_comms_1',
    role: 'communications',
    label: 'Kommunikationsmast Alpha',
    zone: 'utilities',
    xM: -10,
    yM: 155,
    rotationDeg: 0,
    critical: true,
    purpose: 'Lokaler Kommunikations- und Datenknoten; Reichweite und Funktechnik bleiben Engineering-Sache.',
  },
  {
    id: 'alpha_landing_cargo_1',
    role: 'landing-cargo',
    label: 'Lande- und Cargo-Zone Alpha',
    zone: 'landing',
    xM: 205,
    yM: -165,
    rotationDeg: 28,
    critical: true,
    purpose: 'Getrennter Ankunfts- und Frachtbereich mit direktem Schwerlastkorridor zum Warenhaus.',
  },
] as const

export const SHACKLETON_BASE_ALPHA_LOGISTICS: readonly ShackletonLogisticsEdge[] = [
  { from: 'alpha_landing_cargo_1', to: 'alpha_warehouse_1', flow: 'incoming-cargo', corridor: 'hardened-road' },
  { from: 'alpha_warehouse_1', to: 'alpha_workshop_1', flow: 'maintenance-supply', corridor: 'hardened-road' },
  { from: 'alpha_warehouse_1', to: 'alpha_habitat_1', flow: 'local-distribution', corridor: 'prepared-track' },
  { from: 'alpha_warehouse_1', to: 'alpha_life_support_1', flow: 'maintenance-supply', corridor: 'prepared-track' },
  { from: 'alpha_warehouse_1', to: 'alpha_rover_yard_1', flow: 'local-distribution', corridor: 'hardened-road' },
  { from: 'alpha_warehouse_1', to: 'alpha_landing_cargo_1', flow: 'surface-to-orbit', corridor: 'hardened-road' },
] as const

export const SHACKLETON_BASE_ALPHA_WAREHOUSE_ID = 'alpha_warehouse_1'

export function getShackletonStarterNode(id: string) {
  return SHACKLETON_BASE_ALPHA_NODES.find(node => node.id === id) ?? null
}

/**
 * The warehouse must remain a real logistics hub, not a decorative building:
 * every non-utility operational cluster has a direct defined warehouse flow.
 */
export function getWarehouseFlows() {
  return SHACKLETON_BASE_ALPHA_LOGISTICS.filter(edge =>
    edge.from === SHACKLETON_BASE_ALPHA_WAREHOUSE_ID || edge.to === SHACKLETON_BASE_ALPHA_WAREHOUSE_ID,
  )
}
