// remote.ts
// Aktualisiert: 09.07.2026 — SSF Unlock-Route korrigiert und Response-Adapter ergänzt
// Version:      0.2.0

import { getUnlockedBuildings } from './progress';
import type { BuildingId, KnowledgeProgress, LearningModuleId, UnlockId } from './types';
import { getSolarScienceFoundationBaseUrl } from './source';

export type NoxiaUnlockPayload = KnowledgeProgress & {
  userId: string;
  buildings: BuildingId[];
  source?: string;
};

type SsfPlayerUnlockPayload = {
  schema?: string;
  playerId?: string;
  completedModules?: LearningModuleId[];
  unlocks?: UnlockId[];
  unlocked?: UnlockId[];
  buildings?: BuildingId[];
  source?: string;
};

function adaptSsfUnlockPayload(userId: string, payload: SsfPlayerUnlockPayload): NoxiaUnlockPayload {
  const completedModules = Array.isArray(payload.completedModules) ? payload.completedModules : [];
  const unlocked = Array.isArray(payload.unlocked)
    ? payload.unlocked
    : Array.isArray(payload.unlocks)
      ? payload.unlocks
      : [];

  const progress: KnowledgeProgress = { completedModules, unlocked };
  const buildings = Array.isArray(payload.buildings)
    ? payload.buildings
    : getUnlockedBuildings(progress).map((building) => building.id);

  return {
    source: payload.source ?? 'ssf',
    userId: payload.playerId ?? userId,
    completedModules,
    unlocked,
    buildings,
  };
}

export async function fetchNoxiaUnlocks(userId = 'demo'): Promise<NoxiaUnlockPayload> {
  const baseUrl = getSolarScienceFoundationBaseUrl().replace(/\/$/, '');
  const url = `${baseUrl}/api/player/${encodeURIComponent(userId)}/unlocks`;

  const response = await fetch(url, {
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`SSF unlock request failed: ${response.status}`);
  }

  const payload = (await response.json()) as SsfPlayerUnlockPayload;
  return adaptSsfUnlockPayload(userId, payload);
}
