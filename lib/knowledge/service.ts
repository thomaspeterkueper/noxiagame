import { completeLearningModule, getUnlockedBuildings, initialKnowledgeProgress } from './progress';
import { fetchNoxiaUnlocks, type NoxiaUnlockPayload } from './remote';
import { getKnowledgeSourceMode } from './source';
import type { LearningModuleId } from './types';

const demoCompletedModules: LearningModuleId[] = [
  'LRN:SSF:MAT-1001',
  'LRN:SSF:MAT-1002',
  'LRN:SSF:PHY-1201',
  'LRN:SSF:PHY-1101',
];

export async function getNoxiaKnowledgeState(userId = 'demo'): Promise<NoxiaUnlockPayload> {
  if (getKnowledgeSourceMode() === 'ssf') {
    return fetchNoxiaUnlocks(userId);
  }

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
