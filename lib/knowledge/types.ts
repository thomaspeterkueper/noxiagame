// types.ts
// Aktualisiert: 04.07.2026 — Header ergänzt; Knowledge-Typen
// Version:      0.1.0
export type LearningModuleId = `LRN:${string}`;
export type UnlockId = `UNL:${string}`;
export type BuildingId = `BLD:${string}`;

export type KnowledgeLearningModule = {
  id: LearningModuleId;
  name: string;
  domain: string;
  requires: LearningModuleId[];
  teaches: string[];
  unlocks: UnlockId[];
};

export type KnowledgeUnlock = {
  id: UnlockId;
  name: string;
  requires: LearningModuleId[];
  unlocks: BuildingId[];
};

export type KnowledgeBuilding = {
  id: BuildingId;
  name: string;
  category: string;
  requires: UnlockId[];
  effects: string[];
};

export type KnowledgeProgress = {
  completedModules: LearningModuleId[];
  unlocked: UnlockId[];
};

export type BuildCheck = {
  canBuild: boolean;
  missingModules: LearningModuleId[];
  missingUnlocks: UnlockId[];
};
