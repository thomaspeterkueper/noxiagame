// buildingMap.ts
// Aktualisiert: 31.08.2026 — Mars-Technologiekette mit realen Bauobjekten verknüpft
// Version:      0.2.0
import type { BuildingId } from './types';

const NOXIA_BUILDING_IDS: Record<string, BuildingId> = {
  mine: 'BLD:NOX:mine-1',
  solar: 'BLD:NOX:solarfeld-1',
  ice_drill: 'BLD:NOX:wasseraufbereitung-1',
  water_recycler: 'BLD:NOX:wasseraufbereitung-1',
  habitat: 'BLD:NOX:mars-habitat-1',
  habitat_cluster: 'BLD:NOX:mars-habitat-1',
  logistics_hub: 'BLD:NOX:airlock-1',
  eclss_hub: 'BLD:NOX:life-support-1',
  radiator_field: 'BLD:NOX:thermal-control-1',
  command_node: 'BLD:NOX:environment-monitoring-1',
  black_start: 'BLD:NOX:habitat-redundancy-1',
  smelter: 'BLD:NOX:schmelze-1',
};

export function getKnowledgeBuildingId(buildableId: string): BuildingId | null {
  return NOXIA_BUILDING_IDS[buildableId] ?? null;
}
