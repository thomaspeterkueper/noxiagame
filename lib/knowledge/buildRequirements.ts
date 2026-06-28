import { getKnowledgeBuildingId } from './buildingMap';
import type { KnowledgeProgress } from './types';

const REQUIRED_UNLOCK: Record<string, string> = {
  'BLD:NOX:mine-1': 'UNL:NOX:resource-extraction',
  'BLD:NOX:solarfeld-1': 'UNL:NOX:power-generation',
  'BLD:NOX:wasseraufbereitung-1': 'UNL:NOX:water-processing',
  'BLD:NOX:mars-habitat-1': 'UNL:NOX:mars-habitat',
  'BLD:NOX:schmelze-1': 'UNL:NOX:smelting',
};

const UNLOCK_LABEL: Record<string, string> = {
  'UNL:NOX:resource-extraction': 'Rohstoffgewinnung I',
  'UNL:NOX:power-generation': 'Energieerzeugung I',
  'UNL:NOX:water-processing': 'Wasseraufbereitung I',
  'UNL:NOX:mars-habitat': 'Marskolonisation I',
  'UNL:NOX:smelting': 'Metallurgie I',
};

export function getBuildRequirements(buildableId: string, progress: KnowledgeProgress) {
  const id = getKnowledgeBuildingId(buildableId);
  const requiredUnlock = id ? REQUIRED_UNLOCK[id] : null;
  const ok = !requiredUnlock || progress.unlocked.includes(requiredUnlock as any);
  return { id, ok, requiredUnlock, requiredLabel: requiredUnlock ? (UNLOCK_LABEL[requiredUnlock] ?? requiredUnlock) : null };
}
