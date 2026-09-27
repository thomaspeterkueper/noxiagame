// lib/game/seeds/deimosOutpostAlphaSeed.ts
// Kanonischer NOXIA-Blueprint fuer die erste (und bewusst kleine) Deimos-
// Forschungsaussenstelle.
//
// Koordinaten liegen im lokalen ENU-Frame des Deimos-Weltframes (siehe
// supabase/migrations/20260925110000_deimos_outpost_alpha_world_seed.sql):
// +x = Ost, +y = Nord, Ursprung = ein Punkt am Rand des Swift-Kraters
// (real benannte Deimos-Oberflaechenfeature, siehe deimosTerrainAdapter.ts).
//
// Anders als Shackleton oder Stickney ist dies KEINE ausbaufaehige Kolonie,
// sondern eine bewusst minimale, rein funktionale Forschungsaussenstelle:
// ein Habitat, eine Forschungsstation und eine einzelne Shuttle-Anlegestelle.
// Kein Warenhaus, keine Werkstatt, kein Roverhof -- dafuer ist die Station zu
// klein und zu weit draussen.

export const DEIMOS_OUTPOST_ALPHA_ID = 'deimos_outpost_alpha'
export const DEIMOS_OUTPOST_ALPHA_FRAME = 'deimos_swift_rim_enu_v1'

export type DeimosOutpostRole = 'habitat' | 'research' | 'shuttle-dock'

export interface DeimosOutpostNode {
  id: string
  role: DeimosOutpostRole
  label: string
  xM: number
  yM: number
  rotationDeg: number
  critical: boolean
  catalogEntityId: string
  purpose: string
}

export type DeimosLogisticsFlow = 'crew-transfer' | 'resupply' | 'local-distribution'

export interface DeimosLogisticsEdge {
  from: string
  to: string
  flow: DeimosLogisticsFlow
  corridor: 'anchor-tether'
}

export const DEIMOS_OUTPOST_ALPHA_NODES: readonly DeimosOutpostNode[] = [
  {
    id: 'deimos_habitat_1',
    role: 'habitat',
    label: 'Mini-Habitat Swift-1',
    xM: -18,
    yM: 8,
    rotationDeg: 6,
    critical: true,
    catalogEntityId: 'habitat',
    purpose: 'Sehr kleiner Wohn- und Aufenthaltskern fuer eine Handvoll Forscher.',
  },
  {
    id: 'deimos_research_1',
    role: 'research',
    label: 'Forschungsstation Swift-1',
    xM: 6,
    yM: 10,
    rotationDeg: 6,
    critical: true,
    catalogEntityId: 'research_station',
    purpose: 'Kleine Forschungsstation fuer Deimos-Oberflaechen- und Umlaufbahn-Untersuchungen; rein funktionaler Ausbau, kein Repraesentationsbau.',
  },
  {
    id: 'deimos_shuttle_dock_1',
    role: 'shuttle-dock',
    label: 'Anlegestelle Swift-1',
    xM: 30,
    yM: -6,
    rotationDeg: 18,
    critical: true,
    catalogEntityId: 'shuttle_dock_deimos',
    purpose: 'Einzige Anlegestelle der Aussenstelle fuer Versorgungs-Shuttles und kleine Frachter.',
  },
] as const

export const DEIMOS_OUTPOST_ALPHA_LOGISTICS: readonly DeimosLogisticsEdge[] = [
  { from: 'deimos_shuttle_dock_1', to: 'deimos_research_1', flow: 'resupply', corridor: 'anchor-tether' },
  { from: 'deimos_research_1', to: 'deimos_habitat_1', flow: 'crew-transfer', corridor: 'anchor-tether' },
] as const

export function getDeimosOutpostNode(id: string) {
  return DEIMOS_OUTPOST_ALPHA_NODES.find(node => node.id === id) ?? null
}
