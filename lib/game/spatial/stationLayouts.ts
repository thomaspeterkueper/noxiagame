// lib/game/spatial/stationLayouts.ts
// Lageplan der Stationen Prometheus (Kepler Station) und Q1 in der begehbaren Welt
// (Thomas, 30.10.2026: Stationen begehbar machen). Meter, x nach Osten, y nach Norden,
// Mitte = Zentralmodul. Die Zahlen stehen auch in der Migration 20261030010000_station_layouts.sql;
// stationLayouts.test.ts prüft Abstände und Gänge.

export type StationSlug = 'prometheus' | 'q1'
export type StationModule = { key: string; id: string; entityId: string; xM: number; yM: number; widthM: number; depthM: number }
export type StationPassage = { id: string; pressurized: boolean; points: Array<{ xM: number; yM: number }> }

export const STATION_SLUGS: readonly StationSlug[] = ['prometheus', 'q1']
export const STATION_REGION: Record<StationSlug, string> = { prometheus: 'prometheus-deck', q1: 'q1-deck' }

export const PROMETHEUS_MODULES: readonly StationModule[] = [
  { key: 'p-cmd', id: '1028a862-434c-49ae-bc04-9bc2f014c2d4', entityId: 'command_center', xM: 0, yM: 0, widthM: 24, depthM: 20 },
  { key: 'p-hab-s', id: '021487da-6b30-4f97-8053-070bbc681805', entityId: 'habitat', xM: -34, yM: 24, widthM: 28, depthM: 22 },
  { key: 'p-hab-n', id: '1df7ede5-343e-436c-83a5-ad2142defc87', entityId: 'habitat', xM: 34, yM: 24, widthM: 28, depthM: 22 },
  { key: 'p-hmod', id: '1f385920-f14d-48ed-a77c-98ba917bfec4', entityId: 'habitat_module', xM: -34, yM: -24, widthM: 26, depthM: 22 },
  { key: 'p-water', id: 'c1e1ad67-59f1-4a7d-a0af-c1a07fe269db', entityId: 'water_recycler', xM: 34, yM: -24, widthM: 24, depthM: 20 },
  { key: 'p-obs', id: 'ccf590fe-be4a-4cb4-9167-7385df0844a0', entityId: 'observatory', xM: 0, yM: 72, widthM: 24, depthM: 20 },
  { key: 'p-ware', id: 'd74350ce-9a1d-4866-9116-d43d88ecd7f2', entityId: 'warehouse', xM: 0, yM: -72, widthM: 34, depthM: 26 },
  { key: 'p-dock', id: '4cb632e8-7f74-4dec-8d2c-5c853b48d258', entityId: 'docking_bay', xM: 102, yM: 0, widthM: 44, depthM: 30 },
  { key: 'p-sol1', id: '9bcbb52e-5a4b-414f-8db6-7ed2063bd4c6', entityId: 'solar_array', xM: -96, yM: 28, widthM: 40, depthM: 24 },
  { key: 'p-sol2', id: '7789d3b1-fa21-45b9-946c-6940f3e209fa', entityId: 'solar_array', xM: -96, yM: -28, widthM: 40, depthM: 24 },
  { key: 'p-sol3', id: '839b9e19-fe86-4770-aea4-b438f3ca935d', entityId: 'solar_array', xM: -152, yM: 0, widthM: 40, depthM: 24 },
  { key: 'p-scan1', id: '5770b661-7d6d-4e96-bd88-ad42262f1256', entityId: 'scanner', xM: 86, yM: 60, widthM: 16, depthM: 16 },
  { key: 'p-scan2', id: 'cac44894-ada4-440d-ad54-da28c36f83a2', entityId: 'scanner', xM: 86, yM: -60, widthM: 16, depthM: 16 },
]

export const PROMETHEUS_PASSAGES: readonly StationPassage[] = [
  { id: 'prometheus-loop-s', pressurized: true, points: [{ xM: -60, yM: -46 }, { xM: 60, yM: -46 }] },
  { id: 'prometheus-loop-e', pressurized: true, points: [{ xM: 60, yM: -46 }, { xM: 60, yM: 46 }] },
  { id: 'prometheus-loop-n', pressurized: true, points: [{ xM: 60, yM: 46 }, { xM: -60, yM: 46 }] },
  { id: 'prometheus-loop-w', pressurized: true, points: [{ xM: -60, yM: 46 }, { xM: -60, yM: -46 }] },
  { id: 'prometheus-spoke-n', pressurized: true, points: [{ xM: 0, yM: 0 }, { xM: 0, yM: 72 }] },
  { id: 'prometheus-spoke-s', pressurized: true, points: [{ xM: 0, yM: 0 }, { xM: 0, yM: -72 }] },
  { id: 'prometheus-spoke-e', pressurized: true, points: [{ xM: 0, yM: 0 }, { xM: 102, yM: 0 }] },
  { id: 'prometheus-spoke-w', pressurized: true, points: [{ xM: 0, yM: 0 }, { xM: -60, yM: 0 }] },
  { id: 'prometheus-stub-hab-s', pressurized: true, points: [{ xM: -34, yM: 24 }, { xM: -34, yM: 46 }] },
  { id: 'prometheus-stub-hab-n', pressurized: true, points: [{ xM: 34, yM: 24 }, { xM: 34, yM: 46 }] },
  { id: 'prometheus-stub-hmod', pressurized: true, points: [{ xM: -34, yM: -24 }, { xM: -34, yM: -46 }] },
  { id: 'prometheus-stub-water', pressurized: true, points: [{ xM: 34, yM: -24 }, { xM: 34, yM: -46 }] },
  { id: 'prometheus-boom-w', pressurized: false, points: [{ xM: -60, yM: 0 }, { xM: -152, yM: 0 }] },
  { id: 'prometheus-boom-sol1', pressurized: false, points: [{ xM: -96, yM: 0 }, { xM: -96, yM: 28 }] },
  { id: 'prometheus-boom-sol2', pressurized: false, points: [{ xM: -96, yM: 0 }, { xM: -96, yM: -28 }] },
  { id: 'prometheus-track-scan1', pressurized: false, points: [{ xM: 60, yM: 46 }, { xM: 86, yM: 60 }] },
  { id: 'prometheus-track-scan2', pressurized: false, points: [{ xM: 60, yM: -46 }, { xM: 86, yM: -60 }] },
]

export const Q1_MODULES: readonly StationModule[] = [
  { key: 'q-node', id: 'e7a37cf0-1c71-45f5-84cd-c692ac15b8ca', entityId: 'q1_transfer_node', xM: 0, yM: 0, widthM: 40, depthM: 30 },
  { key: 'q-alt', id: '0c601957-6263-47dc-9559-c9caad3caa29', entityId: 'q1_altbogen', xM: -72, yM: 0, widthM: 40, depthM: 26 },
  { key: 'q-arch', id: '2b1be7db-a36f-4ae3-a587-f0b2132debcb', entityId: 'q1_archive_culture_district', xM: -72, yM: 52, widthM: 46, depthM: 32 },
  { key: 'q-life', id: '7a68daeb-23fe-4375-859c-43826d8e175a', entityId: 'q1_everyday_life', xM: 0, yM: 72, widthM: 64, depthM: 42 },
  { key: 'q-port', id: '0694ed5c-1a1a-4b8a-bd2e-254381316ee2', entityId: 'q1_harbour_district', xM: 82, yM: 0, widthM: 50, depthM: 34 },
]

export const Q1_PASSAGES: readonly StationPassage[] = [
  { id: 'q1-spine-w', pressurized: true, points: [{ xM: 0, yM: 0 }, { xM: -72, yM: 0 }] },
  { id: 'q1-spine-e', pressurized: true, points: [{ xM: 0, yM: 0 }, { xM: 82, yM: 0 }] },
  { id: 'q1-spine-n', pressurized: true, points: [{ xM: 0, yM: 0 }, { xM: 0, yM: 72 }] },
  { id: 'q1-link-arch', pressurized: true, points: [{ xM: -72, yM: 0 }, { xM: -72, yM: 52 }] },
  { id: 'q1-link-arch-life', pressurized: true, points: [{ xM: -72, yM: 52 }, { xM: -32, yM: 52 }] },
]

export const STATION_LAYOUTS: Record<StationSlug, { modules: readonly StationModule[]; passages: readonly StationPassage[] }> = {
  prometheus: { modules: PROMETHEUS_MODULES, passages: PROMETHEUS_PASSAGES },
  q1: { modules: Q1_MODULES, passages: Q1_PASSAGES },
}

export function isStationSlug(value: string | null | undefined): value is StationSlug {
  return value === 'prometheus' || value === 'q1'
}

/** Gänge im Format der lokalen Szene. Mit Luft: befestigter Weg, ohne Luft: Außenpfad (nur im Anzug). */
export function stationCorridors(slug: StationSlug) {
  return STATION_LAYOUTS[slug].passages.map(passage => ({
    id: passage.id,
    kind: passage.pressurized ? ('hardened-road' as const) : ('prepared-track' as const),
    pressurized: passage.pressurized,
    points: passage.points.map(point => ({ xM: point.xM, yM: point.yM })),
  }))
}
