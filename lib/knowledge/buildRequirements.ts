// buildRequirements.ts
// Aktualisiert: 07.09.2026 — kanonischen direkten Lernlink mit Build-Gate ausgeben
// Version:      0.4.0
import { getKnowledgeBuildingId } from './buildingMap';
import { getUnlockLabel } from './unlockRegistry';
import type { KnowledgeProgress } from './types';

const REQUIRED_UNLOCK: Record<string, string> = {
  'BLD:NOX:mine-1': 'UNL:NOX:resource-extraction',
  'BLD:NOX:solarfeld-1': 'UNL:NOX:power-generation',
  'BLD:NOX:wasseraufbereitung-1': 'UNL:NOX:water-processing',
  'BLD:NOX:airlock-1': 'UNL:NOX:airlock',
  'BLD:NOX:life-support-1': 'UNL:NOX:life-support',
  'BLD:NOX:thermal-control-1': 'UNL:NOX:thermal-control',
  'BLD:NOX:environment-monitoring-1': 'UNL:NOX:environment-monitoring',
  'BLD:NOX:habitat-redundancy-1': 'UNL:NOX:habitat-redundancy',
  'BLD:NOX:mars-habitat-1': 'UNL:NOX:mars-habitat',
  'BLD:NOX:schmelze-1': 'UNL:NOX:smelting',
};

export function getBuildRequirements(buildableId: string, progress: KnowledgeProgress) {
  const id = getKnowledgeBuildingId(buildableId);
  const requiredUnlock = id ? REQUIRED_UNLOCK[id] : null;
  const ok = !requiredUnlock || progress.unlocked.includes(requiredUnlock as any);
  const learningUrl = requiredUnlock
    ? `/academy/learn?unlock=${encodeURIComponent(requiredUnlock)}`
    : null;

  return {
    id,
    ok,
    requiredUnlock,
    requiredLabel: requiredUnlock ? getUnlockLabel(requiredUnlock) : null,
    learningUrl,
  };
}
