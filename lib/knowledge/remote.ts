import type { BuildingId, KnowledgeProgress } from './types';
import { getSolarScienceFoundationBaseUrl } from './source';

export type NoxiaUnlockPayload = KnowledgeProgress & {
  userId: string;
  buildings: BuildingId[];
  source?: string;
};

export async function fetchNoxiaUnlocks(userId = 'demo'): Promise<NoxiaUnlockPayload> {
  const baseUrl = getSolarScienceFoundationBaseUrl().replace(/\/$/, '');
  const url = `${baseUrl}/api/noxia/unlocks/${encodeURIComponent(userId)}`;

  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    throw new Error(`SSF unlock request failed: ${response.status}`);
  }

  return response.json() as Promise<NoxiaUnlockPayload>;
}
