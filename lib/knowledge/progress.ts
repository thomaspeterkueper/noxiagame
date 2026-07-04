// progress.ts
// Aktualisiert: 04.07.2026 — Header ergänzt; Lernfortschritt-Logik
// Version:      0.1.0
import { knowledgeBuildings, knowledgeUnlocks, learningModules } from './data';
import type { BuildCheck, BuildingId, KnowledgeProgress, LearningModuleId, UnlockId } from './types';

export const initialKnowledgeProgress: KnowledgeProgress = {
  completedModules: [],
  unlocked: [],
};

export function completeLearningModule(
  progress: KnowledgeProgress,
  moduleId: LearningModuleId,
): KnowledgeProgress {
  if (progress.completedModules.includes(moduleId)) return progress;

  const completedModules = [...progress.completedModules, moduleId];
  const unlocked = new Set(progress.unlocked);

  for (const unlock of knowledgeUnlocks) {
    const requirementsMet = unlock.requires.every((requiredModuleId) =>
      completedModules.includes(requiredModuleId),
    );

    if (requirementsMet) unlocked.add(unlock.id);
  }

  return {
    completedModules,
    unlocked: [...unlocked],
  };
}

export function getAvailableLearningModules(progress: KnowledgeProgress) {
  return learningModules.filter((module) => {
    if (progress.completedModules.includes(module.id)) return false;
    return module.requires.every((requiredModuleId) =>
      progress.completedModules.includes(requiredModuleId),
    );
  });
}

export function getUnlockedBuildings(progress: KnowledgeProgress) {
  return knowledgeBuildings.filter((building) =>
    building.requires.every((unlockId) => progress.unlocked.includes(unlockId)),
  );
}

export function canBuild(
  buildingId: BuildingId,
  progress: KnowledgeProgress,
): BuildCheck {
  const building = knowledgeBuildings.find((candidate) => candidate.id === buildingId);

  if (!building) {
    return {
      canBuild: false,
      missingModules: [],
      missingUnlocks: [],
    };
  }

  const missingUnlocks = building.requires.filter(
    (unlockId) => !progress.unlocked.includes(unlockId),
  );

  const missingModules = missingUnlocks.flatMap((unlockId) =>
    getMissingModulesForUnlock(unlockId, progress),
  );

  return {
    canBuild: missingUnlocks.length === 0,
    missingModules: unique(missingModules),
    missingUnlocks,
  };
}

export function getMissingModulesForUnlock(
  unlockId: UnlockId,
  progress: KnowledgeProgress,
): LearningModuleId[] {
  const unlock = knowledgeUnlocks.find((candidate) => candidate.id === unlockId);
  if (!unlock) return [];

  return unlock.requires.filter(
    (requiredModuleId) => !progress.completedModules.includes(requiredModuleId),
  );
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
