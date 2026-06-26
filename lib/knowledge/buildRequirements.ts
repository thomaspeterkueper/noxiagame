import { getKnowledgeBuildingId } from './buildingMap';
import type { KnowledgeProgress } from './types';

const REQUIRED_UNLOCK: Record<string, string> = {
  'BLD:NOX:mine-1': 'UNL:NOX:resource-extraction',
  'BLD:NOX:solarfeld-1': 'UNL:NOX:power-generation',
  'BLD:NOX:wasseraufbereitung-1': 'UNL:NOX:water-processing',
  'BLD:NOX:mars-habitat-1': 'UNL:NOX:mars-habitat',
  'BLD:NOX:schmelze-1': 'UNL:NOX:smelting',
};

export function getBuildRequirements(buildableId: string, progress: KnowledgeProgress) {
  const id = getKnowledgeBuildingId(buildableId);
  const requiredUnlock = id ? REQUIRED_UNLOCK[id] : null;
  const ok = !requiredUnlock || progress.unlocked.includes(requiredUnlock as any);
  return { id, ok, requiredUnlock };
}
