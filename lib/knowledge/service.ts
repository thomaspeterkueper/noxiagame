// service.ts
// Aktualisiert: 14.09.2026 — SSF-Ausfall darf keine Demo-Rechte verleihen
// Version:      0.3.0

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

function getUnavailableSsfKnowledgeState(userId: string): NoxiaUnlockPayload {
  return {
    source: 'ssf-unavailable',
    userId,
    completedModules: [],
    unlocked: [],
    buildings: [],
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
    } catch (error) {
      console.error('[knowledge] SSF knowledge unavailable; using fail-closed state:', error);
      return getUnavailableSsfKnowledgeState(userId);
    }
  }

  // The demo progression is only valid when local mode was selected explicitly.
  return getLocalKnowledgeState(userId);
}
