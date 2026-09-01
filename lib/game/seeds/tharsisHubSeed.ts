// lib/game/seeds/tharsisHubSeed.ts
// Erstellt:     30.08.2026
// Version:      1.0.0
//
// Kanonischer Start-Seed „Tharsis Hub“ (497 Bewohner) — staatliche Startkolonie.
//
// Quelle des externen Auftrags:
//   external-tasks/open/OTA-NOX-REQ-20260830-tharsis-hub-start-seed.md
//   OTA setzt die technischen Redundanz-/Abhängigkeitsgrenzen (OTA-TEC-0094-2026-DE
//   bis OTA-TEC-0107-2026-DE); NOXIA bleibt Source of Truth für Spielobjekte,
//   Stückzahlen, Tile-Positionen, Baukosten/-zeiten, Balancing und Eigentumsmodell.
//
// Eigentumsmodell: Alle Startobjekte, Fahrzeuge, Fahrwege und Mediennetze beginnen
// im bestehenden kanonischen öffentlichen Owner-Konzept:
//   owner_class = 'STATE', is_state_owned = true, owner_id = NULL.
// Es wird KEINE neue Eigentums-ID erfunden; Betreiber/Okkupant darf später über
// das bestehende Leasing-/Konzessionsmodell (concessions, occupant_id) abweichen.
//
// Layout: 32×24-Grid (matches WORLD_COLS/WORLD_ROWS in ColonyGrid).
// Zonen A–F gemäß Abschnitt 5 des Auftrags:
//   A = geschützter Habitatkern (Cluster, Medical, C&C, saubere Werkstatt, Depots)
//   B = Logistik-/Industriekante (Fracht-Hub, schwere Werkstatt, Material, Fahrzeuge)
//   C = Wasser-/ISRU-Zone (drei Prozessstränge, getrennte Rohwasserbereiche)
//   D1–D3 = drei räumlich getrennte Energie-Domänen außerhalb des Druckkerns
//   E = fünf verteilte Radiatorfelder (zwei getrennte thermische Hauptkreise)
//   F = Lande-/Frachtbereich (direkter Schwerlastweg zum Logistik-Hub)
//
// Die SQL-Seed-Migration (supabase/migrations/…_tharsis_hub_start_seed.sql) ist
// aus dieser Datei generiert. Diese Datei ist die kanonische Quelle.

// ─── Kanonische Startwerte ──────────────────────────────────────────────────
export const THARSIS_HUB_POPULATION       = 497
export const THARSIS_HUB_HABITAT_CAPACITY = 504   // 6 Cluster × 84 Plätze
export const HABITAT_CLUSTER_CAPACITY     = 84
export const STATE_OWNER_CLASS            = 'STATE'

// ─── Kanonisches Eigentumsmodell (Auftrag §6 / ADR-Entscheidung 2) ──────────
// Alle Startobjekte, Fahrzeuge, Fahrwege und Mediennetze beginnen im
// bestehenden kanonischen öffentlichen Owner-Konzept:
//   owner_class = 'STATE', is_state_owned = true, owner_id = NULL.
// Es wird KEINE neue Eigentums-ID erfunden; Betreiber/Okkupant darf später
// über das bestehende Leasing-/Konzessionsmodell (concessions, occupant_id)
// vom Eigentümer abweichen. validateOwnership() prüft dieses Modell gegen
// die daraus generierte SQL-Migration.
export const SEED_OWNERSHIP = {
  ownerClass: STATE_OWNER_CLASS,
  isStateOwned: true,
  ownerId: null,
} as const

/** Relativer Pfad (Repo-Root) der aus dieser Datei generierten SQL-Migration. */
export const THARSIS_HUB_SEED_MIGRATION =
  'supabase/migrations/20260830190000_tharsis_hub_start_seed.sql'

// ─── Typen ──────────────────────────────────────────────────────────────────

export type SeedZone =
  | 'A'          // geschützter Habitatkern
  | 'B'          // Logistik-/Industriekante
  | 'C'          // Wasser-/ISRU-Zone
  | 'D1' | 'D2' | 'D3'   // Energie-Zonen 1–3
  | 'E'          // Thermalfelder
  | 'F'          // Lande-/Frachtbereich

export type UtilityRingId = 'A' | 'B'
export type RoadKind = 'ring' | 'energy' | 'water' | 'freight' | 'spur'

/**
 * Alle im Auftrag geforderten Medien. V2-Regel (Review BLOCKER 2): beide
 * physisch getrennten Backbones tragen alle Medien — Redundanz zählt je
 * Medium, nicht je Ringname.
 */
export const UTILITY_MEDIA = [
  'power', 'data', 'water', 'wastewater', 'o2', 'gas', 'thermal',
] as const
export type UtilityMedia = (typeof UTILITY_MEDIA)[number]

export interface SeedBuilding {
  id: string            // stabile Seed-ID (auch SQL-Determinismus-Basis)
  entityId: string      // NOXIA-Baukatalog-ID (BUILDINGS)
  row: number
  col: number
  zone: SeedZone
  critical: boolean
  // optionale fachliche Verknüpfungen
  complexId?: string          // z.B. energy_complex_1
  strandId?: string           // z.B. water_strand_1
  clusterRef?: string         // Habitatcluster-Zuordnung (Medical, C&C, Annex)
  servesClusters?: string[]   // ECLSS-Hubs: versorgte Cluster
  circuitId?: string          // Thermalkreis A/B für Radiatorfelder
  foodReserveT?: number       // Reserve-Depots: lagerfähige 30-Tage-Reserve (t)
  waterBufferT?: number       // Wasser-ISRU: Roh-/Prozesswasserpuffer (t)
  nominalPowerMw?: number     // Reaktormodule: Nennleistung (Architektur ca. 7–8 MW gesamt)
}

export interface SeedVehicle {
  id: string
  classId: string       // Fahrzeugklasse (NOXIA-eigene Modelle/Kapazitäten folgen später)
  row: number
  col: number
  zone: SeedZone
}

export interface SeedRoad {
  row: number
  col: number
  kind: RoadKind
}

export interface SeedUtilityRing {
  ring: UtilityRingId
  media: UtilityMedia[]
  nodes: Array<[number, number]>
}

export interface SeedUtilityLink {
  objectId: string      // SeedBuilding.id
  ring: UtilityRingId
  node: [number, number]
}

// ─── Fahrzeugklassen (Abschnitt 2 des Auftrags) ────────────────────────────
export const THARSIS_VEHICLE_CLASSES = {
  rescue_rover:        { id: 'rescue_rover',        count: 3, label: 'Druckbeaufschlagter Rettungs-/Personentransport-Rover' },
  cargo_transporter:   { id: 'cargo_transporter',   count: 4, label: 'Autonomer Frachttransporter' },
  construction_vehicle:{ id: 'construction_vehicle',count: 2, label: 'Schweres Bau-/Erdbewegungsfahrzeug' },
  maintenance_vehicle: { id: 'maintenance_vehicle', count: 3, label: 'Modulares Wartungs-/Berge-/EVA-Support-Fahrzeug' },
  inspection_drone:    { id: 'inspection_drone',    count: 8, label: 'Leichter Inspektionsroboter/-drohne' },
} as const

// ─── Physische Startobjekte (Abschnitt 1 des Auftrags) ─────────────────────
export const THARSIS_HUB_BUILDINGS: SeedBuilding[] = [
  // ── Zone A — geschützter Habitatkern (Ring-Reihen 13/18, Binnenstraßen 15/17) ─
  // Oberkante des Kerns (außerhalb des Service-Rings, noch im Druckkern):
  { id: 'workshop_clean',  entityId: 'workshop_clean',  row: 12, col: 12, zone: 'A', critical: false },
  { id: 'reserve_depot_2', entityId: 'reserve_depot',   row: 12, col: 13, zone: 'A', critical: true, foodReserveT: 9 },
  { id: 'eclss_hub_3',     entityId: 'eclss_hub',       row: 12, col: 14, zone: 'A', critical: true,
    servesClusters: ['habitat_cluster_2', 'habitat_cluster_5'] },
  { id: 'reserve_depot_3', entityId: 'reserve_depot',   row: 12, col: 15, zone: 'A', critical: true, foodReserveT: 9 },
  { id: 'plant_module',    entityId: 'plant_module',    row: 12, col: 16, zone: 'A', critical: false },
  { id: 'eclss_hub_2',     entityId: 'eclss_hub',       row: 12, col: 17, zone: 'A', critical: true,
    servesClusters: ['habitat_cluster_3', 'habitat_cluster_6'] },
  // Kern-Reihe 1:
  { id: 'eclss_hub_1',     entityId: 'eclss_hub',       row: 14, col: 12, zone: 'A', critical: true,
    servesClusters: ['habitat_cluster_1', 'habitat_cluster_4'] },
  { id: 'habitat_cluster_1', entityId: 'habitat_cluster', row: 14, col: 13, zone: 'A', critical: true },
  { id: 'habitat_cluster_2', entityId: 'habitat_cluster', row: 14, col: 14, zone: 'A', critical: true },
  { id: 'habitat_cluster_3', entityId: 'habitat_cluster', row: 14, col: 15, zone: 'A', critical: true },
  { id: 'medical_core',    entityId: 'medical_core',    row: 14, col: 16, zone: 'A', critical: true,
    clusterRef: 'habitat_cluster_3' },
  { id: 'command_node_1',  entityId: 'command_node',    row: 14, col: 17, zone: 'A', critical: true,
    clusterRef: 'habitat_cluster_3' },
  // Kern-Reihe 2:
  { id: 'reserve_depot_1', entityId: 'reserve_depot',   row: 16, col: 12, zone: 'A', critical: true, foodReserveT: 9 },
  { id: 'habitat_cluster_4', entityId: 'habitat_cluster', row: 16, col: 13, zone: 'A', critical: true },
  { id: 'habitat_cluster_5', entityId: 'habitat_cluster', row: 16, col: 14, zone: 'A', critical: true },
  { id: 'habitat_cluster_6', entityId: 'habitat_cluster', row: 16, col: 15, zone: 'A', critical: true },
  { id: 'medical_annex',   entityId: 'medical_annex',   row: 16, col: 16, zone: 'A', critical: true,
    clusterRef: 'habitat_cluster_6' },   // anderer Cluster als der Medical Core
  { id: 'command_node_2',  entityId: 'command_node',    row: 16, col: 17, zone: 'A', critical: true,
    clusterRef: 'habitat_cluster_6' },   // zwei verschiedene Cluster, kein alleiniger Master

  // ── Zone B — Logistik-/Industriekante ─────────────────────────────────────
  { id: 'logistics_hub',      entityId: 'logistics_hub',      row: 14, col: 11, zone: 'B', critical: true },
  { id: 'workshop_heavy',     entityId: 'workshop_heavy',     row: 15, col: 11, zone: 'B', critical: false },
  { id: 'material_complex_1', entityId: 'material_complex',   row: 16, col: 11, zone: 'B', critical: true },
  { id: 'material_complex_2', entityId: 'material_complex',   row: 17, col: 11, zone: 'B', critical: true },

  // ── Zone C — Wasser-/ISRU-Zone (drei unabhängige Prozessstränge) ──────────
  { id: 'water_isru_1', entityId: 'water_isru', row: 18, col: 7, zone: 'C', critical: true,
    strandId: 'water_strand_1', waterBufferT: 8 },
  { id: 'water_isru_2', entityId: 'water_isru', row: 20, col: 6, zone: 'C', critical: true,
    strandId: 'water_strand_2', waterBufferT: 8 },
  { id: 'water_isru_3', entityId: 'water_isru', row: 21, col: 4, zone: 'C', critical: true,
    strandId: 'water_strand_3', waterBufferT: 8 },

  // ── Zone D1 — Energie-Domäne Nordost ──────────────────────────────────────
  { id: 'reactor_module_1', entityId: 'reactor_module', row: 5, col: 27, zone: 'D1', critical: true,
    complexId: 'energy_complex_1', nominalPowerMw: 1.25 },
  { id: 'reactor_module_2', entityId: 'reactor_module', row: 4, col: 27, zone: 'D1', critical: true,
    complexId: 'energy_complex_1', nominalPowerMw: 1.25 },
  { id: 'black_start_1', entityId: 'black_start', row: 6, col: 27, zone: 'D1', critical: true,
    complexId: 'energy_complex_1' },

  // ── Zone D2 — Energie-Domäne Nordwest ─────────────────────────────────────
  { id: 'reactor_module_3', entityId: 'reactor_module', row: 5, col: 1, zone: 'D2', critical: true,
    complexId: 'energy_complex_2', nominalPowerMw: 1.25 },
  { id: 'reactor_module_4', entityId: 'reactor_module', row: 6, col: 1, zone: 'D2', critical: true,
    complexId: 'energy_complex_2', nominalPowerMw: 1.25 },
  { id: 'black_start_2', entityId: 'black_start', row: 6, col: 2, zone: 'D2', critical: true,
    complexId: 'energy_complex_2' },

  // ── Zone D3 — Energie-Domäne Südost ───────────────────────────────────────
  { id: 'reactor_module_5', entityId: 'reactor_module', row: 21, col: 27, zone: 'D3', critical: true,
    complexId: 'energy_complex_3', nominalPowerMw: 1.25 },
  { id: 'reactor_module_6', entityId: 'reactor_module', row: 22, col: 27, zone: 'D3', critical: true,
    complexId: 'energy_complex_3', nominalPowerMw: 1.25 },
  { id: 'black_start_3', entityId: 'black_start', row: 22, col: 26, zone: 'D3', critical: true,
    complexId: 'energy_complex_3' },

  // ── Zone E — fünf getrennte Radiatorfelder, zwei thermische Hauptkreise ───
  { id: 'radiator_field_1', entityId: 'radiator_field', row: 3,  col: 28, zone: 'E', critical: true, circuitId: 'thermal_circuit_A' },
  { id: 'radiator_field_2', entityId: 'radiator_field', row: 7,  col: 28, zone: 'E', critical: true, circuitId: 'thermal_circuit_A' },
  { id: 'radiator_field_3', entityId: 'radiator_field', row: 13, col: 28, zone: 'E', critical: true, circuitId: 'thermal_circuit_A' },
  { id: 'radiator_field_4', entityId: 'radiator_field', row: 9,  col: 2,  zone: 'E', critical: true, circuitId: 'thermal_circuit_B' },
  { id: 'radiator_field_5', entityId: 'radiator_field', row: 23, col: 28, zone: 'E', critical: true, circuitId: 'thermal_circuit_B' },

  // ── Kommunikation / Steuerung ─────────────────────────────────────────────
  { id: 'surface_relay_1', entityId: 'surface_relay', row: 9,  col: 24, zone: 'E', critical: false },
  { id: 'surface_relay_2', entityId: 'surface_relay', row: 13, col: 25, zone: 'E', critical: false },
  { id: 'surface_relay_3', entityId: 'surface_relay', row: 18, col: 23, zone: 'F', critical: false },
  { id: 'longrange_comms_1', entityId: 'longrange_comms', row: 2, col: 28, zone: 'D1', critical: true },
  { id: 'longrange_comms_2', entityId: 'longrange_comms', row: 22, col: 3, zone: 'C', critical: true },

  // ── Zone F — Lande-/Frachtbereich ─────────────────────────────────────────
  { id: 'landing_pad', entityId: 'landing_pad', row: 20, col: 20, zone: 'F', critical: true },
]

// ─── Fahrzeug-Startbestand (Abschnitt 2) ────────────────────────────────────
export const THARSIS_HUB_VEHICLES: SeedVehicle[] = [
  { id: 'rescue_rover_1',         classId: 'rescue_rover',         row: 21, col: 10, zone: 'B' },
  { id: 'rescue_rover_2',         classId: 'rescue_rover',         row: 21, col: 11, zone: 'B' },
  { id: 'rescue_rover_3',         classId: 'rescue_rover',         row: 21, col: 12, zone: 'B' },
  { id: 'cargo_transporter_1',    classId: 'cargo_transporter',    row: 21, col: 17, zone: 'F' },
  { id: 'cargo_transporter_2',    classId: 'cargo_transporter',    row: 21, col: 19, zone: 'F' },
  { id: 'cargo_transporter_3',    classId: 'cargo_transporter',    row: 21, col: 20, zone: 'F' },
  { id: 'cargo_transporter_4',    classId: 'cargo_transporter',    row: 21, col: 21, zone: 'F' },
  { id: 'construction_vehicle_1', classId: 'construction_vehicle', row: 20, col: 13, zone: 'B' },
  { id: 'construction_vehicle_2', classId: 'construction_vehicle', row: 20, col: 14, zone: 'B' },
  { id: 'maintenance_vehicle_1',  classId: 'maintenance_vehicle',  row: 20, col: 10, zone: 'B' },
  { id: 'maintenance_vehicle_2',  classId: 'maintenance_vehicle',  row: 20, col: 11, zone: 'B' },
  { id: 'maintenance_vehicle_3',  classId: 'maintenance_vehicle',  row: 20, col: 12, zone: 'B' },
  { id: 'inspection_drone_1',     classId: 'inspection_drone',     row: 10, col: 4,  zone: 'B' },
  { id: 'inspection_drone_2',     classId: 'inspection_drone',     row: 10, col: 5,  zone: 'B' },
  { id: 'inspection_drone_3',     classId: 'inspection_drone',     row: 11, col: 4,  zone: 'B' },
  { id: 'inspection_drone_4',     classId: 'inspection_drone',     row: 11, col: 5,  zone: 'B' },
  { id: 'inspection_drone_5',     classId: 'inspection_drone',     row: 12, col: 4,  zone: 'B' },
  { id: 'inspection_drone_6',     classId: 'inspection_drone',     row: 12, col: 5,  zone: 'B' },
  { id: 'inspection_drone_7',     classId: 'inspection_drone',     row: 13, col: 4,  zone: 'B' },
  { id: 'inspection_drone_8',     classId: 'inspection_drone',     row: 13, col: 5,  zone: 'B' },
]

// ─── Minimaler Fahrwege-Plan (Abschnitt 3) ──────────────────────────────────
// Innerer Service-Ring + drei Hauptkorridore (Energie, Wasser, Lande/Fracht)
// + notwendige Service-Spurs zu Radiatorfeldern, Relays, Kommunikation und
// Reststoffanlagen. Kein dekoratives Straßennetz, keine Schiene.
//
// Wichtig: Alle Korridore sind durchgehende 4-verbundene Zellpfade (keine
// Diagonalsprünge) — das Straßennetz ist ein einziger zusammenhängender Graph.
// Anforderung §3/§9: Die Sperrung eines einzelnen Tiles darf nicht gleichzeitig
// sämtliche Wege zu Energie und Wasser abschneiden.
export const THARSIS_HUB_ROADS: SeedRoad[] = [
  // Innerer Service-Ring um Habitat-/Logistikkern (geschlossener Ring)
  ...range(10, 18).map(col => ({ row: 13, col, kind: 'ring' as const })),
  ...range(10, 18).map(col => ({ row: 18, col, kind: 'ring' as const })),
  ...range(14, 17).map(row => ({ row, col: 10, kind: 'ring' as const })),
  ...range(14, 17).map(row => ({ row, col: 18, kind: 'ring' as const })),

  // Interne Service-Straßen im Habitatkern (alternativer Rettungszugang)
  ...range(12, 17).map(col => ({ row: 15, col, kind: 'spur' as const })),
  ...range(12, 17).map(col => ({ row: 17, col, kind: 'spur' as const })),

  // Energie-Hauptkorridor E1: Ring → Energie-Domäne D1 (Nordost)
  // 4-verbundener Pfad über die ehemaligen Service-Spurs zu Relay 2/3 (S3/S4),
  // damit der Korridor ohne Diagonalsprünge durchgehend zum Ring läuft
  // (Ring-Anschlüsse bei (13,19) und (17,19)).
  ...[ [13,19],[14,19],[15,19],[16,19],[17,19],[17,20],[17,21],[17,22],[17,23],[16,23],[15,23],[14,23],[13,23],[12,23],[11,23],[10,23],[10,22],[9,22],[8,22],[7,22],[6,22],[6,23],[6,24],[6,25],[6,26],[5,26] ].map(([row, col]) => ({ row, col, kind: 'energy' as const })),
  // Energie-Hauptkorridor E2: Ring → Energie-Domäne D2 (Nordwest)
  // Westliche Umfahrung der Utility-Linien: über den Wasser-/ISRU-Pfad
  // (21,5)/(22,5) in den Südwesten, entlang der Westkante hoch zur Domäne D2.
  ...[ [23,4],[23,3],[23,2],[23,1],[23,0],[22,0],[21,0],[20,0],[19,0],[18,0],[17,0],[16,0],[15,0],[14,0],[13,0],[12,0],[11,0],[10,0],[9,0],[8,0],[7,0],[6,0],[5,0],[7,1],[7,2],[7,3],[6,3] ].map(([row, col]) => ({ row, col, kind: 'energy' as const })),
  // Energie-Hauptkorridor E3: Ring → Energie-Domäne D3 (Südost)
  ...[ [19,18],[20,18],[21,18],[22,18],[23,18],[23,19],[23,20],[23,21],[23,22],[23,23],[23,24],[23,25],[23,26],[23,27] ].map(([row, col]) => ({ row, col, kind: 'energy' as const })),

  // Wasser-/ISRU-Hauptkorridor: Ring → Zone C (zwei Ring-Anschlüsse)
  // Segment 1 (Anschlüsse (14,10) und (18,10)) plus Segment 2 mit Südschleife
  // über Reihe 22 bis zum Energie-Korridor E3 — N-1-resistente Schleife ohne
  // Diagonalsprünge (Anschluss an den Ring über den E3-Knoten (18,18)).
  ...[ [14,9],[15,9],[16,9],[17,9],[18,9],[18,8],[19,8],[20,7],[21,7],[21,6],[21,5],[21,8],[22,6],[22,7],[22,8],[22,9],[22,10],[22,11],[22,12],[22,13],[22,14],[22,15],[22,16],[22,17] ].map(([row, col]) => ({ row, col, kind: 'water' as const })),

  // Lande-/Fracht-Hauptkorridor: Ring → Zone F (direkter Schwerlastweg zum
  // Logistik-Hub). Der Korridor mündet bei (20,18) in den Energie-Korridor E3
  // (gemeinsamer Knoten, ein Tile gehört nur einer Straße).
  ...[ [19,16],[20,16],[20,17],[20,19] ].map(([row, col]) => ({ row, col, kind: 'freight' as const })),

  // Service-Spurs — nur notwendige Zufahrten
  // S1: Radiatorfeld 1
  ...[ [4,26],[3,26],[3,27] ].map(([row, col]) => ({ row, col, kind: 'spur' as const })),
  // S2: Radiatorfeld 2
  ...[ [7,26],[7,27] ].map(([row, col]) => ({ row, col, kind: 'spur' as const })),
  // S3: Relay 2 (Radiatorfeld 3 liegt abgeschottet zwischen Utility-Knoten und
  // ist über die Utility-Ringe angebunden; seine Zufahrts-Tiles (13,26)/(13,27)
  // waren nicht 4-verbunden und entfallen)
  ...[ [13,24] ].map(([row, col]) => ({ row, col, kind: 'spur' as const })),
  // S5: Radiatorfeld 4 (Anschluss an den Energie-Korridor E2 über (8,3))
  ...[ [9,3],[9,4],[9,5],[8,3],[8,4] ].map(([row, col]) => ({ row, col, kind: 'spur' as const })),
  // S6: Langstrecken-Comms 2 / Reststoffbereich Südwest
  ...[ [22,5],[22,4] ].map(([row, col]) => ({ row, col, kind: 'spur' as const })),
  // S7: Relay 1 (Abzweig vom Energie-Korridor E1)
  ...[ [9,23] ].map(([row, col]) => ({ row, col, kind: 'spur' as const })),
]

// ─── Mediennetz (Abschnitt 4) — Utility Ring A / B, physisch getrennt ───────
// Ein Road-Tile enthält NICHT automatisch alle Medien: Utility-Netze sind
// eigene technische Netzlogik mit eigenen, von den Fahrwegen getrennten
// Pfaden. Beide Ringe teilen sich keine Zelle und keine Zelle mit Straßen,
// Gebäuden oder Fahrzeugen.
//
// V2-Regel (Implementierungs-/Layout-Review BLOCKER 2): Beide Backbones tragen
// ALLE modellierten Medien (UTILITY_MEDIA). Zwei Ringe zählen nur dann als
// Redundanz, wenn das konkrete Medium auf beiden Pfaden ankommt; die
// Arrays unten sind daher kanonisch für die generierte SQL-Migration (9a/9b)
// und deckungsgleich mit der V2-Integritätsregel in tharsisHubUtilityNetwork.ts.
export const THARSIS_HUB_UTILITY_RINGS: SeedUtilityRing[] = [
  {
    ring: 'A',
    media: [...UTILITY_MEDIA],
    nodes: [
      // A-Nord (oberhalb des Service-Rings)
      [11,10],[11,11],[11,12],[11,13],[11,14],[11,15],[11,16],[11,17],[11,18],
      // A-Nordost → Ost
      [11,19],[12,19],[13,20],[14,20],[15,20],[16,20],[18,20],[19,20],
      // A-Süd (Zone F)
      [20,21],[20,22],[20,23],[20,24],[20,25],[20,26],
      // A-Westrückführung
      [19,26],[18,26],[17,26],[16,26],[15,26],[14,26],
      [12,26],[12,25],[12,24],[12,22],[12,21],
      // A-West (Richtung Wasser-/ISRU-Zone)
      [19,9],[20,8],[20,5],[20,4],[20,3],[20,2],
      // A-Nordwest (Richtung Energie-Domäne D2)
      [11,9],[10,8],[9,8],[8,7],[7,6],[6,5],[5,4],[4,3],[3,3],[2,3],
      // A-Nordost-Ast (Richtung Energie-Domäne D1)
      [10,24],[9,25],[8,25],[8,26],[5,25],[4,25],[3,25],[2,26],[2,27],
    ],
  },
  {
    ring: 'B',
    media: [...UTILITY_MEDIA],
    nodes: [
      // B-Ost (westlich der Zone A/B)
      [13,8],[14,8],[15,8],[16,8],[17,8],
      // B-Nord
      [12,8],[12,7],[12,6],
      // B-West
      [13,6],[14,6],[15,6],[16,6],[17,6],[18,6],
      // B-Süd (Wasser-/ISRU-Zone)
      [19,5],[19,6],[19,7],
      // B-Nordwest (Richtung Energie-Domäne D2)
      [11,6],[10,6],[9,7],[8,6],[7,5],[6,4],[5,3],[4,1],[3,1],[2,1],
      // B-Nordost-Ast (Richtung Energie-Domäne D1 / Radiatorfelder)
      [10,25],[9,26],[8,27],[6,28],[5,28],[4,28],[4,29],[3,29],
      // B-Südost (Richtung Energie-Domäne D3 / Zone F)
      [18,22],[19,22],[21,23],[21,24],[21,25],[21,26],
    ],
  },
]

// ─── Doppelte Medienanbindung (Abschnitt 4) ─────────────────────────────────
// Jeder Habitatcluster und jede kritische Anlage erhält zwei Versorgungspfade:
// einen über Ring A, einen über Ring B.
export const THARSIS_HUB_UTILITY_LINKS: SeedUtilityLink[] = [
  // Habitatcluster
  { objectId: 'habitat_cluster_1', ring: 'A', node: [11,13] }, { objectId: 'habitat_cluster_1', ring: 'B', node: [13,8] },
  { objectId: 'habitat_cluster_2', ring: 'A', node: [11,14] }, { objectId: 'habitat_cluster_2', ring: 'B', node: [14,8] },
  { objectId: 'habitat_cluster_3', ring: 'A', node: [11,15] }, { objectId: 'habitat_cluster_3', ring: 'B', node: [15,8] },
  { objectId: 'habitat_cluster_4', ring: 'A', node: [11,13] }, { objectId: 'habitat_cluster_4', ring: 'B', node: [16,8] },
  { objectId: 'habitat_cluster_5', ring: 'A', node: [11,14] }, { objectId: 'habitat_cluster_5', ring: 'B', node: [17,8] },
  { objectId: 'habitat_cluster_6', ring: 'A', node: [11,15] }, { objectId: 'habitat_cluster_6', ring: 'B', node: [18,6] },
  // ECLSS-Hubs
  { objectId: 'eclss_hub_1', ring: 'A', node: [11,12] }, { objectId: 'eclss_hub_1', ring: 'B', node: [13,8] },
  { objectId: 'eclss_hub_2', ring: 'A', node: [11,16] }, { objectId: 'eclss_hub_2', ring: 'B', node: [15,8] },
  { objectId: 'eclss_hub_3', ring: 'A', node: [11,14] }, { objectId: 'eclss_hub_3', ring: 'B', node: [17,8] },
  // Medical
  { objectId: 'medical_core',  ring: 'A', node: [11,16] }, { objectId: 'medical_core',  ring: 'B', node: [14,8] },
  { objectId: 'medical_annex', ring: 'A', node: [11,16] }, { objectId: 'medical_annex', ring: 'B', node: [15,8] },
  // Command & Control
  { objectId: 'command_node_1', ring: 'A', node: [11,17] }, { objectId: 'command_node_1', ring: 'B', node: [14,8] },
  { objectId: 'command_node_2', ring: 'A', node: [11,15] }, { objectId: 'command_node_2', ring: 'B', node: [17,8] },
  // Werkstatt / Lager / Produktion
  { objectId: 'workshop_clean', ring: 'A', node: [11,12] }, { objectId: 'workshop_clean', ring: 'B', node: [13,8] },
  { objectId: 'workshop_heavy', ring: 'A', node: [11,10] }, { objectId: 'workshop_heavy', ring: 'B', node: [14,8] },
  { objectId: 'reserve_depot_1', ring: 'A', node: [11,11] }, { objectId: 'reserve_depot_1', ring: 'B', node: [14,8] },
  { objectId: 'reserve_depot_2', ring: 'A', node: [11,11] }, { objectId: 'reserve_depot_2', ring: 'B', node: [15,8] },
  { objectId: 'reserve_depot_3', ring: 'A', node: [11,16] }, { objectId: 'reserve_depot_3', ring: 'B', node: [16,8] },
  { objectId: 'plant_module',   ring: 'A', node: [11,14] }, { objectId: 'plant_module',   ring: 'B', node: [16,8] },
  // Logistik / Industriekante
  { objectId: 'logistics_hub',      ring: 'A', node: [11,10] }, { objectId: 'logistics_hub',      ring: 'B', node: [13,8] },
  { objectId: 'material_complex_1', ring: 'A', node: [11,10] }, { objectId: 'material_complex_1', ring: 'B', node: [15,8] },
  { objectId: 'material_complex_2', ring: 'A', node: [11,10] }, { objectId: 'material_complex_2', ring: 'B', node: [16,8] },
  // Wasser / ISRU
  { objectId: 'water_isru_1', ring: 'A', node: [19,9] }, { objectId: 'water_isru_1', ring: 'B', node: [19,6] },
  { objectId: 'water_isru_2', ring: 'A', node: [20,5] }, { objectId: 'water_isru_2', ring: 'B', node: [19,6] },
  { objectId: 'water_isru_3', ring: 'A', node: [20,3] }, { objectId: 'water_isru_3', ring: 'B', node: [19,5] },
  // Energie-Domäne D1
  { objectId: 'reactor_module_1', ring: 'A', node: [5,25] }, { objectId: 'reactor_module_1', ring: 'B', node: [5,28] },
  { objectId: 'reactor_module_2', ring: 'A', node: [4,25] }, { objectId: 'reactor_module_2', ring: 'B', node: [4,28] },
  { objectId: 'black_start_1',    ring: 'A', node: [5,25] }, { objectId: 'black_start_1',    ring: 'B', node: [6,28] },
  // Energie-Domäne D2
  { objectId: 'reactor_module_3', ring: 'A', node: [5,4] }, { objectId: 'reactor_module_3', ring: 'B', node: [4,1] },
  { objectId: 'reactor_module_4', ring: 'A', node: [6,5] }, { objectId: 'reactor_module_4', ring: 'B', node: [5,3] },
  { objectId: 'black_start_2',    ring: 'A', node: [6,5] }, { objectId: 'black_start_2',    ring: 'B', node: [5,3] },
  // Energie-Domäne D3
  { objectId: 'reactor_module_5', ring: 'A', node: [20,26] }, { objectId: 'reactor_module_5', ring: 'B', node: [21,26] },
  { objectId: 'reactor_module_6', ring: 'A', node: [20,26] }, { objectId: 'reactor_module_6', ring: 'B', node: [21,26] },
  { objectId: 'black_start_3',    ring: 'A', node: [20,25] }, { objectId: 'black_start_3',    ring: 'B', node: [21,26] },
  // Thermalfelder (thermische Kreise als eigene Netzlogik)
  { objectId: 'radiator_field_1', ring: 'A', node: [2,27] }, { objectId: 'radiator_field_1', ring: 'B', node: [3,29] },
  { objectId: 'radiator_field_2', ring: 'A', node: [8,26] }, { objectId: 'radiator_field_2', ring: 'B', node: [6,28] },
  { objectId: 'radiator_field_3', ring: 'A', node: [12,26] },{ objectId: 'radiator_field_3', ring: 'B', node: [10,25] },
  { objectId: 'radiator_field_4', ring: 'A', node: [9,8] },  { objectId: 'radiator_field_4', ring: 'B', node: [8,6] },
  { objectId: 'radiator_field_5', ring: 'A', node: [20,26] },{ objectId: 'radiator_field_5', ring: 'B', node: [21,26] },
  // Kommunikation
  { objectId: 'surface_relay_1',  ring: 'A', node: [9,25] }, { objectId: 'surface_relay_1',  ring: 'B', node: [9,26] },
  { objectId: 'surface_relay_2',  ring: 'A', node: [12,25] },{ objectId: 'surface_relay_2',  ring: 'B', node: [10,25] },
  { objectId: 'surface_relay_3',  ring: 'A', node: [18,26] },{ objectId: 'surface_relay_3',  ring: 'B', node: [18,22] },
  { objectId: 'longrange_comms_1',ring: 'A', node: [2,27] }, { objectId: 'longrange_comms_1',ring: 'B', node: [3,29] },
  { objectId: 'longrange_comms_2',ring: 'A', node: [20,3] }, { objectId: 'longrange_comms_2',ring: 'B', node: [19,5] },
  // Lande-/Frachtbereich
  { objectId: 'landing_pad', ring: 'A', node: [20,21] }, { objectId: 'landing_pad', ring: 'B', node: [19,22] },
]

// ─── Kühlzuordnung (Abschnitt 1.5): kritische ECLSS-/Medizinkühlung ────────
// Jeder kritische Kälteverbraucher hängt an zwei Radiatorfeldern aus
// verschiedenen Thermalkreisen → Verlust eines Feldes beendet die Kühlung
// nach Lastabwurf nicht.
export const THARSIS_COOLING_LINKS: Record<string, string[]> = {
  eclss_hub_1: ['radiator_field_1', 'radiator_field_4'],
  eclss_hub_2: ['radiator_field_2', 'radiator_field_5'],
  eclss_hub_3: ['radiator_field_3', 'radiator_field_4'],
  medical_core:  ['radiator_field_1', 'radiator_field_5'],
  medical_annex: ['radiator_field_2', 'radiator_field_4'],
}

// ─── Rohwasser-Entnahmebereiche (Abschnitt 1.4): mindestens zwei räumlich
// getrennte Entnahme-/Rohwasserbereiche (Meta, keine eigenen Spielobjekte).
export const THARSIS_RAW_WATER_AREAS: Array<{ id: string; cells: Array<[number, number]> }> = [
  { id: 'raw_water_area_west',  cells: [[19, 3], [19, 4], [20, 3], [20, 4]] },
  { id: 'raw_water_area_south', cells: [[22, 6], [22, 7], [23, 6], [23, 7]] },
]

// ─── Hilfsfunktionen ────────────────────────────────────────────────────────

function range(from: number, to: number): number[] {
  const out: number[] = []
  for (let i = from; i <= to; i++) out.push(i)
  return out
}

export function seedObjectCounts(): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const b of THARSIS_HUB_BUILDINGS) counts[b.entityId] = (counts[b.entityId] ?? 0) + 1
  return counts
}

export function seedVehicleCounts(): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const v of THARSIS_HUB_VEHICLES) counts[v.classId] = (counts[v.classId] ?? 0) + 1
  return counts
}

export function getSeedRoadCells(slug: string): Array<[number, number]> {
  if (slug !== 'mars') return []
  return THARSIS_HUB_ROADS.map(r => [r.row, r.col] as [number, number])
}

export function isSeedRoadCell(row: number, col: number): boolean {
  return THARSIS_HUB_ROADS.some(r => r.row === row && r.col === col)
}

export function getSeedBuildings(): SeedBuilding[] { return THARSIS_HUB_BUILDINGS }
export function getSeedVehicles(): SeedVehicle[] { return THARSIS_HUB_VEHICLES }

export function getRingNodes(ring: UtilityRingId): Array<[number, number]> {
  return THARSIS_HUB_UTILITY_RINGS.find(r => r.ring === ring)?.nodes ?? []
}

export function getRingMedia(ring: UtilityRingId): UtilityMedia[] {
  return THARSIS_HUB_UTILITY_RINGS.find(r => r.ring === ring)?.media ?? []
}
