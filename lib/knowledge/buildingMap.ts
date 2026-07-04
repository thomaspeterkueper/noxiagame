// buildingMap.ts
// Aktualisiert: 04.07.2026 — Header ergänzt; Building-ID → Modul-Mapping
// Version:      0.1.0
import type { BuildingId } from './types';

const NOXIA_BUILDING_IDS: Record<string, BuildingId> = {
  mine: 'BLD:NOX:mine-1',
  solar: 'BLD:NOX:solarfeld-1',
  ice_drill: 'BLD:NOX:wasseraufbereitung-1',
  water_recycler: 'BLD:NOX:wasseraufbereitung-1',
  habitat: 'BLD:NOX:mars-habitat-1',
  smelter: 'BLD:NOX:schmelze-1',
};

export function getKnowledgeBuildingId(buildableId: string): BuildingId | null {
  return NOXIA_BUILDING_IDS[buildableId] ?? null;
}
