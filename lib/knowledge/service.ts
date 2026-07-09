// service.ts
// Aktualisiert: 09.07.2026 — ungültige Demo-Modul-ID entfernt
// Version:      0.2.1

import { completeLearningModule, getUnlockedBuildings, initialKnowledgeProgress } from './progress';
import { fetchNoxiaUnlocks, type NoxiaUnlockPayload } from './remote';
import { getKnowledgeSourceMode } from './source';
import type { LearningModuleId } from './types';

const demoCompletedModules: LearningModuleId[] = [
  'LRN:SSF:MAT-1001',
  'LRN:SSF:MAT-1002',
  'LRN:SSF:PHY-1101',
];

function getLocalKnowledgeState(userId: string): NoxiaUnlockPayload {
  const progress = demoCompletedModules.reduce(
    (currentProgress, moduleId) => completeLearningModule(currentProgress, moduleId),
    initialKnowledgeProgress,
  );

  return {
    source: 'noxia-local',
    userId,
    completedModules: progress.completedModules,
    unlocked: progress.unlocked,
    buildings: getUnlockedBuildings(progress).map((building) => building.id),
  };
}

export async function getNoxiaKnowledgeState(userId = 'demo'): Promise<NoxiaUnlockPayload> {
  if (getKnowledgeSourceMode() === 'ssf') {
    try {
      const remote = await fetchNoxiaUnlocks(userId);
      return {
        source: remote.source ?? 'ssf',
        userId: remote.userId ?? userId,
        completedModules: remote.completedModules ?? [],
        unlocked: remote.unlocked ?? [],
        buildings: remote.buildings ?? [],
      };
    } catch {
      return getLocalKnowledgeState(userId);
    }
  }

  return getLocalKnowledgeState(userId);
}
