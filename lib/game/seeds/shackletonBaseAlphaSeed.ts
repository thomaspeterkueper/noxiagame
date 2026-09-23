// lib/game/seeds/shackletonBaseAlphaSeed.ts
// Kanonischer NOXIA-Blueprint fuer die erste spielbare Shackleton-Basis.
//
// Koordinaten liegen ausschliesslich im bestehenden lokalen ENU-Frame der
// Mondoberflaeche: +x = Ost, +y = Nord, Ursprung = verifizierter Shackleton-
// Frame. Diese Datei erfindet weder ein zweites Mond-Koordinatensystem noch
// Engineering-Leistungsdaten.
//
// Die Startbasis ist als lesbare Siedlung organisiert: ein kompakter Druckkern,
// direkt anschliessende Logistik/Wartung, ein peripherer Energie-/Funkbereich
// und eine bewusst abgesetzte Landezone. So bleibt die Basis funktional und
// motiviert zum Erweitern statt wie verstreute Testobjekte zu wirken.

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
  /** Gameplay entity id used by the persistent world object. */
  catalogEntityId: string
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
    xM: -55,
    yM: 30,
    rotationDeg: 8,
    critical: true,
    catalogEntityId: 'habitat',
    purpose: 'Erster druckbeaufschlagter Wohn- und Aufenthaltskern der Shackleton-Basis.',
  },
  {
    id: 'alpha_life_support_1',
    role: 'life-support',
    label: 'Lebenserhaltung Alpha',
    zone: 'core',
    xM: -15,
    yM: 28,
    rotationDeg: 8,
    critical: true,
    catalogEntityId: 'life_support_hub',
    purpose: 'Lokaler ECLSS-Knoten fuer Atmosphaere, Wasser- und Abfallkreislauf; konkrete Engineering-Grenzen werden nicht hier definiert.',
  },
  {
    id: 'alpha_solar_1',
    role: 'power-generation',
    label: 'Solarfeld Alpha',
    zone: 'utilities',
    xM: -135,
    yM: 105,
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
    xM: -78,
    yM: 82,
    rotationDeg: 4,
    critical: true,
    catalogEntityId: 'battery_storage',
    purpose: 'Puffert die lokale Energieversorgung zwischen Erzeugung und kritischen Basisverbrauchern.',
  },
  {
    id: 'alpha_warehouse_1',
    role: 'warehouse',
    label: 'Warenhaus Alpha',
    zone: 'logistics',
    xM: 42,
    yM: 5,
    rotationDeg: 12,
    critical: true,
    catalogEntityId: 'warehouse',
    purpose: 'Primaerer Waren- und Materialknoten zwischen ankommender Fracht, Bauauftraegen, Werkstatt und lokaler Verteilung.',
  },
  {
    id: 'alpha_workshop_1',
    role: 'workshop',
    label: 'Werkstatt Alpha',
    zone: 'logistics',
    xM: 45,
    yM: -38,
    rotationDeg: 12,
    critical: false,
    catalogEntityId: 'surface_workshop',
    purpose: 'Wartung, Reparatur und vorbereitende Fertigung direkt neben dem Warenhaus.',
  },
  {
    id: 'alpha_rover_yard_1',
    role: 'rover-yard',
    label: 'Roverhof Alpha',
    zone: 'mobility',
    xM: 98,
    yM: -48,
    rotationDeg: 12,
    critical: false,
    catalogEntityId: 'rover_yard',
    purpose: 'Abstell-, Lade-, Wartungs- und Umschlagbereich fuer lokale Surface-Fahrzeuge.',
  },
  {
    id: 'alpha_comms_1',
    role: 'communications',
    label: 'Kommunikationsmast Alpha',
    zone: 'utilities',
    xM: -18,
    yM: 88,
    rotationDeg: 0,
    critical: true,
    catalogEntityId: 'surface_comms',
    purpose: 'Lokaler Kommunikations- und Datenknoten; Reichweite und Funktechnik bleiben Engineering-Sache.',
  },
  {
    id: 'alpha_landing_cargo_1',
    role: 'landing-cargo',
    label: 'Lande- und Cargo-Zone Alpha',
    zone: 'landing',
    xM: 175,
    yM: -105,
    rotationDeg: 20,
    critical: true,
    catalogEntityId: 'landing_pad_moon',
    purpose: 'Getrennter Ankunfts- und Frachtbereich mit direktem Schwerlastkorridor zum Warenhaus.',
  },
] as const

export const SHACKLETON_BASE_ALPHA_LOGISTICS: readonly ShackletonLogisticsEdge[] = [
  { from: 'alpha_landing_cargo_1', to: 'alpha_warehouse_1', flow: 'incoming-cargo', corridor: 'hardened-road' },
  { from: 'alpha_warehouse_1', to: 'alpha_workshop_1', flow: 'maintenance-supply', corridor: 'hardened-road' },
  { from: 'alpha_warehouse_1', to: 'alpha_habitat_1', flow: 'local-distribution', corridor: 'prepared-track' },
  { from: 'alpha_habitat_1', to: 'alpha_life_support_1', flow: 'maintenance-supply', corridor: 'prepared-track' },
  { from: 'alpha_workshop_1', to: 'alpha_rover_yard_1', flow: 'local-distribution', corridor: 'hardened-road' },
  { from: 'alpha_warehouse_1', to: 'alpha_landing_cargo_1', flow: 'surface-to-orbit', corridor: 'hardened-road' },
  { from: 'alpha_battery_1', to: 'alpha_habitat_1', flow: 'local-distribution', corridor: 'prepared-track' },
] as const

export const SHACKLETON_BASE_ALPHA_WAREHOUSE_ID = 'alpha_warehouse_1'

export function getShackletonStarterNode(id: string) {
  return SHACKLETON_BASE_ALPHA_NODES.find(node => node.id === id) ?? null
}

export function getWarehouseFlows() {
  return SHACKLETON_BASE_ALPHA_LOGISTICS.filter(edge =>
    edge.from === SHACKLETON_BASE_ALPHA_WAREHOUSE_ID || edge.to === SHACKLETON_BASE_ALPHA_WAREHOUSE_ID,
  )
}
